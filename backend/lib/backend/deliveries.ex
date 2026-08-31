defmodule Kaarobar.Deliveries do
  @moduledoc """
  Orders going out on bikes, and the riders carrying them.

  ## The rider's round is the unit that matters

  A delivery is tracked one order at a time, but the question a shop asks at
  nine on a Friday is "what has Bilal got?" — so `rider_board/2` groups by
  rider, and `assign/3` refuses a rider who is not on the branch. Handing food
  to somebody who does not work there is not a hypothetical when a shop is
  three deep at the counter.

  ## Cash on delivery is the risk

  Money leaves with the rider and comes back an hour later, and the shop cannot
  see it in between. `collected_amount` records what actually came back,
  separately from what was owed, so a short round is noticed the same evening
  rather than at the end of the month.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Accounts.User
  alias Kaarobar.Audit
  alias Kaarobar.Deliveries.Delivery
  alias Kaarobar.Money
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Sequences
  alias Kaarobar.Staffing

  @doc """
  Books a delivery.

  The address is copied onto the record rather than joined, so a customer
  editing it next week does not change where last week's order went.
  """
  @spec create(Scope.t(), map()) :: {:ok, Delivery.t()} | {:error, term()}
  def create(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      with {:ok, number} <- Sequences.next(scope, "delivery"),
           {:ok, delivery} <- insert(scope, attrs, number) do
        Audit.log(scope, "delivery.created", delivery,
          entity_type: "delivery",
          label: delivery.number
        )

        delivery
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Deliveries still out or still waiting to go, oldest promise first.

  ## Options

    * `:rider_user_id` — one rider's round.
    * `:status` — a particular state rather than everything live.
  """
  @spec live(Scope.t(), keyword()) :: [Delivery.t()]
  def live(%Scope{} = scope, opts \\ []) do
    Delivery
    |> Scoped.for_branch(scope)
    |> filter_status(Keyword.get(opts, :status))
    |> filter_rider(Keyword.get(opts, :rider_user_id))
    |> order_by([delivery], asc_nulls_last: delivery.promised_at, asc: delivery.id)
    |> preload([:customer, :rider_user])
    |> Repo.all()
  end

  @doc """
  What each rider is carrying, busiest first.

  The question a shop actually asks on a Friday night, and the one a list of
  individual deliveries makes you compute in your head.
  """
  @spec rider_board(Scope.t(), keyword()) :: [map()]
  def rider_board(%Scope{} = scope, opts \\ []) do
    now = DateTime.utc_now()

    scope
    |> live(opts)
    |> Enum.filter(&Delivery.live?/1)
    |> Enum.group_by(& &1.rider_user_id)
    |> Enum.map(fn {rider_id, deliveries} ->
      %{
        rider_user_id: rider_id,
        rider_label: rider_label(deliveries),
        deliveries: deliveries,
        count: length(deliveries),
        late_count: Enum.count(deliveries, &late?(&1, now)),
        cash_out: deliveries |> Enum.map(&(&1.fee || Money.zero())) |> Money.sum()
      }
    end)
    |> Enum.sort_by(& &1.count, :desc)
  end

  @doc "Fetches a delivery."
  @spec fetch(Scope.t(), Ecto.UUID.t()) :: {:ok, Delivery.t()} | {:error, :not_found}
  def fetch(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Delivery
      |> Scoped.for_business(scope)
      |> where([delivery], delivery.id == ^id)
      |> preload([:customer, :rider_user])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        delivery -> {:ok, delivery}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Hands the order to a rider.

  The rider has to work at this branch. Food handed to somebody who does not is
  food nobody can chase, and a busy counter is exactly where that happens.
  """
  @spec assign(Scope.t(), Delivery.t(), Ecto.UUID.t()) ::
          {:ok, Delivery.t()} | {:error, term()}
  def assign(%Scope{} = scope, %Delivery{} = delivery, rider_id) do
    with :ok <- ensure_live(delivery),
         {:ok, rider} <- fetch_rider(scope, rider_id),
         {:ok, assigned} <- delivery |> Delivery.assign_changeset(rider) |> Repo.update() do
      Audit.log(scope, "delivery.assigned", assigned,
        entity_type: "delivery",
        label: assigned.number,
        summary: "Assigned to #{rider.name}"
      )

      {:ok, Repo.preload(assigned, [:customer, :rider_user], force: true)}
    end
  end

  @doc "The rider has the food and has left."
  @spec pick_up(Scope.t(), Delivery.t()) :: {:ok, Delivery.t()} | {:error, term()}
  def pick_up(%Scope{}, %Delivery{} = delivery) do
    with :ok <- ensure_live(delivery) do
      delivery |> Delivery.pick_up_changeset() |> Repo.update()
    end
  end

  @doc """
  Delivered, with what the rider collected at the door.

  Pass nothing for an order already paid for — recording zero would read as a
  rider who came back empty-handed.
  """
  @spec deliver(Scope.t(), Delivery.t(), Decimal.t() | nil) ::
          {:ok, Delivery.t()} | {:error, term()}
  def deliver(%Scope{} = scope, %Delivery{} = delivery, collected \\ nil) do
    with :ok <- ensure_live(delivery),
         {:ok, delivered} <- delivery |> Delivery.deliver_changeset(collected) |> Repo.update() do
      Audit.log(scope, "delivery.delivered", delivered,
        entity_type: "delivery",
        label: delivered.number,
        summary: collected_summary(delivered)
      )

      {:ok, delivered}
    end
  end

  @doc "Did not get there. A reason is required."
  @spec fail(Scope.t(), Delivery.t(), String.t()) :: {:ok, Delivery.t()} | {:error, term()}
  def fail(%Scope{} = scope, %Delivery{} = delivery, reason) do
    with :ok <- ensure_live(delivery),
         {:ok, failed} <- delivery |> Delivery.fail_changeset(reason) |> Repo.update() do
      Audit.log(scope, "delivery.failed", failed,
        entity_type: "delivery",
        label: failed.number,
        summary: "Failed: #{failed.failure_reason}"
      )

      {:ok, failed}
    end
  end

  @doc "Calls off a delivery that has not gone out."
  @spec cancel(Scope.t(), Delivery.t()) :: {:ok, Delivery.t()} | {:error, term()}
  def cancel(%Scope{}, %Delivery{} = delivery) do
    if delivery.status in ["pending", "assigned"] do
      delivery |> Ecto.Changeset.change(status: "cancelled") |> Repo.update()
    else
      {:error, :already_out}
    end
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp insert(%Scope{} = scope, attrs, number) do
    %Delivery{}
    |> Delivery.changeset(
      Map.merge(attrs, %{
        "organization_id" => Scope.organization_id(scope),
        "business_id" => Scope.business_id(scope),
        "branch_id" => Map.get(attrs, "branch_id") || Scope.branch_id(scope),
        "number" => number
      })
    )
    |> Repo.insert()
  end

  defp ensure_live(%Delivery{} = delivery) do
    if Delivery.live?(delivery), do: :ok, else: {:error, :delivery_closed}
  end

  # Riders are looked up through the staff list rather than by user id alone:
  # the point of the check is that they work here, and a bare user lookup would
  # happily hand food to someone from another organisation.
  defp fetch_rider(%Scope{} = scope, rider_id) do
    scope
    |> Staffing.list_staff()
    |> Enum.find(&(&1.user_id == rider_id))
    |> case do
      nil -> {:error, :rider_not_found}
      %{user: %User{} = rider} -> {:ok, rider}
      _unloaded -> {:error, :rider_not_found}
    end
  end

  defp late?(%Delivery{} = delivery, now) do
    case Delivery.minutes_late(delivery, now) do
      nil -> false
      minutes -> minutes > 0
    end
  end

  defp rider_label([%Delivery{rider_label: label} | _rest]) when is_binary(label), do: label
  defp rider_label(_deliveries), do: nil

  defp collected_summary(%Delivery{collected_amount: nil}), do: "Delivered"

  defp collected_summary(%Delivery{collected_amount: amount}),
    do: "Delivered, collected #{Decimal.to_string(amount, :normal)}"

  defp filter_status(query, nil),
    do: where(query, [delivery], delivery.status in ^Delivery.live_statuses())

  defp filter_status(query, status), do: where(query, [delivery], delivery.status == ^status)

  defp filter_rider(query, nil), do: query

  defp filter_rider(query, rider_id),
    do: where(query, [delivery], delivery.rider_user_id == ^rider_id)

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} ->
      {if(is_atom(key), do: Atom.to_string(key), else: key), value}
    end)
  end
end
