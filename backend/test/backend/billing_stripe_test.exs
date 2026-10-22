defmodule Kaarobar.BillingStripeTest do
  @moduledoc """
  Card billing for subscriptions: Checkout, the portal, and the webhooks that
  bring our copy of a subscription into line with Stripe's.

  The properties worth protecting: a replayed or out-of-order event never
  doubles anything, a card-billed subscription is never changed behind
  Stripe's back, and a trial with no card behind it does eventually end.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Billing
  alias Kaarobar.Billing.Invoice
  alias Kaarobar.Billing.Subscription
  alias Kaarobar.BillingStripeStub
  alias Kaarobar.Repo

  setup do
    %{scope: scope, organization: organization} = owner_scope()
    %{scope: scope, organization: organization}
  end

  defp plan_fixture(attrs \\ %{}) do
    defaults = %{
      "code" => "standard-#{System.unique_integer([:positive])}",
      "name" => "Standard",
      "interval" => "month",
      "currency" => "PKR",
      "amount" => "6500.00",
      "trial_days" => 14
    }

    {:ok, plan} = Billing.create_plan(Map.merge(defaults, attrs))
    {:ok, plan} = Billing.set_plan_features(plan, [{"pos", true}])
    plan
  end

  defp urls, do: [success_url: "http://app.test/ok", cancel_url: "http://app.test/no"]

  defp unix(%DateTime{} = at), do: DateTime.to_unix(at)

  defp remote_subscription(organization, plan, attrs \\ %{}) do
    now = DateTime.utc_now()

    Map.merge(
      %{
        "id" => "sub_#{System.unique_integer([:positive])}",
        "object" => "subscription",
        "status" => "active",
        "customer" => "cus_123",
        "cancel_at_period_end" => false,
        "current_period_start" => unix(now),
        "current_period_end" => unix(DateTime.add(now, 30, :day)),
        "metadata" => %{"organization_id" => organization.id, "plan_code" => plan.code}
      },
      attrs
    )
  end

  defp event(type, object),
    do: %{"id" => "evt_1", "type" => type, "data" => %{"object" => object}}

  defp live(organization) do
    Repo.one(
      from s in Subscription,
        where: s.organization_id == ^organization.id and s.status not in ~w(canceled expired)
    )
  end

  # ===========================================================================
  # Checkout
  # ===========================================================================

  describe "checkout/3" do
    test "opens a subscription session that says whose it is", ctx do
      plan = plan_fixture()
      BillingStripeStub.respond({:ok, %{"id" => "cs_1", "url" => "https://checkout.test/cs_1"}})

      assert {:ok, %{id: "cs_1", url: "https://checkout.test/cs_1"}} =
               Billing.checkout(ctx.scope, plan.code, urls())

      %{url: url, body: body} = BillingStripeStub.last_request()
      assert url =~ "/v1/checkout/sessions"
      assert body["mode"] == "subscription"
      assert body["client_reference_id"] == ctx.organization.id
      assert body["subscription_data[metadata][organization_id]"] == ctx.organization.id
      assert body["subscription_data[metadata][plan_code]"] == plan.code
      assert body["customer_email"] == ctx.scope.user.email
    end

    test "describes the price inline when the plan has no Stripe price", ctx do
      plan = plan_fixture(%{"amount" => "2500.00"})
      BillingStripeStub.respond({:ok, %{"id" => "cs_1", "url" => "u"}})

      Billing.checkout(ctx.scope, plan.code, urls())

      body = BillingStripeStub.last_request().body
      assert body["line_items[0][price_data][currency]"] == "pkr"
      assert body["line_items[0][price_data][unit_amount]"] == "250000"
      assert body["line_items[0][price_data][recurring][interval]"] == "month"
      refute Map.has_key?(body, "line_items[0][price]")
    end

    test "refers to the Stripe price when the plan has one", ctx do
      plan = plan_fixture(%{"external_price_id" => "price_abc"})
      BillingStripeStub.respond({:ok, %{"id" => "cs_1", "url" => "u"}})

      Billing.checkout(ctx.scope, plan.code, urls())

      body = BillingStripeStub.last_request().body
      assert body["line_items[0][price]"] == "price_abc"
      refute Map.has_key?(body, "line_items[0][price_data][currency]")
    end

    test "carries a running trial over, so paying early costs no days", ctx do
      plan = plan_fixture(%{"trial_days" => 14})
      {:ok, trial} = Billing.subscribe(ctx.scope, plan.code)
      BillingStripeStub.respond({:ok, %{"id" => "cs_1", "url" => "u"}})

      Billing.checkout(ctx.scope, plan.code, urls())

      body = BillingStripeStub.last_request().body
      assert body["subscription_data[trial_end]"] == to_string(unix(trial.trial_ends_at))
    end

    test "is refused for a subscription that is already paid by card", ctx do
      plan = plan_fixture()

      {:ok, :applied} =
        Billing.apply_stripe_event(
          event("customer.subscription.created", remote_subscription(ctx.organization, plan))
        )

      assert {:error, :already_subscribed} = Billing.checkout(ctx.scope, plan.code, urls())
    end

    test "an unknown plan is not found", ctx do
      assert {:error, :not_found} = Billing.checkout(ctx.scope, "nope", urls())
    end
  end

  describe "portal/2" do
    test "needs a card billing account first", ctx do
      plan = plan_fixture()
      {:ok, _trial} = Billing.subscribe(ctx.scope, plan.code)

      assert {:error, :no_billing_account} = Billing.portal(ctx.scope, "http://app.test")
    end

    test "opens the portal for the organization's Stripe customer", ctx do
      plan = plan_fixture()

      {:ok, :applied} =
        Billing.apply_stripe_event(
          event("customer.subscription.created", remote_subscription(ctx.organization, plan))
        )

      BillingStripeStub.respond({:ok, %{"url" => "https://portal.test"}})

      assert {:ok, %{url: "https://portal.test"}} = Billing.portal(ctx.scope, "http://app.test")
      assert BillingStripeStub.last_request().body["customer"] == "cus_123"
    end
  end

  # ===========================================================================
  # Webhooks
  # ===========================================================================

  describe "handle_stripe_webhook/2" do
    test "a bad signature is rejected before anything is read" do
      body = Jason.encode!(%{"type" => "invoice.paid"})

      assert {:error, {:signature_rejected, :signature_invalid}} =
               Billing.handle_stripe_webhook(body, %{
                 "stripe-signature" => "t=#{System.system_time(:second)},v1=deadbeef"
               })
    end

    test "a correctly signed event is applied", ctx do
      plan = plan_fixture()

      body =
        Jason.encode!(
          event("customer.subscription.created", remote_subscription(ctx.organization, plan))
        )

      assert {:ok, :applied} =
               Billing.handle_stripe_webhook(body, %{"stripe-signature" => sign(body)})

      assert %Subscription{provider: "stripe"} = live(ctx.organization)
    end
  end

  describe "subscription events" do
    test "the first one converts the running trial rather than adding a second", ctx do
      plan = plan_fixture()
      {:ok, trial} = Billing.subscribe(ctx.scope, plan.code)
      remote = remote_subscription(ctx.organization, plan, %{"status" => "trialing"})

      assert {:ok, :applied} =
               Billing.apply_stripe_event(event("customer.subscription.created", remote))

      synced = live(ctx.organization)
      assert synced.id == trial.id
      assert synced.provider == "stripe"
      assert synced.status == "trialing"
      assert synced.external_subscription_id == remote["id"]
      assert synced.external_customer_id == "cus_123"
    end

    test "manual invoices are voided once Stripe takes over collecting", ctx do
      plan = plan_fixture(%{"trial_days" => 0})
      {:ok, manual} = Billing.subscribe(ctx.scope, plan.code)
      {:ok, invoice} = Billing.issue_invoice(manual)

      Billing.apply_stripe_event(
        event("customer.subscription.created", remote_subscription(ctx.organization, plan))
      )

      assert %Invoice{status: "void", next_attempt_at: nil} = Repo.get!(Invoice, invoice.id)
    end

    test "replaying an update changes nothing the second time", ctx do
      plan = plan_fixture()
      remote = remote_subscription(ctx.organization, plan, %{"cancel_at_period_end" => true})

      Billing.apply_stripe_event(event("customer.subscription.updated", remote))
      Billing.apply_stripe_event(event("customer.subscription.updated", remote))

      assert [%Subscription{cancel_at_period_end: true}] =
               Repo.all(from s in Subscription, where: s.organization_id == ^ctx.organization.id)
    end

    test "reads the period off the item, where newer API versions put it", ctx do
      plan = plan_fixture()
      ends = DateTime.add(DateTime.utc_now(), 30, :day)

      remote =
        ctx.organization
        |> remote_subscription(plan)
        |> Map.drop(["current_period_start", "current_period_end"])
        |> Map.put("items", %{
          "data" => [
            %{
              "current_period_start" => unix(DateTime.utc_now()),
              "current_period_end" => unix(ends)
            }
          ]
        })

      Billing.apply_stripe_event(event("customer.subscription.updated", remote))

      assert DateTime.to_unix(live(ctx.organization).current_period_end) == unix(ends)
    end

    test "a deleted subscription ends ours", ctx do
      plan = plan_fixture()
      remote = remote_subscription(ctx.organization, plan)
      Billing.apply_stripe_event(event("customer.subscription.created", remote))

      Billing.apply_stripe_event(
        event("customer.subscription.deleted", %{remote | "status" => "canceled"})
      )

      assert live(ctx.organization) == nil
    end

    test "an incomplete checkout is not a subscription and changes nothing", ctx do
      plan = plan_fixture()
      remote = remote_subscription(ctx.organization, plan, %{"status" => "incomplete"})

      assert {:ok, :ignored} =
               Billing.apply_stripe_event(event("customer.subscription.created", remote))

      assert live(ctx.organization) == nil
    end

    test "one that isn't ours is ignored" do
      plan = plan_fixture()

      remote = %{
        "id" => "sub_other",
        "status" => "active",
        "metadata" => %{"plan_code" => plan.code}
      }

      assert {:ok, :ignored} =
               Billing.apply_stripe_event(event("customer.subscription.created", remote))
    end
  end

  describe "invoice events" do
    setup ctx do
      plan = plan_fixture()
      remote = remote_subscription(ctx.organization, plan)
      {:ok, :applied} = Billing.apply_stripe_event(event("customer.subscription.created", remote))
      %{plan: plan, remote: remote}
    end

    defp remote_invoice(ctx, attrs \\ %{}) do
      Map.merge(
        %{
          "id" => "in_1",
          "object" => "invoice",
          "currency" => "pkr",
          "total" => 650_000,
          "subtotal" => 650_000,
          "amount_paid" => 650_000,
          "attempt_count" => 1,
          "subscription" => ctx.remote["id"],
          "subscription_details" => %{"metadata" => %{"organization_id" => ctx.organization.id}},
          "lines" => %{
            "data" => [
              %{"description" => "1 × Kaarobar Standard", "quantity" => 1, "amount" => 650_000}
            ]
          }
        },
        attrs
      )
    end

    test "a failed payment opens the grace, and is not chased by our dunning", ctx do
      assert {:ok, :applied} =
               Billing.apply_stripe_event(event("invoice.payment_failed", remote_invoice(ctx)))

      assert %Subscription{status: "past_due", grace_until: %DateTime{}} = live(ctx.organization)

      invoice = Repo.get_by!(Invoice, external_invoice_id: "in_1")
      assert invoice.status == "open"
      assert invoice.next_attempt_at == nil
      assert Decimal.equal?(invoice.total, Decimal.new("6500.00"))
    end

    test "payment afterwards closes the grace, on the same invoice", ctx do
      Billing.apply_stripe_event(event("invoice.payment_failed", remote_invoice(ctx)))
      Billing.apply_stripe_event(event("invoice.paid", remote_invoice(ctx)))
      Billing.apply_stripe_event(event("invoice.paid", remote_invoice(ctx)))

      assert %Subscription{status: "active", grace_until: nil} = live(ctx.organization)

      assert [%Invoice{status: "paid"} = invoice] =
               Repo.all(
                 from i in Invoice, where: i.external_invoice_id == "in_1", preload: :lines
               )

      assert [_one_line] = invoice.lines
    end

    test "the zero invoice a trial opens with is not recorded", ctx do
      assert {:ok, :ignored} =
               Billing.apply_stripe_event(
                 event("invoice.paid", remote_invoice(ctx, %{"total" => 0}))
               )

      refute Repo.get_by(Invoice, external_invoice_id: "in_1")
    end

    test "newer payloads carry the subscription under parent", ctx do
      invoice =
        ctx
        |> remote_invoice()
        |> Map.drop(["subscription", "subscription_details"])
        |> Map.put("parent", %{
          "subscription_details" => %{
            "subscription" => ctx.remote["id"],
            "metadata" => %{"organization_id" => ctx.organization.id}
          }
        })

      assert {:ok, :applied} = Billing.apply_stripe_event(event("invoice.paid", invoice))
      assert Repo.get_by!(Invoice, external_invoice_id: "in_1").status == "paid"
    end
  end

  describe "an invoice that arrives before its subscription" do
    test "links the subscription first", ctx do
      plan = plan_fixture()
      remote = remote_subscription(ctx.organization, plan)
      BillingStripeStub.respond({:ok, remote})

      invoice = %{
        "id" => "in_early",
        "currency" => "pkr",
        "total" => 650_000,
        "amount_paid" => 650_000,
        "subscription" => remote["id"],
        "lines" => %{"data" => []}
      }

      assert {:ok, :applied} = Billing.apply_stripe_event(event("invoice.paid", invoice))
      assert %Subscription{provider: "stripe"} = live(ctx.organization)
      assert Repo.get_by!(Invoice, external_invoice_id: "in_early").status == "paid"
    end
  end

  # ===========================================================================
  # Card-billed subscriptions are changed on Stripe
  # ===========================================================================

  describe "a card-billed subscription" do
    setup ctx do
      plan = plan_fixture()

      Billing.apply_stripe_event(
        event("customer.subscription.created", remote_subscription(ctx.organization, plan))
      )

      %{plan: plan}
    end

    test "cannot be cancelled, changed or resized here", ctx do
      other = plan_fixture()

      assert {:error, :managed_by_provider} = Billing.cancel(ctx.scope)
      assert {:error, :managed_by_provider} = Billing.change_plan(ctx.scope, other.code)
      assert {:error, :managed_by_provider} = Billing.set_quantity(ctx.scope, "seats", 3)
      assert {:error, :managed_by_provider} = Billing.resume(ctx.scope)
    end
  end

  describe "subscribing without a trial" do
    test "invoices the first period straight away", ctx do
      plan = plan_fixture(%{"trial_days" => 0})

      {:ok, subscription} = Billing.subscribe(ctx.scope, plan.code)

      assert subscription.status == "active"

      assert [%Invoice{status: "open", next_attempt_at: %DateTime{}} = invoice] =
               Repo.all(from i in Invoice, where: i.subscription_id == ^subscription.id)

      assert Decimal.equal?(invoice.total, Decimal.new("6500.00"))
      # A week's terms: not overdue the moment it exists, and not chased before.
      refute Invoice.overdue?(invoice)
      assert DateTime.diff(invoice.due_at, DateTime.utc_now(), :day) in 6..7
      assert invoice.next_attempt_at == invoice.due_at
    end

    test "but not for a free plan, or during a trial", ctx do
      free = plan_fixture(%{"trial_days" => 0, "amount" => "0"})
      {:ok, subscription} = Billing.subscribe(ctx.scope, free.code)

      assert Repo.all(from i in Invoice, where: i.subscription_id == ^subscription.id) == []
    end
  end

  describe "trial eligibility" do
    test "only an organization's first subscription gets a trial", ctx do
      plan = plan_fixture(%{"trial_days" => 14})
      assert Billing.trial_eligible?(ctx.scope)

      {:ok, first} = Billing.subscribe(ctx.scope, plan.code)
      assert first.status == "trialing"
      {:ok, _ended} = Billing.cancel(ctx.scope, immediate: true)

      refute Billing.trial_eligible?(ctx.scope)
      {:ok, second} = Billing.subscribe(ctx.scope, plan.code)
      assert second.status == "active"
      assert second.trial_ends_at == nil
    end

    test "paying first still gets the plan's trial on Stripe", ctx do
      plan = plan_fixture(%{"trial_days" => 14})
      BillingStripeStub.respond({:ok, %{"id" => "cs_1", "url" => "u"}})

      Billing.checkout(ctx.scope, plan.code, urls())

      assert BillingStripeStub.last_request().body["subscription_data[trial_end]"]
    end

    test "but not once the organization has had a subscription", ctx do
      plan = plan_fixture(%{"trial_days" => 14})
      {:ok, _first} = Billing.subscribe(ctx.scope, plan.code)
      {:ok, _ended} = Billing.cancel(ctx.scope, immediate: true)
      BillingStripeStub.respond({:ok, %{"id" => "cs_1", "url" => "u"}})

      Billing.checkout(ctx.scope, plan.code, urls())

      refute Map.has_key?(BillingStripeStub.last_request().body, "subscription_data[trial_end]")
    end
  end

  # ===========================================================================
  # Trials
  # ===========================================================================

  describe "convert_ended_trials/1" do
    test "starts the first paid period and issues its invoice", ctx do
      plan = plan_fixture()
      {:ok, trial} = Billing.subscribe(ctx.scope, plan.code)
      later = DateTime.add(trial.trial_ends_at, 1, :hour)

      assert Billing.convert_ended_trials(later) == 1

      converted = Repo.get!(Subscription, trial.id)
      assert converted.status == "active"
      assert converted.current_period_start == trial.trial_ends_at

      assert [%Invoice{status: "open", next_attempt_at: %DateTime{}}] =
               Repo.all(from i in Invoice, where: i.subscription_id == ^trial.id)
    end

    test "leaves a trial that is still running alone", ctx do
      plan = plan_fixture()
      {:ok, _trial} = Billing.subscribe(ctx.scope, plan.code)

      assert Billing.convert_ended_trials(DateTime.utc_now()) == 0
    end

    test "issues nothing on a free plan", ctx do
      plan = plan_fixture(%{"amount" => "0"})
      {:ok, trial} = Billing.subscribe(ctx.scope, plan.code)

      Billing.convert_ended_trials(DateTime.add(trial.trial_ends_at, 1, :hour))

      assert Repo.get!(Subscription, trial.id).status == "active"
      assert Repo.all(from i in Invoice, where: i.subscription_id == ^trial.id) == []
    end

    test "leaves a card-billed trial to Stripe", ctx do
      plan = plan_fixture()
      ends = DateTime.add(DateTime.utc_now(), -1, :hour)

      remote =
        remote_subscription(ctx.organization, plan, %{
          "status" => "trialing",
          "trial_end" => unix(ends)
        })

      Billing.apply_stripe_event(event("customer.subscription.created", remote))

      assert Billing.convert_ended_trials(DateTime.utc_now()) == 0
    end
  end

  # Stripe signs `timestamp.body` with the endpoint secret; the test config's
  # secret is what the verifier will check against.
  defp sign(body) do
    timestamp = System.system_time(:second)

    signature =
      :hmac
      |> :crypto.mac(:sha256, "whsec_test_kaarobar", "#{timestamp}.#{body}")
      |> Base.encode16(case: :lower)

    "t=#{timestamp},v1=#{signature}"
  end
end
