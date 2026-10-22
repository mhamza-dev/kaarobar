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
  alias Kaarobar.Billing.Stripe, as: StripeBilling
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
  True when the organization has never had a subscription of any kind.

  A free trial is for somebody deciding whether to buy, once. Without this, an
  organization could cancel at the end of every trial and start another.
  """
  @spec trial_eligible?(Scope.t()) :: boolean()
  def trial_eligible?(%Scope{} = scope) do
    not Repo.exists?(
      from s in Subscription, where: s.organization_id == ^Scope.organization_id(scope)
    )
  end

  @doc """
  Starts a subscription on a plan.

  The trial is a status, not a discounted invoice: nothing is charged while it
  runs, and a trial billed at zero would show up in revenue as a sale that
  never happened. Only an organization's first subscription gets one — see
  `trial_eligible?/1`.
  """
  @spec subscribe(Scope.t(), String.t(), keyword()) ::
          {:ok, Subscription.t()} | {:error, term()}
  def subscribe(%Scope{} = scope, plan_code, opts \\ []) do
    now = Keyword.get(opts, :now, DateTime.utc_now())

    opts = if trial_eligible?(scope), do: opts, else: Keyword.put(opts, :skip_trial, true)

    with {:ok, plan} <- fetch_plan(plan_code),
         :ok <- ensure_available(plan),
         :ok <- ensure_unsubscribed(scope),
         trial_ends = trial_end(plan, now, opts),
         :ok <- ensure_paid_for(plan, trial_ends, opts) do
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

      with {:ok, subscription} <- insert_subscription(attrs, plan) do
        Audit.log(scope, "billing.subscribed", subscription,
          entity_type: "subscription",
          label: plan.code
        )

        {:ok, subscription}
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
         {:ok, subscription} <- require_subscription(scope),
         :ok <- ensure_self_managed(subscription) do
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
    with {:ok, subscription} <- require_subscription(scope),
         :ok <- ensure_self_managed(subscription) do
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
    with {:ok, subscription} <- require_subscription(scope),
         :ok <- ensure_self_managed(subscription) do
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
    with {:ok, subscription} <- require_subscription(scope),
         :ok <- ensure_self_managed(subscription) do
      Repo.update(Subscription.resume_changeset(subscription))
    end
  end

  # ===========================================================================
  # Card billing — Stripe Checkout and the customer portal
  # ===========================================================================

  @doc "True when this deployment takes card payment for subscriptions."
  @spec checkout_enabled?() :: boolean()
  defdelegate checkout_enabled?, to: StripeBilling, as: :configured?

  @doc """
  Opens a Stripe Checkout session for a plan and returns where to send the
  customer.

  Nothing changes here. The subscription becomes card-billed when Stripe's
  webhook says the session completed, not when somebody is sent to pay: a
  customer who closes the tab on the card form has not subscribed.

  A trial already running carries over. The card is taken now and first
  charged when the trial would have ended, so paying early never costs anybody
  the days they had left.

  `opts` takes `:success_url` and `:cancel_url`.
  """
  @spec checkout(Scope.t(), String.t(), keyword()) ::
          {:ok, %{id: String.t(), url: String.t()}} | {:error, term()}
  def checkout(%Scope{} = scope, plan_code, opts) do
    current = subscription(scope)

    with :ok <- ensure_checkout_enabled(),
         {:ok, plan} <- fetch_plan(plan_code),
         :ok <- ensure_available(plan),
         :ok <- ensure_not_card_billed(current) do
      StripeBilling.create_checkout_session(plan,
        organization_id: Scope.organization_id(scope),
        customer_id: current && current.external_customer_id,
        email: scope.user && scope.user.email,
        trial_end: carried_trial_end(current) || first_trial_end(scope, current, plan),
        success_url: Keyword.fetch!(opts, :success_url),
        cancel_url: Keyword.fetch!(opts, :cancel_url)
      )
    end
  end

  @doc """
  Opens Stripe's customer portal for the organization's card-billed
  subscription: changing the card, switching plan, cancelling, past invoices.
  """
  @spec portal(Scope.t(), String.t()) :: {:ok, %{url: String.t()}} | {:error, term()}
  def portal(%Scope{} = scope, return_url) do
    with :ok <- ensure_checkout_enabled(),
         {:ok, subscription} <- require_subscription(scope),
         {:ok, customer_id} <- billing_account(subscription) do
      StripeBilling.create_portal_session(customer_id, return_url)
    end
  end

  @doc """
  Verifies and applies a webhook from Kaarobar's Stripe account.

  Every handler is an upsert keyed on Stripe's own ids, so a replayed or
  out-of-order event converges on the same state rather than doubling
  anything — Stripe retries for days and promises nothing about order.

  Returns `{:ok, :applied}` or `{:ok, :ignored}`; an event we have no use for
  is not an error, or it would sit in Stripe's retry queue forever.
  """
  @spec handle_stripe_webhook(binary(), map()) ::
          {:ok, :applied | :ignored} | {:error, term()}
  def handle_stripe_webhook(raw_body, headers) do
    case StripeBilling.verify_webhook(raw_body, headers) do
      {:ok, event} -> apply_stripe_event(event)
      {:error, reason} -> {:error, {:signature_rejected, reason}}
    end
  end

  @doc "Applies an already-verified Stripe event. Public for tests."
  @spec apply_stripe_event(map()) :: {:ok, :applied | :ignored} | {:error, term()}
  def apply_stripe_event(%{"type" => type, "data" => %{"object" => object}}) do
    case type do
      "checkout.session.completed" -> checkout_completed(object)
      "customer.subscription." <> _change -> sync_stripe_subscription(object, nil)
      "invoice.paid" -> stripe_invoice(object, :paid)
      "invoice.payment_failed" -> stripe_invoice(object, :failed)
      _other -> {:ok, :ignored}
    end
  end

  def apply_stripe_event(_event), do: {:ok, :ignored}

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
  Turns trials that have ended into a first paid period, with its invoice.

  Without this a trial with no card behind it never ends — `trialing` is a
  serviceable status, and nothing else moves it on. The first invoice then goes
  through the same dunning as every other: a grace period, reminders, and only
  then an end to access. Card-billed trials are left alone; Stripe ends those
  itself and tells us by webhook.

  A free plan is moved on without an invoice, because there is nothing to ask
  for.
  """
  @spec convert_ended_trials(DateTime.t()) :: non_neg_integer()
  def convert_ended_trials(now \\ DateTime.utc_now()) do
    Subscription
    |> where([s], s.status == "trialing" and s.provider == "manual")
    |> where([s], not is_nil(s.trial_ends_at) and s.trial_ends_at < ^now)
    |> preload([:plan, :items])
    |> Repo.all()
    |> Enum.count(&match?({:ok, _converted}, convert_trial(&1)))
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

    # Collection is first attempted when the invoice falls due — at once by
    # default, later when the caller gave it payment terms.
    invoice =
      %Invoice{}
      |> Invoice.changeset(attrs)
      |> Ecto.Changeset.put_change(:next_attempt_at, attrs["due_at"])
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

  # A paid plan started without a trial is invoiced for its first period at
  # once, through the same dunning as every other invoice. Otherwise starting
  # one would be a month of service for nothing, settled by nobody.
  defp insert_subscription(attrs, %Plan{} = plan) do
    Repo.transaction(fn ->
      subscription =
        case Repo.insert(Subscription.changeset(%Subscription{}, attrs)) do
          {:ok, inserted} -> Repo.preload(inserted, [:plan, :items])
          {:error, changeset} -> Repo.rollback(changeset)
        end

      if attrs["status"] == "active" and attrs["provider"] == "manual" and not Plan.free?(plan) do
        case issue_invoice(subscription, due_at: payment_due()) do
          {:ok, _invoice} -> :ok
          {:error, reason} -> Repo.rollback(reason)
        end
      end

      subscription
    end)
  end

  # Payment terms for an invoice we issue by hand: due a week after it's
  # issued, so it isn't "overdue" the moment somebody subscribes. Card-billed
  # subscriptions never get here — Stripe charges them on its own schedule.
  @invoice_terms_days 7

  defp payment_due, do: DateTime.add(DateTime.utc_now(), @invoice_terms_days, :day)

  # --- Trials -----------------------------------------------------------------

  defp convert_trial(%Subscription{plan: plan} = subscription) do
    start = subscription.trial_ends_at

    Repo.transaction(fn ->
      {:ok, active} =
        subscription
        |> Subscription.renew_changeset(start, Plan.period_end(plan, start))
        |> Repo.update()

      unless Plan.free?(plan) do
        case issue_invoice(active, due_at: payment_due()) do
          {:ok, _invoice} -> :ok
          {:error, reason} -> Repo.rollback(reason)
        end
      end

      active
    end)
  end

  # --- Stripe -----------------------------------------------------------------

  defp checkout_completed(%{"mode" => "subscription"} = session) do
    organization_id =
      session["client_reference_id"] || get_in(session, ["metadata", "organization_id"])

    case session["subscription"] do
      %{"id" => _id} = subscription ->
        sync_stripe_subscription(subscription, organization_id)

      id when is_binary(id) ->
        with {:ok, subscription} <- StripeBilling.fetch_subscription(id) do
          sync_stripe_subscription(subscription, organization_id)
        end

      _none ->
        {:ok, :ignored}
    end
  end

  defp checkout_completed(_session), do: {:ok, :ignored}

  # The organization comes from metadata we wrote ourselves when the session
  # was opened, on an event whose signature has been checked — so it can be
  # trusted to pick the tenant, which is what lets every query below run
  # inside row-level security instead of around it.
  defp sync_stripe_subscription(%{} = remote, organization_id) do
    organization_id = organization_id || get_in(remote, ["metadata", "organization_id"])
    status = StripeBilling.map_status(remote["status"])

    cond do
      is_nil(organization_id) -> {:ok, :ignored}
      is_nil(status) -> {:ok, :ignored}
      true -> in_tenant(organization_id, fn -> apply_remote(organization_id, remote, status) end)
    end
  end

  defp apply_remote(organization_id, remote, status) do
    local = local_for_remote(organization_id, remote["id"])
    plan = plan_for_remote(remote) || (local && local.plan)

    cond do
      is_nil(plan) ->
        {:error, :unknown_plan}

      status == "canceled" ->
        end_remote(local)

      true ->
        upsert_remote(local, organization_id, plan, remote, status)
    end
  end

  # By Stripe's id first — that one is ours whatever state it is in — and
  # otherwise the organization's live subscription, which is the trial a first
  # checkout is converting.
  defp local_for_remote(organization_id, external_id) do
    by_external =
      Subscription
      |> where([s], s.organization_id == ^organization_id)
      |> where([s], s.external_subscription_id == ^external_id)
      |> preload(:plan)
      |> Repo.one()

    by_external ||
      Subscription
      |> where([s], s.organization_id == ^organization_id)
      |> where([s], s.status not in ~w(canceled expired))
      |> preload(:plan)
      |> Repo.one()
  end

  defp plan_for_remote(remote) do
    with code when is_binary(code) <- get_in(remote, ["metadata", "plan_code"]),
         {:ok, plan} <- fetch_plan(code) do
      plan
    else
      _no_code ->
        case StripeBilling.price_id(remote) do
          nil -> nil
          price_id -> Repo.one(from p in Plan, where: p.external_price_id == ^price_id, limit: 1)
        end
    end
  end

  defp end_remote(nil), do: {:ok, :ignored}

  defp end_remote(%Subscription{status: status}) when status in ~w(canceled expired),
    do: {:ok, :ignored}

  defp end_remote(%Subscription{} = local) do
    with {:ok, _ended} <- Repo.update(Subscription.end_changeset(local)), do: {:ok, :applied}
  end

  defp upsert_remote(local, organization_id, %Plan{} = plan, remote, status) do
    {period_start, period_end} = StripeBilling.period(remote)

    attrs = %{
      organization_id: organization_id,
      plan_id: plan.id,
      status: status,
      provider: "stripe",
      currency: plan.currency,
      current_period_start: period_start,
      current_period_end: period_end,
      trial_ends_at: StripeBilling.from_unix(remote["trial_end"]),
      cancel_at_period_end: remote["cancel_at_period_end"] == true,
      canceled_at: StripeBilling.from_unix(remote["canceled_at"]),
      ended_at: nil,
      external_customer_id: customer_id(remote["customer"]),
      external_subscription_id: remote["id"],
      grace_until: grace_for(local, status)
    }

    Repo.transaction(fn ->
      # Moving off manual billing: whatever we had issued by hand is now
      # Stripe's to collect, and chasing it ourselves as well would bill the
      # customer twice for the same month.
      if local && local.provider == "manual", do: void_open_invoices(local)

      changeset = Subscription.sync_changeset(local || %Subscription{}, attrs)

      case Repo.insert_or_update(changeset) do
        {:ok, _synced} -> :applied
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end

  # The grace is set once, at the first failure, and never extended — or a
  # subscription that never pays would never stop.
  defp grace_for(%Subscription{grace_until: %DateTime{} = grace}, "past_due"), do: grace

  defp grace_for(_local, "past_due"),
    do: DateTime.add(DateTime.utc_now(), Subscription.grace_days(), :day)

  defp grace_for(_local, _status), do: nil

  defp void_open_invoices(%Subscription{id: id}) do
    now = DateTime.utc_now()

    Invoice
    |> where([i], i.subscription_id == ^id and i.status == "open")
    |> where([i], is_nil(i.external_invoice_id))
    |> Repo.update_all(
      set: [status: "void", voided_at: now, next_attempt_at: nil, updated_at: now]
    )
  end

  defp stripe_invoice(%{} = remote, outcome) do
    {subscription_id, organization_id} = StripeBilling.invoice_subscription(remote)

    cond do
      is_nil(subscription_id) ->
        {:ok, :ignored}

      # A trial opens with an invoice for nothing. It is not a sale, and an
      # invoice for zero is a thing a customer has to read for no reason.
      (remote["total"] || 0) == 0 ->
        {:ok, :ignored}

      true ->
        with {:ok, organization_id} <- invoice_owner(subscription_id, organization_id) do
          in_tenant(organization_id, fn ->
            record_stripe_invoice(organization_id, subscription_id, remote, outcome)
          end)
        end
    end
  end

  defp invoice_owner(_subscription_id, organization_id) when is_binary(organization_id),
    do: {:ok, organization_id}

  defp invoice_owner(subscription_id, nil) do
    with {:ok, remote} <- StripeBilling.fetch_subscription(subscription_id) do
      case get_in(remote, ["metadata", "organization_id"]) do
        nil -> {:error, :unknown_organization}
        organization_id -> {:ok, organization_id}
      end
    end
  end

  defp record_stripe_invoice(organization_id, subscription_id, remote, outcome) do
    local =
      case local_for_remote(organization_id, subscription_id) do
        %Subscription{external_subscription_id: ^subscription_id} = found ->
          found

        _not_linked_yet ->
          # The invoice beat the subscription event here. Stripe promises
          # nothing about order, so link the subscription first. Straight to
          # `apply_remote/3`: this already runs in the tenant's context, and a
          # nested `with_tenant_context/2` would reset it on the way out.
          with {:ok, fetched} <- StripeBilling.fetch_subscription(subscription_id),
               status when is_binary(status) <- StripeBilling.map_status(fetched["status"]),
               {:ok, _result} <- apply_remote(organization_id, fetched, status) do
            local_for_remote(organization_id, subscription_id)
          else
            _failed -> nil
          end
      end

    if local do
      Repo.transaction(fn ->
        invoice = upsert_stripe_invoice(local, remote, outcome)
        after_stripe_invoice(local, outcome)
        invoice
      end)
      |> case do
        {:ok, _invoice} -> {:ok, :applied}
        error -> error
      end
    else
      {:error, :unknown_subscription}
    end
  end

  defp upsert_stripe_invoice(%Subscription{} = local, remote, outcome) do
    currency = String.upcase(remote["currency"] || local.currency)

    existing =
      Repo.one(
        from i in Invoice,
          where: i.organization_id == ^local.organization_id,
          where: i.external_invoice_id == ^remote["id"]
      )

    # Never on our own dunning schedule: Stripe is the one retrying the card.
    invoice =
      (existing || %Invoice{})
      |> Invoice.changeset(stripe_invoice_attrs(local, existing, remote, currency, outcome))
      |> Ecto.Changeset.change(
        Map.put(stripe_invoice_outcome(remote, currency, outcome), :next_attempt_at, nil)
      )
      |> Repo.insert_or_update!()

    replace_invoice_lines(invoice, remote, currency)
    invoice
  end

  defp stripe_invoice_attrs(local, existing, remote, currency, outcome) do
    line = get_in(remote, ["lines", "data", Access.at(0)]) || %{}

    %{
      "organization_id" => local.organization_id,
      "subscription_id" => local.id,
      "number" => (existing && existing.number) || next_invoice_number(),
      "status" => if(outcome == :paid, do: "paid", else: "open"),
      "currency" => currency,
      "subtotal" => StripeBilling.from_minor(remote["subtotal"] || remote["total"], currency),
      "tax_total" => StripeBilling.from_minor(remote["tax"] || 0, currency),
      "total" => StripeBilling.from_minor(remote["total"], currency),
      "period_start" =>
        StripeBilling.from_unix(get_in(line, ["period", "start"]) || remote["period_start"]),
      "period_end" =>
        StripeBilling.from_unix(get_in(line, ["period", "end"]) || remote["period_end"]),
      "due_at" => StripeBilling.from_unix(remote["due_date"] || remote["created"]),
      "external_invoice_id" => remote["id"]
    }
  end

  defp stripe_invoice_outcome(remote, currency, :paid) do
    paid_at = StripeBilling.from_unix(get_in(remote, ["status_transitions", "paid_at"]))

    %{
      amount_paid: StripeBilling.from_minor(remote["amount_paid"], currency),
      paid_at: paid_at || DateTime.utc_now(),
      last_error: nil
    }
  end

  defp stripe_invoice_outcome(remote, _currency, :failed) do
    %{
      attempts: remote["attempt_count"] || 1,
      last_error: "The card payment failed. Stripe will try again automatically."
    }
  end

  # Replaced wholesale, like a plan's features: an invoice's lines are a
  # definition Stripe owns, and a replayed event must not add them twice.
  defp replace_invoice_lines(%Invoice{} = invoice, remote, currency) do
    Repo.delete_all(from l in InvoiceLine, where: l.invoice_id == ^invoice.id)

    remote
    |> get_in(["lines", "data"])
    |> List.wrap()
    |> Enum.with_index()
    |> Enum.each(fn {row, index} ->
      amount = StripeBilling.from_minor(row["amount"], currency)
      quantity = row["quantity"] || 1

      %InvoiceLine{}
      |> InvoiceLine.changeset(%{
        "invoice_id" => invoice.id,
        "description" => row["description"] || "Kaarobar subscription",
        "quantity" => quantity,
        "unit_amount" => Decimal.div(amount, max(quantity, 1)),
        "amount" => amount,
        "position" => index
      })
      |> Repo.insert!()
    end)
  end

  defp after_stripe_invoice(%Subscription{} = local, :paid) do
    if local.status == "past_due" do
      Repo.update!(Ecto.Changeset.change(local, status: "active", grace_until: nil))
    end
  end

  defp after_stripe_invoice(%Subscription{status: status}, :failed)
       when status in ~w(canceled expired),
       do: :ok

  defp after_stripe_invoice(%Subscription{} = local, :failed) do
    Repo.update!(Subscription.past_due_changeset(local))
  end

  defp customer_id(%{"id" => id}), do: id
  defp customer_id(id), do: id

  # A webhook has no tenant until we read one off the event, and every table it
  # touches is behind row-level security. Unwraps the transaction result so
  # the handlers above can return plain `{:ok, :applied}`.
  defp in_tenant(organization_id, fun) do
    Repo.with_tenant_context(organization_id, fn ->
      case fun.() do
        {:ok, :applied} -> {:ok, :applied}
        {:ok, :ignored} -> {:ok, :ignored}
        {:ok, _other} -> {:ok, :applied}
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  defp require_subscription(%Scope{} = scope) do
    case subscription(scope) do
      nil -> {:error, :no_subscription}
      subscription -> {:ok, subscription}
    end
  end

  defp ensure_available(%Plan{} = plan) do
    if Plan.available?(plan), do: :ok, else: {:error, :plan_unavailable}
  end

  # A card-billed subscription is changed on Stripe and synced back here by
  # webhook. Changing our copy directly would leave Stripe charging for the
  # old plan, or charging at all after a cancel, and the two would disagree
  # about what the customer is paying for.
  defp ensure_self_managed(%Subscription{provider: "stripe"}), do: {:error, :managed_by_provider}
  defp ensure_self_managed(%Subscription{}), do: :ok

  # `require_payment: true` — which the API passes whenever card billing is
  # set up — refuses to start a paid plan with no trial and no payment behind
  # it. That has to go through Checkout instead; otherwise it would be a
  # month of service for a click.
  defp ensure_paid_for(%Plan{} = plan, trial_ends, opts) do
    if Keyword.get(opts, :require_payment, false) and is_nil(trial_ends) and not Plan.free?(plan),
      do: {:error, :checkout_required},
      else: :ok
  end

  defp ensure_checkout_enabled do
    if StripeBilling.configured?(), do: :ok, else: {:error, :billing_not_configured}
  end

  defp ensure_not_card_billed(%Subscription{provider: "stripe"}),
    do: {:error, :already_subscribed}

  defp ensure_not_card_billed(_manual_or_none), do: :ok

  defp billing_account(%Subscription{external_customer_id: id}) when is_binary(id) and id != "",
    do: {:ok, id}

  defp billing_account(_subscription), do: {:error, :no_billing_account}

  defp carried_trial_end(%Subscription{} = subscription) do
    if Subscription.trialing?(subscription), do: subscription.trial_ends_at
  end

  defp carried_trial_end(nil), do: nil

  # Somebody paying straight away for their first subscription still gets the
  # plan's trial — card first, charged when it ends — rather than losing it
  # for having skipped the no-card version.
  defp first_trial_end(scope, nil, %Plan{trial_days: days} = plan) when days > 0 do
    if trial_eligible?(scope), do: trial_end(plan, DateTime.utc_now(), [])
  end

  defp first_trial_end(_scope, _current, _plan), do: nil

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
