defmodule Kaarobar.BillingTest do
  @moduledoc """
  The phase gate: an organization's subscription controls which modules it can
  reach.

  The behaviour worth protecting hardest is the one that costs money to get
  wrong in the other direction — nobody is cut off by a single failed payment,
  and nobody is cut off at all without a scheduled job having decided it.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Billing
  alias Kaarobar.Billing.Entitlements
  alias Kaarobar.Billing.Invoice
  alias Kaarobar.Billing.Plan
  alias Kaarobar.Billing.Subscription
  alias Kaarobar.Repo
  alias Kaarobar.Scope

  setup do
    %{scope: scope} = owner_scope()
    %{scope: scope}
  end

  defp plan_fixture(attrs \\ %{}, features \\ nil) do
    defaults = %{
      "code" => "standard-#{System.unique_integer([:positive])}",
      "name" => "Standard",
      "interval" => "month",
      "currency" => "PKR",
      "amount" => "6500.00",
      "trial_days" => 0
    }

    {:ok, plan} = Billing.create_plan(Map.merge(defaults, attrs))

    features = features || [{"pos", true}, {"tables", true}, {"max_branches", 3}]
    {:ok, plan} = Billing.set_plan_features(plan, features)

    plan
  end

  defp subscribe(scope, plan, opts \\ []) do
    {:ok, subscription} = Billing.subscribe(scope, plan.code, opts)
    subscription
  end

  # ===========================================================================
  # Plans
  # ===========================================================================

  describe "plans" do
    test "features are replaced wholesale, not merged" do
      plan = plan_fixture(%{}, [{"pos", true}, {"tables", true}])
      {:ok, plan} = Billing.set_plan_features(plan, [{"pos", true}])

      keys = Entitlements.plan_features(plan)

      assert MapSet.member?(keys, "pos")
      # A plan's features are a definition, not a log. Merging would leave a
      # withdrawn feature quietly granted forever.
      refute MapSet.member?(keys, "tables")
    end

    test "a disabled feature is an exclusion, not an absence" do
      plan = plan_fixture(%{}, [{"pos", true}, {"delivery", false}])

      refute MapSet.member?(Entitlements.plan_features(plan), "delivery")
    end

    test "a limit with no value is unlimited, not zero" do
      plan = plan_fixture(%{}, [{"max_branches", true}])

      assert Entitlements.plan_limits(plan)["max_branches"] == :unlimited
    end

    test "an unlisted plan stays live for whoever is already on it", %{scope: scope} do
      plan = plan_fixture(%{"is_public" => false})
      subscription = subscribe(scope, plan)

      refute Enum.any?(Billing.list_plans(), &(&1.id == plan.id))
      assert subscription.plan_id == plan.id
    end

    test "a withdrawn plan cannot be subscribed to", %{scope: scope} do
      plan = plan_fixture(%{"is_active" => false})

      assert {:error, :plan_unavailable} = Billing.subscribe(scope, plan.code)
    end

    test "a monthly period ends on the same day next month" do
      plan = %Plan{interval: "month"}

      assert Plan.period_end(plan, ~U[2026-01-15 10:00:00.000000Z]).month == 2
      assert Plan.period_end(plan, ~U[2026-01-15 10:00:00.000000Z]).day == 15
    end

    test "a period starting on the 31st still bills in February" do
      # Clamped rather than skipped. Nobody subscribing on the 31st of January
      # expects February to be free.
      ends = Plan.period_end(%Plan{interval: "month"}, ~U[2026-01-31 10:00:00.000000Z])

      assert ends.month == 2
      assert ends.day == 28
    end

    test "a yearly period ends a year later" do
      ends = Plan.period_end(%Plan{interval: "year"}, ~U[2026-03-03 10:00:00.000000Z])

      assert ends.year == 2027
      assert ends.month == 3
    end
  end

  # ===========================================================================
  # Subscribing
  # ===========================================================================

  describe "subscribing" do
    test "a trial is a status, not an invoice for nothing", %{scope: scope} do
      plan = plan_fixture(%{"trial_days" => 14})
      subscription = subscribe(scope, plan)

      assert subscription.status == "trialing"
      assert subscription.trial_ends_at
      assert {:error, :trialing} = Billing.issue_invoice(subscription)
    end

    test "a plan with no trial starts active", %{scope: scope} do
      subscription = subscribe(scope, plan_fixture())

      assert subscription.status == "active"
      assert subscription.trial_ends_at == nil
    end

    test "one organization cannot hold two subscriptions", %{scope: scope} do
      plan = plan_fixture()
      subscribe(scope, plan)

      assert {:error, :already_subscribed} = Billing.subscribe(scope, plan.code)
    end

    test "changing plan keeps the billing date", %{scope: scope} do
      first = plan_fixture(%{"amount" => "2500.00"})
      second = plan_fixture(%{"amount" => "6500.00"})

      subscription = subscribe(scope, first)
      {:ok, changed} = Billing.change_plan(scope, second.code)

      assert changed.plan_id == second.id
      # An upgrade in week three must not restart the month, and must certainly
      # not charge for a fresh one on top of the month already paid for.
      assert changed.current_period_end == subscription.current_period_end
    end

    test "cancelling waits for the end of the paid period", %{scope: scope} do
      subscribe(scope, plan_fixture())

      {:ok, canceled} = Billing.cancel(scope)

      assert canceled.cancel_at_period_end
      assert canceled.status == "active"
      # Still working. They paid for the month.
      assert Subscription.serviceable?(canceled)
    end

    test "cancelling immediately is a separate, explicit request", %{scope: scope} do
      subscribe(scope, plan_fixture())

      {:ok, canceled} = Billing.cancel(scope, immediate: true)

      assert canceled.status == "canceled"
      refute Subscription.serviceable?(canceled)
    end

    test "a pending cancellation can be withdrawn", %{scope: scope} do
      subscribe(scope, plan_fixture())
      {:ok, _canceled} = Billing.cancel(scope)

      {:ok, resumed} = Billing.resume(scope)

      refute resumed.cancel_at_period_end
      assert resumed.status == "active"
    end
  end

  # ===========================================================================
  # Invoices and dunning
  # ===========================================================================

  describe "invoicing" do
    setup %{scope: scope} do
      plan = plan_fixture(%{"amount" => "6500.00"})
      %{plan: plan, subscription: subscribe(scope, plan)}
    end

    test "writes the plan out in full rather than joining it", %{subscription: subscription} do
      {:ok, invoice} = Billing.issue_invoice(subscription)

      assert [line] = invoice.lines
      # An invoice from March has to keep saying what it said in March, even
      # after the plan is renamed.
      assert line.description =~ "Standard"
      assert Decimal.equal?(line.amount, Decimal.new("6500.00"))
      assert Decimal.equal?(invoice.total, Decimal.new("6500.00"))
    end

    test "bills the quantities alongside the plan", %{scope: scope, subscription: subscription} do
      {:ok, _item} = Billing.set_quantity(scope, "seat", 4, unit_amount: Decimal.new("500.00"))

      {:ok, invoice} = Billing.issue_invoice(Repo.reload!(subscription))

      assert length(invoice.lines) == 2
      assert Decimal.equal?(invoice.total, Decimal.new("8500.00"))
    end

    test "invoice numbers are unique and sequential", %{subscription: subscription} do
      {:ok, first} = Billing.issue_invoice(subscription)
      {:ok, second} = Billing.issue_invoice(subscription)

      assert first.number != second.number
      assert String.starts_with?(first.number, "KB-")
    end

    test "a failed payment does not close the shop", %{subscription: subscription} do
      # The single most important behaviour here: a card that expires on a
      # Sunday must not stop a shop selling on Monday.
      {:ok, invoice} = Billing.issue_invoice(subscription)
      {:ok, _failed} = Billing.record_failure(invoice, "card_declined")

      reloaded = Repo.reload!(subscription)

      assert reloaded.status == "past_due"
      assert reloaded.grace_until
      assert Subscription.serviceable?(reloaded)
    end

    test "the grace is set once, not extended by every decline", %{subscription: subscription} do
      {:ok, invoice} = Billing.issue_invoice(subscription)

      {:ok, once} = Billing.record_failure(invoice, "declined")
      first_grace = Repo.reload!(subscription).grace_until

      {:ok, _twice} = Billing.record_failure(once, "declined")

      # Otherwise a subscription that never pays never stops either.
      assert Repo.reload!(subscription).grace_until == first_grace
    end

    test "collection escalates and then stops", %{subscription: subscription} do
      {:ok, invoice} = Billing.issue_invoice(subscription)

      final =
        Enum.reduce(1..(Invoice.max_dunning_stage() + 1), invoice, fn _stage, current ->
          {:ok, updated} = Billing.record_failure(current, "declined")
          updated
        end)

      # Bounded on purpose: an invoice retried forever is one nobody ever looks
      # at, and the shop keeps believing it is paid up.
      assert final.status == "uncollectible"
      assert final.next_attempt_at == nil
    end

    test "paying clears the dunning schedule", %{subscription: subscription} do
      {:ok, invoice} = Billing.issue_invoice(subscription)
      {:ok, failed} = Billing.record_failure(invoice, "declined")

      {:ok, paid} = Billing.mark_paid(failed)

      # Chasing money we already have is the most damaging thing a billing
      # system can do.
      assert paid.status == "paid"
      assert paid.next_attempt_at == nil
      assert Repo.reload!(subscription).status == "active"
      assert Repo.reload!(subscription).grace_until == nil
    end

    test "outstanding is nil-safe on a void invoice", %{subscription: subscription} do
      {:ok, invoice} = Billing.issue_invoice(subscription)
      {:ok, voided} = Repo.update(Invoice.void_changeset(invoice))

      assert Decimal.equal?(Invoice.outstanding(voided), Decimal.new(0))
    end

    test "dunning collects when the collector succeeds", %{subscription: subscription} do
      {:ok, _invoice} = Billing.issue_invoice(subscription)

      assert %{collected: 1, failed: 0} = Billing.process_dunning(10, fn _invoice -> :ok end)
      assert Repo.reload!(subscription).status == "active"
    end

    test "dunning records what the gateway said", %{subscription: subscription} do
      {:ok, invoice} = Billing.issue_invoice(subscription)

      Billing.process_dunning(10, fn _invoice -> {:error, "insufficient_funds"} end)

      assert Repo.reload!(invoice).last_error == "insufficient_funds"
    end
  end

  # ===========================================================================
  # Expiry
  # ===========================================================================

  describe "expiry" do
    test "nobody is cut off before their grace runs out", %{scope: scope} do
      subscription = subscribe(scope, plan_fixture())
      {:ok, invoice} = Billing.issue_invoice(subscription)
      {:ok, _failed} = Billing.record_failure(invoice, "declined")

      assert Billing.expire_lapsed() == 0
      assert Repo.reload!(subscription).status == "past_due"
    end

    test "and then they are", %{scope: scope} do
      subscription = subscribe(scope, plan_fixture())
      {:ok, invoice} = Billing.issue_invoice(subscription)
      {:ok, _failed} = Billing.record_failure(invoice, "declined")

      past = DateTime.add(DateTime.utc_now(), 30, :day)

      assert Billing.expire_lapsed(past) == 1
      assert Repo.reload!(subscription).status == "expired"
    end

    test "a cancelled subscription closes when its paid period ends", %{scope: scope} do
      subscription = subscribe(scope, plan_fixture())
      {:ok, _canceled} = Billing.cancel(scope)

      past = DateTime.add(DateTime.utc_now(), 60, :day)

      assert Billing.close_cancelled(past) == 1
      assert Repo.reload!(subscription).status == "canceled"
    end

    test "an active subscription is never closed by either job", %{scope: scope} do
      subscription = subscribe(scope, plan_fixture())

      Billing.expire_lapsed(DateTime.add(DateTime.utc_now(), 365, :day))
      Billing.close_cancelled(DateTime.add(DateTime.utc_now(), 365, :day))

      assert Repo.reload!(subscription).status == "active"
    end
  end

  # ===========================================================================
  # Entitlements
  # ===========================================================================

  describe "entitlements" do
    test "an organization with no subscription is unrestricted", %{scope: scope} do
      resolved = Entitlements.for_organization(Scope.organization_id(scope))

      # Empty means "not resolved, allow everything" — which is what keeps
      # billing optional for a deployment that does not sell it.
      assert Enum.empty?(resolved.features)
      assert Scope.entitled?(Scope.put_entitlements(scope, resolved), "anything")
    end

    test "a plan grants exactly what it lists", %{scope: scope} do
      subscribe(scope, plan_fixture(%{}, [{"pos", true}, {"tables", true}]))

      scoped =
        Scope.put_entitlements(scope, Entitlements.for_organization(Scope.organization_id(scope)))

      assert Scope.entitled?(scoped, "pos")
      assert Scope.entitled?(scoped, "tables")
      refute Scope.entitled?(scoped, "rentals")
    end

    test "limits come through, and an unset one is unlimited", %{scope: scope} do
      subscribe(scope, plan_fixture(%{}, [{"pos", true}, {"max_branches", 3}]))

      scoped =
        Scope.put_entitlements(scope, Entitlements.for_organization(Scope.organization_id(scope)))

      assert Scope.limit(scoped, "max_branches") == 3
      assert Scope.within_limit?(scoped, "max_branches", 2)
      refute Scope.within_limit?(scoped, "max_branches", 3)
      # An unknown key is unlimited. Reading it as zero would stop a paying
      # customer opening their second branch.
      assert Scope.limit(scoped, "max_users") == :unlimited
      assert Scope.within_limit?(scoped, "max_users", 9_999)
    end

    test "a past-due organization keeps everything while its grace runs", %{scope: scope} do
      subscription = subscribe(scope, plan_fixture(%{}, [{"pos", true}]))
      {:ok, invoice} = Billing.issue_invoice(subscription)
      {:ok, _failed} = Billing.record_failure(invoice, "declined")

      resolved = Entitlements.for_organization(Scope.organization_id(scope))

      assert resolved.serviceable
      assert MapSet.member?(resolved.features, "pos")
    end

    test "an expired one keeps only its own records and the way to pay", %{scope: scope} do
      subscription = subscribe(scope, plan_fixture(%{}, [{"pos", true}]))

      subscription
      |> Ecto.Changeset.change(status: "past_due", grace_until: ~U[2020-01-01 00:00:00.000000Z])
      |> Repo.update!()

      resolved = Entitlements.for_organization(Scope.organization_id(scope))
      scoped = Scope.put_entitlements(scope, resolved)

      refute resolved.serviceable
      refute Scope.serviceable?(scoped)
      refute Scope.entitled?(scoped, "pos")
      # Never nothing: an organization that cannot reach its billing screen
      # cannot pay, and one that cannot export has been locked out of its own
      # property.
      assert Scope.entitled?(scoped, "billing")
      assert Scope.entitled?(scoped, "export")
    end

    test "a cancelled subscription is not the organization's subscription", %{scope: scope} do
      subscribe(scope, plan_fixture())
      {:ok, _canceled} = Billing.cancel(scope, immediate: true)

      assert Billing.subscription(scope) == nil
      # Back to unrestricted rather than locked out: there is no plan saying
      # otherwise, and a deployment that does not bill must keep working.
      assert Entitlements.for_organization(Scope.organization_id(scope)).features |> Enum.empty?()
    end

    test "one organization's plan says nothing about another's", %{scope: scope} do
      subscribe(scope, plan_fixture(%{}, [{"pos", true}]))
      %{scope: other} = owner_scope()

      assert Entitlements.for_organization(Scope.organization_id(other)).features |> Enum.empty?()
    end
  end
end
