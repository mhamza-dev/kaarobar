defmodule KaarobarWeb.BillingControllerTest do
  use KaarobarWeb.ConnCase, async: true

  alias Kaarobar.Billing
  alias Kaarobar.BillingStripeStub

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
    {:ok, plan} = Billing.set_plan_features(plan, [{"pos", true}, {"max_branches", 3}])
    plan
  end

  describe "GET /api/v1/plans" do
    test "is public, so the pricing page can show it before anyone signs up", %{conn: conn} do
      plan = plan_fixture()
      plan_fixture(%{"is_public" => false})

      response = get(conn, ~p"/api/v1/plans")
      body = json_response(response, 200)

      codes = Enum.map(body["data"], & &1["code"])
      assert plan.code in codes
      assert Enum.all?(body["data"], & &1["is_public"])

      listed = Enum.find(body["data"], &(&1["code"] == plan.code))
      assert listed["amount"] == "6500.00"
      assert listed["limits"] == %{"max_branches" => 3}

      assert body["meta"]["checkout_enabled"] == true
      assert get_resp_header(response, "cache-control") == ["public, max-age=300"]
    end
  end

  describe "POST /api/v1/billing/checkout" do
    test "returns where to send the customer, with our own return addresses", %{conn: conn} do
      %{user: user, business: business} = owner_scope()
      plan = plan_fixture()
      BillingStripeStub.respond({:ok, %{"id" => "cs_9", "url" => "https://checkout.test/cs_9"}})

      response =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/billing/checkout", %{"plan" => plan.code})

      assert %{"url" => "https://checkout.test/cs_9"} = json_data(response, 200)

      body = BillingStripeStub.last_request().body
      assert body["success_url"] =~ "/settings/billing?checkout=success"
      assert body["success_url"] =~ "{CHECKOUT_SESSION_ID}"
      assert body["cancel_url"] =~ "/settings/billing?checkout=cancelled"
    end

    test "is refused to someone who may not manage billing", %{conn: conn} do
      %{scope: owner, business: business} = owner_scope()
      %{user: cashier} = staff_scope(owner, "cashier")
      plan = plan_fixture()

      response =
        conn
        |> sign_in(cashier, business)
        |> post(~p"/api/v1/billing/checkout", %{"plan" => plan.code})

      assert json_error(response, 403)
    end
  end

  describe "POST /api/v1/billing/subscription" do
    test "starts a first-time trial without a card", %{conn: conn} do
      %{user: user, business: business} = owner_scope()
      plan = plan_fixture(%{"trial_days" => 14})

      response =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/billing/subscription", %{"plan" => plan.code})

      assert %{"status" => "trialing", "trialing" => true} = json_data(response, 201)
    end

    test "sends an unpaid, untrialled plan to checkout instead", %{conn: conn} do
      %{user: user, business: business} = owner_scope()
      plan = plan_fixture(%{"trial_days" => 0})

      response =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/billing/subscription", %{"plan" => plan.code})

      assert %{"code" => "checkout_required"} = json_error(response, 402)
    end
  end

  describe "GET /api/v1/me after the subscription has ended" do
    test "says so, so every screen can, and the API holds everything but billing", %{conn: conn} do
      %{scope: scope, user: user, business: business} = owner_scope()
      plan = plan_fixture(%{"trial_days" => 14})
      {:ok, _trial} = Billing.subscribe(scope, plan.code)
      {:ok, _ended} = Billing.cancel(scope, immediate: true)

      conn = sign_in(conn, user, business)

      assert %{"subscription" => %{"status" => "canceled", "serviceable" => false}} =
               json_data(get(conn, ~p"/api/v1/me"), 200)

      assert %{"code" => "subscription_expired"} =
               json_error(get(conn, ~p"/api/v1/products"), 402)

      assert json_data(get(conn, ~p"/api/v1/billing/subscription"), 200) == nil

      # Its own businesses stay readable — a client can't settle on one, and
      # so can't show the billing screen, without them — but not writable.
      assert [_business] = json_data(get(conn, ~p"/api/v1/businesses"), 200)

      assert %{"code" => "subscription_expired"} =
               json_error(post(conn, ~p"/api/v1/businesses", %{"name" => "Another"}), 402)
    end
  end

  describe "POST /api/v1/webhooks/billing/stripe" do
    test "applies a signed event", %{conn: conn} do
      %{organization: organization} = owner_scope()
      plan = plan_fixture()

      body =
        Jason.encode!(%{
          "id" => "evt_1",
          "type" => "customer.subscription.created",
          "data" => %{
            "object" => %{
              "id" => "sub_web",
              "status" => "active",
              "customer" => "cus_web",
              "metadata" => %{"organization_id" => organization.id, "plan_code" => plan.code}
            }
          }
        })

      response =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", sign(body))
        |> post(~p"/api/v1/webhooks/billing/stripe", body)

      assert %{"received" => true, "status" => "applied"} = json_response(response, 200)
    end

    test "refuses an unsigned one", %{conn: conn} do
      response =
        conn
        |> put_req_header("content-type", "application/json")
        |> post(~p"/api/v1/webhooks/billing/stripe", ~s({"type":"invoice.paid"}))

      assert %{"error" => "signature_rejected"} = json_response(response, 400)
    end
  end

  defp sign(body) do
    timestamp = System.system_time(:second)

    signature =
      :hmac
      |> :crypto.mac(:sha256, "whsec_test_kaarobar", "#{timestamp}.#{body}")
      |> Base.encode16(case: :lower)

    "t=#{timestamp},v1=#{signature}"
  end
end
