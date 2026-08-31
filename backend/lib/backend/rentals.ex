defmodule Kaarobar.Rentals do
  @moduledoc """
  Hiring things out and getting them back.

  ## Availability is a question about dates, not a stock level

  "How many drills do we have?" is the wrong question. "Is this drill free on
  the 14th?" is the right one, and it is answered by looking for an overlapping
  live hire — the same rows the booking is checked against, so the answer and
  the guard cannot disagree.

  The guard itself is a `gist` exclusion constraint in Postgres. Two counters
  promising the same marquee to two weddings is exactly the race a read-then-
  write check loses, and finding out on the Saturday is not a recoverable
  error.

  ## Money owed is computed from what was agreed

  `due_back_at` never moves, so the late fee is defensible when the customer
  disputes it. Fees come out of the deposit before anything is handed back,
  because a full deposit returned on damaged goods at the end of a long day is
  the mistake that actually happens.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Money
  alias Kaarobar.Rentals.Agreement
  alias Kaarobar.Rentals.AgreementLine
  alias Kaarobar.Rentals.Unit
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Sequences

  # ===========================================================================
  # Units
  # ===========================================================================

  @doc "The branch's rental stock."
  @spec list_units(Scope.t(), keyword()) :: [Unit.t()]
  def list_units(%Scope{} = scope, opts \\ []) do
    Unit
    |> Scoped.for_branch(scope)
    |> Scoped.active()
    |> filter_unit_status(Keyword.get(opts, :status))
    |> order_by([unit], asc: unit.asset_code)
    |> preload(:variant)
    |> Repo.all()
  end

  @doc "Fetches a unit."
  @spec fetch_unit(Scope.t(), Ecto.UUID.t()) :: {:ok, Unit.t()} | {:error, :not_found}
  def fetch_unit(%Scope{} = scope, id), do: fetch_scoped(scope, Unit, id)

  @doc "Adds a unit to the hire fleet."
  @spec create_unit(Scope.t(), map()) :: {:ok, Unit.t()} | {:error, Ecto.Changeset.t()}
  def create_unit(%Scope{} = scope, attrs) do
    %Unit{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> Unit.changeset(Map.put_new(stringify(attrs), "branch_id", Scope.branch_id(scope)))
    |> Repo.insert()
  end

  @doc "Updates a unit."
  @spec update_unit(Scope.t(), Unit.t(), map()) :: {:ok, Unit.t()} | {:error, Ecto.Changeset.t()}
  def update_unit(%Scope{}, %Unit{} = unit, attrs),
    do: unit |> Unit.changeset(stringify(attrs)) |> Repo.update()

  @doc "Retires a unit from the fleet, keeping its hire history."
  @spec delete_unit(Scope.t(), Unit.t()) :: {:ok, Unit.t()} | {:error, Ecto.Changeset.t()}
  def delete_unit(%Scope{}, %Unit{} = unit),
    do: unit |> Unit.soft_delete_changeset() |> Repo.update()

  @doc """
  Units free for a whole period.

  The question a hire shop actually asks, and the one a stock level cannot
  answer.
  """
  @spec available_between(Scope.t(), DateTime.t(), DateTime.t(), keyword()) :: [Unit.t()]
  def available_between(%Scope{} = scope, from, to, opts \\ []) do
    taken =
      AgreementLine
      |> Scoped.for_business(scope)
      |> where([line], is_nil(line.returned_at))
      |> where([line], line.held_from < ^to and line.held_until > ^from)
      |> select([line], line.rental_unit_id)
      |> Repo.all()
      |> MapSet.new()

    scope
    |> list_units(opts)
    |> Enum.filter(&Unit.hireable?/1)
    |> Enum.reject(&MapSet.member?(taken, &1.id))
  end

  @doc "True when one unit is free for a period."
  @spec available_on?(Scope.t(), Unit.t(), DateTime.t(), DateTime.t()) :: boolean()
  def available_on?(%Scope{} = scope, %Unit{} = unit, from, to) do
    scope |> available_between(from, to) |> Enum.any?(&(&1.id == unit.id))
  end

  # ===========================================================================
  # Agreements
  # ===========================================================================

  @doc "Hires, most urgent return first."
  @spec list_agreements(Scope.t(), keyword()) :: [Agreement.t()]
  def list_agreements(%Scope{} = scope, opts \\ []) do
    Agreement
    |> Scoped.for_branch(scope)
    |> filter_agreement_status(Keyword.get(opts, :status))
    |> filter_customer(Keyword.get(opts, :customer_id))
    |> order_by([agreement], asc: agreement.due_back_at)
    |> preload([:customer, lines: :rental_unit])
    |> Repo.all()
  end

  @doc "Fetches a hire with its lines."
  @spec fetch_agreement(Scope.t(), Ecto.UUID.t()) ::
          {:ok, Agreement.t()} | {:error, :not_found}
  def fetch_agreement(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Agreement
      |> Scoped.for_business(scope)
      |> where([agreement], agreement.id == ^id)
      |> preload([:customer, lines: :rental_unit])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        agreement -> {:ok, agreement}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Books a hire.

  The lines are laid down in the same transaction as the agreement, and the
  exclusion constraint refuses any unit already committed for an overlapping
  period. A half-written hire would leave units marked out that nobody can
  account for.

  Totals are computed from the daily rates and the length of the hire rather
  than taken from the caller — a client that could send its own total could
  send any total.
  """
  @spec book(Scope.t(), map()) :: {:ok, Agreement.t()} | {:error, term()}
  def book(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      with {:ok, from} <- parse_datetime(Map.get(attrs, "starts_at")),
           {:ok, until} <- parse_datetime(Map.get(attrs, "due_back_at")),
           {:ok, units} <- fetch_units(scope, Map.get(attrs, "unit_ids", [])),
           {:ok, number} <- Sequences.next(scope, "rental_agreement"),
           {:ok, agreement} <- insert_agreement(scope, attrs, number, from, until, units),
           :ok <- insert_lines(scope, agreement, units, from, until),
           :ok <- set_unit_status(scope, units, "reserved") do
        Audit.log(scope, "rental.booked", agreement,
          entity_type: "rental_agreement",
          label: agreement.number,
          summary: "#{length(units)} unit(s) hired"
        )

        reload(scope, agreement.id)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "The goods have gone out."
  @spec issue(Scope.t(), Agreement.t()) :: {:ok, Agreement.t()} | {:error, term()}
  def issue(%Scope{} = scope, %Agreement{} = agreement) do
    Repo.transaction(fn ->
      with {:ok, issued} <- agreement |> Agreement.issue_changeset() |> Repo.update(),
           :ok <- set_unit_status(scope, unit_ids(agreement), "on_hire") do
        reload(scope, issued.id)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Takes everything back, working out what it cost.

  The late fee is computed from the agreed return date and the daily rates, so
  it is defensible when the customer disputes it. Fees come out of the deposit
  before the balance is handed back.
  """
  @spec take_back(Scope.t(), Agreement.t(), map()) :: {:ok, Agreement.t()} | {:error, term()}
  def take_back(%Scope{} = scope, %Agreement{} = agreement, attrs \\ %{}) do
    attrs = stringify(attrs)
    now = DateTime.utc_now()

    Repo.transaction(fn ->
      agreement = Repo.preload(agreement, :lines)

      late_fee =
        case Map.get(attrs, "late_fee") do
          nil -> Agreement.late_fee_for(agreement, now)
          value -> Money.to_decimal(value)
        end

      return_attrs = %{
        "late_fee" => late_fee,
        "damage_fee" => Map.get(attrs, "damage_fee") || Money.zero()
      }

      with :ok <- return_lines(scope, agreement, Map.get(attrs, "conditions", %{})),
           {:ok, returned} <-
             agreement
             |> Agreement.return_changeset(return_attrs, Scope.user_id(scope))
             |> Repo.update(),
           :ok <- set_unit_status(scope, unit_ids(agreement), "available") do
        Audit.log(scope, "rental.returned", returned,
          entity_type: "rental_agreement",
          label: returned.number,
          summary: return_summary(returned, now)
        )

        reload(scope, returned.id)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Calls off a hire that has not gone out."
  @spec cancel(Scope.t(), Agreement.t(), String.t()) ::
          {:ok, Agreement.t()} | {:error, term()}
  def cancel(%Scope{} = scope, %Agreement{} = agreement, reason) do
    if agreement.status == "reserved" do
      Repo.transaction(fn ->
        with {:ok, cancelled} <-
               agreement |> Agreement.cancel_changeset(reason) |> Repo.update(),
             :ok <- release_lines(scope, agreement),
             :ok <- set_unit_status(scope, unit_ids(agreement), "available") do
          reload(scope, cancelled.id)
        else
          {:error, failure} -> Repo.rollback(failure)
        end
      end)
    else
      {:error, :already_out}
    end
  end

  @doc """
  Hires that are past their return date and still out.

  The chase list. Marks them overdue as it goes, so the status on the record
  matches what the screen is showing.
  """
  @spec overdue(Scope.t()) :: [Agreement.t()]
  def overdue(%Scope{} = scope) do
    now = DateTime.utc_now()

    late =
      Agreement
      |> Scoped.for_branch(scope)
      |> where([agreement], agreement.status in ["reserved", "on_hire", "overdue"])
      |> where([agreement], agreement.due_back_at < ^now)
      |> preload([:customer, lines: :rental_unit])
      |> Repo.all()

    Enum.map(late, fn agreement ->
      if agreement.status != "overdue" do
        {:ok, marked} = agreement |> Agreement.overdue_changeset() |> Repo.update()
        %{marked | customer: agreement.customer, lines: agreement.lines}
      else
        agreement
      end
    end)
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp fetch_units(_scope, []), do: {:error, :units_required}

  defp fetch_units(%Scope{} = scope, ids) when is_list(ids) do
    units =
      Unit
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([unit], unit.id in ^ids)
      |> Repo.all()

    cond do
      length(units) != length(ids) -> {:error, :unit_not_found}
      not Enum.all?(units, &Unit.hireable?/1) -> {:error, :unit_unavailable}
      true -> {:ok, units}
    end
  end

  defp fetch_units(_scope, _other), do: {:error, :units_required}

  defp insert_agreement(%Scope{} = scope, attrs, number, from, until, units) do
    days = hire_days(from, until)
    hire_total = units |> Enum.map(&Money.mult(rate_of(&1), days)) |> Money.sum() |> Money.round()
    deposit = units |> Enum.map(&deposit_of/1) |> Money.sum() |> Money.round()

    %Agreement{}
    |> Agreement.changeset(
      Map.merge(attrs, %{
        "organization_id" => Scope.organization_id(scope),
        "business_id" => Scope.business_id(scope),
        "branch_id" => Map.get(attrs, "branch_id") || Scope.branch_id(scope),
        "number" => number,
        "starts_at" => from,
        "due_back_at" => until,
        "hire_total" => hire_total,
        "deposit_held" => deposit,
        "issued_by_id" => Scope.user_id(scope)
      })
    )
    |> Repo.insert()
  end

  defp insert_lines(%Scope{} = scope, %Agreement{} = agreement, units, from, until) do
    units
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {unit, position}, _acc ->
      changeset =
        %AgreementLine{}
        |> AgreementLine.changeset(%{
          "business_id" => Scope.business_id(scope),
          "rental_agreement_id" => agreement.id,
          "rental_unit_id" => unit.id,
          "name_snapshot" => unit.asset_code,
          "daily_rate" => rate_of(unit),
          "deposit_amount" => deposit_of(unit),
          "held_from" => from,
          "held_until" => until,
          "position" => position
        })

      case Repo.insert(changeset) do
        {:ok, _line} -> {:cont, :ok}
        {:error, failure} -> {:halt, {:error, failure}}
      end
    end)
  end

  defp return_lines(_scope, %Agreement{} = agreement, conditions) do
    agreement.lines
    |> Enum.reject(& &1.returned_at)
    |> Enum.reduce_while(:ok, fn line, _acc ->
      condition =
        Map.get(conditions, line.id) || Map.get(conditions, line.rental_unit_id) || "good"

      case line |> AgreementLine.return_changeset(condition, nil) |> Repo.update() do
        {:ok, _returned} -> {:cont, :ok}
        {:error, failure} -> {:halt, {:error, failure}}
      end
    end)
  end

  # Cancelling frees the units by clearing the hold, so the exclusion
  # constraint stops blocking the period immediately.
  defp release_lines(%Scope{} = scope, %Agreement{} = agreement) do
    AgreementLine
    |> Scoped.for_business(scope)
    |> where([line], line.rental_agreement_id == ^agreement.id)
    |> Repo.update_all(set: [returned_at: DateTime.utc_now(), return_condition: "good"])

    :ok
  end

  # Takes either loaded units or bare ids, because the callers have one or the
  # other and normalising here beats making each of them do it.
  defp set_unit_status(%Scope{} = scope, [%Unit{} | _rest] = units, status) do
    set_unit_status(scope, Enum.map(units, & &1.id), status)
  end

  defp set_unit_status(_scope, [], _status), do: :ok

  defp set_unit_status(%Scope{} = scope, ids, status) when is_list(ids) do
    Unit
    |> Scoped.for_business(scope)
    |> where([unit], unit.id in ^ids)
    |> Repo.update_all(set: [status: status])

    :ok
  end

  defp unit_ids(%Agreement{lines: lines}) when is_list(lines),
    do: Enum.map(lines, & &1.rental_unit_id)

  defp unit_ids(%Agreement{}), do: []

  # A part-day counts as a day: a hire shop cannot re-let a drill returned at
  # four in the afternoon, and pricing as if it could gives the day away.
  defp hire_days(from, until) do
    seconds = DateTime.diff(until, from, :second)
    seconds |> Kernel./(86_400) |> Float.ceil() |> trunc() |> max(1)
  end

  defp rate_of(%Unit{daily_rate: nil}), do: Money.zero()
  defp rate_of(%Unit{daily_rate: rate}), do: rate

  defp deposit_of(%Unit{deposit_amount: nil}), do: Money.zero()
  defp deposit_of(%Unit{deposit_amount: amount}), do: amount

  defp return_summary(%Agreement{} = agreement, now) do
    case Agreement.days_late(agreement, now) do
      0 -> "Returned on time"
      days -> "Returned #{days} day(s) late"
    end
  end

  defp parse_datetime(%DateTime{} = value), do: {:ok, value}

  defp parse_datetime(value) when is_binary(value) do
    case DateTime.from_iso8601(value) do
      {:ok, datetime, _offset} -> {:ok, datetime}
      {:error, _reason} -> {:error, :invalid_period}
    end
  end

  defp parse_datetime(_value), do: {:error, :invalid_period}

  defp reload(%Scope{} = scope, id) do
    {:ok, agreement} = fetch_agreement(scope, id)
    agreement
  end

  defp filter_unit_status(query, nil), do: query
  defp filter_unit_status(query, status), do: where(query, [unit], unit.status == ^status)

  defp filter_agreement_status(query, nil),
    do: where(query, [agreement], agreement.status in ^Agreement.out_statuses())

  defp filter_agreement_status(query, "all"), do: query

  defp filter_agreement_status(query, status),
    do: where(query, [agreement], agreement.status == ^status)

  defp filter_customer(query, nil), do: query
  defp filter_customer(query, id), do: where(query, [a], a.customer_id == ^id)

  defp fetch_scoped(%Scope{} = scope, schema, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      schema
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([record], record.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        record -> {:ok, record}
      end
    else
      {:error, :not_found}
    end
  end

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} ->
      {if(is_atom(key), do: Atom.to_string(key), else: key), value}
    end)
  end

  defp stringify(other), do: other
end
