defmodule Kaarobar.Billing do
  @moduledoc """
  What each organization pays Kaarobar, and what it entitles them to.

  Entirely separate from `Kaarobar.Payments`, which is the money a shop takes
  over its own counter. These are our books; those are theirs.

  ## A failed payment is not an eviction

  Nothing here cuts anybody off on a decline. A subscription goes `past_due`
  and keeps working until its grace runs out, the invoice is retried on a
  schedule that ends, and only then does the organization lose access — to
  everything except its own records and the screen where it can pay.

  That is a commercial judgement as much as a technical one. A shop locked out
  on the morning its card expired does not pay the invoice; it leaves.

  ## Billing is optional

  An organization with no subscription is unrestricted. A deployment that does
  not sell subscriptions, a seeded demo, a test — none of them should have to
  fabricate a plan to use the software. See `Kaarobar.Billing.Entitlements`.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Billing.Entitlements
  alias Kaarobar.Billing.Invoice
  alias Kaarobar.Billing.InvoiceLine
  alias Kaarobar.Billing.Plan
  alias Kaarobar.Billing.PlanFeature
  alias Kaarobar.Billing.Subscription
  alias Kaarobar.Billing.SubscriptionItem
  alias Kaarobar.Money
  alias Kaarobar.Repo
  alias Kaarobar.Scope

  require Logger

  # ===========================================================================
  # Plans — platform-owned, no tenant
  # ===========================================================================

  @doc """
  The plans on offer.

  Public ones only by default. An unlisted plan is still live for the
  organizations already on it — which is how an old price is honoured without
  offering it to anybody new.
  """
  @spec list_plans(keyword()) :: [Plan.t()]
  def list_plans(opts \\ []) do
    Plan
    |> where([p], is_nil(p.deleted_at) and p.is_active)
    |> filter_public(Keyword.get(opts, :public, true))
    |> order_by([p], asc: p.position, asc: p.amount)
    |> preload(:features)
    |> Repo.all()
  end

  @doc "One plan by its code."
  @spec fetch_plan(String.t()) :: {:ok, Plan.t()} | {:error, :not_found}
  def fetch_plan(code) do
    Plan
    |> where([p], p.code == ^code and is_nil(p.deleted_at))
    |> preload(:features)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      plan -> {:ok, plan}
    end
  end

  @doc "Creates a plan. Platform administration, not a tenant operation."
  @spec create_plan(map()) :: {:ok, Plan.t()} | {:error, Ecto.Changeset.t()}
  def create_plan(attrs) do
    %Plan{}
    |> Plan.changeset(attrs)
    |> Repo.insert()
  end

  @doc "Updates a plan's name, price or availability."
  @spec update_plan(Plan.t(), map()) :: {:ok, Plan.t()} | {:error, Ecto.Changeset.t()}
  def update_plan(%Plan{} = plan, attrs), do: plan |> Plan.changeset(attrs) |> Repo.update()

  @doc """
  Replaces a plan's feature list wholesale.

  Wholesale rather than incremental because a plan's features are a
  definition, not a log. Adding rows one at a time leaves the plan half-changed
  if the caller stops halfway, and half a plan is worse than either version of
  it.

  Accepts `["pos", "tables"]`, or `%{"max_branches" => 3}` for a limit, or a
  list of maps for both at once.
  """
  @spec set_plan_features(Plan.t(), list() | map()) :: {:ok, Plan.t()} | {:error, term()}
  def set_plan_features(%Plan{} = plan, features) do
    rows = normalise_features(features)

    Repo.transaction(fn ->
      Repo.delete_all(from f in PlanFeature, where: f.plan_id == ^plan.id)

      Enum.each(rows, fn row ->
        %PlanFeature{}
        |> PlanFeature.changeset(Map.put(row, "plan_id", plan.id))
        |> Repo.insert!()
      end)

      Repo.preload(plan, :features, force: true)
    end)
  end

  # ===========================================================================
  # Subscriptions
  # ===========================================================================

  @doc "The organization's live subscription, or nil."
  @spec subscription(Scope.t()) :: Subscription.t() | nil
  def subscription(%Scope{} = scope) do
    Subscription
    |> where([s], s.organization_id == ^Scope.organization_id(scope))
    |> where([s], s.status not in ~w(canceled expired))
    |> preload([:plan, :items])
    |> Repo.one()
  end

  @doc """
  Starts a subscription on a plan.

  The trial is a status, not a discounted invoice: nothing is charged while it
  runs, and a trial billed at zero would show up in revenue as a sale that
  never happened.
  """
  @spec subscribe(Scope.t(), String.t(), keyword()) ::
          {:ok, Subscription.t()} | {:error, term()}
  def subscribe(%Scope{} = scope, plan_code, opts \\ []) do
    now = Keyword.get(opts, :now, DateTime.utc_now())

    with {:ok, plan} <- fetch_plan(plan_code),
         :ok <- ensure_available(plan),
         :ok <- ensure_unsubscribed(scope) do
      trial_ends = trial_end(plan, now, opts)

      attrs = %{
        "organization_id" => Scope.organization_id(scope),
        "plan_id" => plan.id,
        "status" => if(trial_ends, do: "trialing", else: "active"),
        "provider" => Keyword.get(opts, :provider, "manual"),
        "currency" => plan.currency,
        "current_period_start" => now,
        "current_period_end" => Plan.period_end(plan, now),
        "trial_ends_at" => trial_ends
      }

      with {:ok, subscription} <- Repo.insert(Subscription.changeset(%Subscription{}, attrs)) do
        Audit.log(scope, "billing.subscribed", subscription,
          entity_type: "subscription",
          label: plan.code
        )

        {:ok, Repo.preload(subscription, [:plan, :items])}
      end
    end
  end

  @doc """
  Moves an organization onto a different plan.

  Takes effect immediately, and the period is not restarted: an upgrade in
  week three should not reset the billing date, and it should certainly not
  charge for a fresh month on top of the one already paid for. Proration is
  settled on the next invoice.
  """
  @spec change_plan(Scope.t(), String.t()) :: {:ok, Subscription.t()} | {:error, term()}
  def change_plan(%Scope{} = scope, plan_code) do
    with {:ok, plan} <- fetch_plan(plan_code),
         :ok <- ensure_available(plan),
         {:ok, subscription} <- require_subscription(scope) do
      changeset =
        subscription
        |> Ecto.Changeset.change(%{plan_id: plan.id, currency: plan.currency})
        |> Ecto.Changeset.foreign_key_constraint(:plan_id)

      with {:ok, updated} <- Repo.update(changeset) do
        Audit.log(scope, "billing.plan_changed", updated,
          entity_type: "subscription",
          label: plan.code
        )

        {:ok, Repo.preload(updated, [:plan, :items], force: true)}
      end
    end
  end

  @doc """
  Sets how many of something the organization is paying for.

  Seats, branches, businesses, add-ons. Quantities change between invoices and
  are billed at the next one, so this never charges anything on its own.
  """
  @spec set_quantity(Scope.t(), String.t(), non_neg_integer(), keyword()) ::
          {:ok, SubscriptionItem.t()} | {:error, term()}
  def set_quantity(%Scope{} = scope, kind, quantity, opts \\ []) do
    with {:ok, subscription} <- require_subscription(scope) do
      existing =
        Repo.get_by(SubscriptionItem, subscription_id: subscription.id, kind: kind) ||
          %SubscriptionItem{}

      attrs = %{
        "subscription_id" => subscription.id,
        "kind" => kind,
        "quantity" => quantity,
        "unit_amount" => Keyword.get(opts, :unit_amount, existing.unit_amount || Money.zero())
      }

      existing
      |> SubscriptionItem.changeset(attrs)
      |> Repo.insert_or_update()
    end
  end

  @doc """
  Cancels the subscription.

  At the end of the paid period by default. `immediate: true` ends it now, and
  is deliberately not the default: ending it the moment somebody clicks cancel
  means taking a month's money and withdrawing the service in the same act.
  """
  @spec cancel(Scope.t(), keyword()) :: {:ok, Subscription.t()} | {:error, term()}
  def cancel(%Scope{} = scope, opts \\ []) do
    with {:ok, subscription} <- require_subscription(scope) do
      changeset =
        if Keyword.get(opts, :immediate, false) do
          Subscription.end_changeset(subscription)
        else
          Subscription.cancel_at_period_end_changeset(subscription)
        end

      with {:ok, updated} <- Repo.update(changeset) do
        Audit.log(scope, "billing.canceled", updated,
          entity_type: "subscription",
          label: updated.status
        )

        {:ok, updated}
      end
    end
  end

  @doc "Withdraws a pending cancellation."
  @spec resume(Scope.t()) :: {:ok, Subscription.t()} | {:error, term()}
  def resume(%Scope{} = scope) do
    with {:ok, subscription} <- require_subscription(scope) do
      Repo.update(Subscription.resume_changeset(subscription))
    end
  end

  # ===========================================================================
  # Invoices
  # ===========================================================================

  @doc "The organization's invoices, newest first."
  @spec list_invoices(Scope.t(), keyword()) :: [Invoice.t()]
  def list_invoices(%Scope{} = scope, opts \\ []) do
    Invoice
    |> where([i], i.organization_id == ^Scope.organization_id(scope))
    |> filter_invoice_status(Keyword.get(opts, :status))
    |> order_by([i], desc: i.inserted_at)
    |> limit(^Keyword.get(opts, :limit, 50))
    |> preload(:lines)
    |> Repo.all()
  end

  @doc "One invoice belonging to this organization."
  @spec fetch_invoice(Scope.t(), Ecto.UUID.t()) :: {:ok, Invoice.t()} | {:error, :not_found}
  def fetch_invoice(%Scope{} = scope, id) do
    Invoice
    |> where([i], i.organization_id == ^Scope.organization_id(scope) and i.id == ^id)
    |> preload(:lines)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      invoice -> {:ok, invoice}
    end
  end

  @doc """
  Issues the invoice for a subscription's current period.

  The plan's own price is one line and each subscription item is another, all
  written out in full: an invoice from March has to keep saying what it said in
  March, even after the plan was renamed or the price changed.

  A trial issues nothing. There is nothing to charge for yet, and an invoice
  for zero is a thing a customer has to read and understand for no reason.
  """
  @spec issue_invoice(Subscription.t(), keyword()) :: {:ok, Invoice.t()} | {:error, term()}
  def issue_invoice(%Subscription{} = subscription, opts \\ []) do
    subscription = Repo.preload(subscription, [:plan, :items])

    if Subscription.trialing?(subscription) do
      {:error, :trialing}
    else
      Repo.transaction(fn -> insert_invoice(subscription, opts) end)
    end
  end

  @doc """
  Records that an invoice was paid.

  Also brings the subscription back to `active` and clears the grace, because
  an organization that has paid must not still be counting down to being cut
  off.
  """
  @spec mark_paid(Invoice.t(), keyword()) :: {:ok, Invoice.t()} | {:error, term()}
  def mark_paid(%Invoice{} = invoice, opts \\ []) do
    Repo.transaction(fn ->
      {:ok, paid} = Repo.update(Invoice.paid_changeset(invoice, Keyword.get(opts, :amount)))

      reactivate(paid)
      paid
    end)
  end

  @doc """
  Records a failed collection attempt.

  Schedules the next one, moves the subscription to `past_due` — which starts
  its grace, not its termination — and gives up once the schedule is spent.
  """
  @spec record_failure(Invoice.t(), term()) :: {:ok, Invoice.t()} | {:error, term()}
  def record_failure(%Invoice{} = invoice, reason) do
    Repo.transaction(fn ->
      {:ok, updated} = Repo.update(Invoice.dunning_changeset(invoice, reason))

      mark_past_due(updated)
      updated
    end)
  end

  @doc """
  Works through the invoices whose next collection attempt is due.

  Runs across tenants. Collection itself is the gateway's job — this decides
  who to chase and records what came back, which is the part that has to be
  correct whether or not a gateway is configured.
  """
  @spec process_dunning(non_neg_integer(), (Invoice.t() -> :ok | {:error, term()})) :: map()
  def process_dunning(limit \\ 100, collect \\ &default_collect/1) do
    now = DateTime.utc_now()

    Invoice
    |> where([i], i.status == "open")
    |> where([i], not is_nil(i.next_attempt_at) and i.next_attempt_at <= ^now)
    |> order_by([i], asc: i.next_attempt_at)
    |> limit(^limit)
    |> Repo.all()
    |> Enum.reduce(%{collected: 0, failed: 0}, fn invoice, acc ->
      case collect.(invoice) do
        :ok ->
          mark_paid(invoice)
          %{acc | collected: acc.collected + 1}

        {:error, reason} ->
          record_failure(invoice, reason)
          %{acc | failed: acc.failed + 1}
      end
    end)
  end

  @doc """
  Ends access for subscriptions whose grace has run out.

  The one place anybody is actually cut off, and it is a scheduled job rather
  than a decline handler — so the decision is always "this has been unpaid for
  a fortnight", never "this card failed once".
  """
  @spec expire_lapsed(DateTime.t()) :: non_neg_integer()
  def expire_lapsed(now \\ DateTime.utc_now()) do
    {count, _rows} =
      Subscription
      |> where([s], s.status == "past_due")
      |> where([s], not is_nil(s.grace_until) and s.grace_until < ^now)
      |> Repo.update_all(set: [status: "expired", ended_at: now, updated_at: now])

    if count > 0, do: Logger.info("billing: #{count} subscription(s) expired")

    count
  end

  @doc """
  Ends subscriptions that were cancelled and whose paid period has now run out.

  Separate from `expire_lapsed/1` because these customers do not owe anything —
  they asked to leave, and they got what they paid for.
  """
  @spec close_cancelled(DateTime.t()) :: non_neg_integer()
  def close_cancelled(now \\ DateTime.utc_now()) do
    {count, _rows} =
      Subscription
      |> where([s], s.cancel_at_period_end and s.status in ~w(active trialing past_due))
      |> where([s], not is_nil(s.current_period_end) and s.current_period_end < ^now)
      |> Repo.update_all(set: [status: "canceled", ended_at: now, updated_at: now])

    count
  end

  # ===========================================================================
  # Entitlements
  # ===========================================================================

  @doc "What this organization's plan unlocks. See `Kaarobar.Billing.Entitlements`."
  @spec entitlements(Ecto.UUID.t() | nil) :: Entitlements.t()
  defdelegate entitlements(organization_id), to: Entitlements, as: :for_organization

  # ===========================================================================
  # Internals
  # ===========================================================================

  defp insert_invoice(%Subscription{} = subscription, opts) do
    now = Keyword.get(opts, :now, DateTime.utc_now())
    lines = invoice_lines(subscription)
    subtotal = lines |> Enum.map(& &1["amount"]) |> Money.sum()

    attrs = %{
      "organization_id" => subscription.organization_id,
      "subscription_id" => subscription.id,
      "number" => next_invoice_number(),
      "status" => "open",
      "currency" => subscription.currency,
      "subtotal" => subtotal,
      "total" => subtotal,
      "period_start" => subscription.current_period_start,
      "period_end" => subscription.current_period_end,
      # The first collection attempt is due immediately; the dunning schedule
      # takes over from the first failure.
      "due_at" => Keyword.get(opts, :due_at, now)
    }

    invoice =
      %Invoice{}
      |> Invoice.changeset(attrs)
      |> Ecto.Changeset.put_change(:next_attempt_at, now)
      |> Repo.insert!()

    Enum.each(lines, fn line ->
      %InvoiceLine{}
      |> InvoiceLine.changeset(Map.put(line, "invoice_id", invoice.id))
      |> Repo.insert!()
    end)

    Repo.preload(invoice, :lines)
  end

  defp invoice_lines(%Subscription{plan: plan} = subscription) do
    plan_line = %{
      "description" => "#{plan.name} (#{plan.interval}ly)",
      "quantity" => 1,
      "unit_amount" => plan.amount,
      "amount" => plan.amount,
      "position" => 0
    }

    item_lines =
      subscription.items
      |> Enum.reject(&Money.zero?(SubscriptionItem.amount(&1)))
      |> Enum.with_index(1)
      |> Enum.map(fn {item, index} ->
        %{
          "description" => "#{item.quantity} × #{item.kind}",
          "quantity" => item.quantity,
          "unit_amount" => item.unit_amount,
          "amount" => SubscriptionItem.amount(item),
          "position" => index
        }
      end)

    [plan_line | item_lines]
  end

  # One global series, and we are the only issuer, so a Postgres sequence is
  # both sufficient and cheaper than locking a counter row the way a shop's own
  # gapless invoice numbering has to.
  defp next_invoice_number do
    %{rows: [[value]]} = Repo.query!("SELECT nextval('platform_invoice_number_seq')")

    "KB-" <> String.pad_leading(to_string(value), 6, "0")
  end

  defp reactivate(%Invoice{subscription_id: nil}), do: :ok

  defp reactivate(%Invoice{} = invoice) do
    Subscription
    |> where([s], s.id == ^invoice.subscription_id and s.status == "past_due")
    |> Repo.update_all(set: [status: "active", grace_until: nil, updated_at: DateTime.utc_now()])

    :ok
  end

  defp mark_past_due(%Invoice{subscription_id: nil}), do: :ok

  defp mark_past_due(%Invoice{} = invoice) do
    case Repo.get(Subscription, invoice.subscription_id) do
      nil ->
        :ok

      %Subscription{status: status} when status in ~w(canceled expired) ->
        :ok

      subscription ->
        {:ok, _updated} = Repo.update(Subscription.past_due_changeset(subscription))
        :ok
    end
  end

  # Nobody is charged by default. A deployment wires its gateway in by passing
  # a collector; without one, dunning still runs and still escalates, which is
  # what a manually invoiced customer needs.
  defp default_collect(%Invoice{}), do: {:error, :no_collector}

  defp require_subscription(%Scope{} = scope) do
    case subscription(scope) do
      nil -> {:error, :no_subscription}
      subscription -> {:ok, subscription}
    end
  end

  defp ensure_available(%Plan{} = plan) do
    if Plan.available?(plan), do: :ok, else: {:error, :plan_unavailable}
  end

  defp ensure_unsubscribed(%Scope{} = scope) do
    if subscription(scope), do: {:error, :already_subscribed}, else: :ok
  end

  defp trial_end(%Plan{trial_days: 0}, _now, _opts), do: nil

  defp trial_end(%Plan{trial_days: days}, now, opts) do
    if Keyword.get(opts, :skip_trial, false) do
      nil
    else
      DateTime.add(now, days * 24 * 3600, :second)
    end
  end

  defp normalise_features(features) when is_map(features) do
    Enum.map(features, fn {key, value} -> feature_row(key, value) end)
  end

  defp normalise_features(features) when is_list(features) do
    Enum.map(features, fn
      %{} = row -> stringify_feature(row)
      key when is_binary(key) -> %{"key" => key, "is_enabled" => true}
      {key, value} -> feature_row(key, value)
    end)
  end

  defp feature_row(key, value) when is_integer(value),
    do: %{"key" => to_string(key), "is_enabled" => true, "limit_value" => value}

  defp feature_row(key, value) when is_boolean(value),
    do: %{"key" => to_string(key), "is_enabled" => value}

  defp stringify_feature(row) do
    Map.new(row, fn {key, value} -> {to_string(key), value} end)
  end

  defp filter_public(query, true), do: where(query, [p], p.is_public)
  defp filter_public(query, _other), do: query

  defp filter_invoice_status(query, nil), do: query
  defp filter_invoice_status(query, status) when is_binary(status),
    do: where(query, [i], i.status == ^status)
end
