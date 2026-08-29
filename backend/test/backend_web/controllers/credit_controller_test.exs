defmodule KaarobarWeb.CreditControllerTest do
  @moduledoc """
  The Phase 5 surfaces over HTTP: invoices and ageing, allocation, points, and
  the one response that is allowed to carry a gift card's code.
  """

  use KaarobarWeb.ConnCase, async: true

  alias Kaarobar.Customers

  @unit_price 500

  setup %{conn: conn} do
    %{scope: scope, user: owner, business: business, branch: branch} = owner_scope()
    product = product_fixture(scope, %{"name" => "Urea 50kg", "price" => "500.00"})
    [variant] = Kaarobar.Catalog.list_variants(scope, product)
    stock_fixture(scope, variant, "500", unit_cost: "400.00")

    customer =
      customer_fixture(scope, %{
        "name" => "Riaz Traders",
        "credit_allowed" => true,
        "credit_limit" => "500000.00",
        "payment_terms_days" => 30
      })

    conn = conn |> sign_in(owner, business) |> with_branch(branch)

    %{
      conn: conn,
      scope: scope,
      business: business,
      branch: branch,
      variant: variant,
      customer: customer
    }
  end

  defp credit_sale(scope, variant, customer, amount) do
    quantity = amount |> Decimal.new() |> Decimal.div(@unit_price) |> Decimal.to_string(:normal)

    {:ok, sale} =
      Kaarobar.Sales.Checkout.run(scope, %{
        "customer_id" => customer.id,
        "lines" => [%{"variant_id" => variant.id, "quantity" => quantity}],
        "payments" => [%{"method" => "credit", "amount" => amount}]
      })

    sale
  end

  describe "GET /api/v1/credit/invoices" do
    test "lists what is unpaid, with the outstanding amount as a string", ctx do
      sale = credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")

      body = ctx.conn |> get(~p"/api/v1/credit/invoices") |> json_response(200)

      assert [invoice] = body["data"]
      assert invoice["number"] == sale.number
      # Money is a string throughout the API — a float would not survive JSON.
      assert invoice["outstanding"] == "2500.00"
      assert invoice["days_overdue"] == 0
    end

    test "filters to one customer", ctx do
      credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")
      other = customer_fixture(ctx.scope, %{"name" => "Other", "credit_allowed" => true})
      credit_sale(ctx.scope, ctx.variant, other, "1000.00")

      body =
        ctx.conn
        |> get(~p"/api/v1/credit/invoices?customer_id=#{other.id}")
        |> json_response(200)

      assert [only] = body["data"]
      assert only["customer_id"] == other.id
    end
  end

  describe "GET /api/v1/credit/ageing" do
    test "buckets against the customer's own terms", ctx do
      credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")

      body = ctx.conn |> get(~p"/api/v1/credit/ageing") |> json_response(200)

      assert body["data"]["current"] == "2500.00"
      assert body["data"]["total"] == "2500.00"
      assert body["data"]["invoice_count"] == 1
    end
  end

  describe "POST /api/v1/credit/payments/:id/allocate" do
    test "settles the invoice it names", ctx do
      sale = credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")

      {:ok, payment} =
        Customers.record_payment(ctx.scope, ctx.customer, %{"amount" => "2500.00"})

      body =
        ctx.conn
        |> post(~p"/api/v1/credit/payments/#{payment.id}/allocate", %{
          "allocations" => %{sale.id => "2500.00"}
        })
        |> json_response(201)

      assert [allocation] = body["data"]
      assert allocation["sale_id"] == sale.id
      assert allocation["amount"] == "2500.00"

      assert ctx.conn |> get(~p"/api/v1/credit/invoices") |> json_response(200) |> Map.get("data") ==
               []
    end

    test "refuses more than the invoice owes, and says which one", ctx do
      sale = credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")

      {:ok, payment} =
        Customers.record_payment(ctx.scope, ctx.customer, %{"amount" => "5000.00"})

      body =
        ctx.conn
        |> post(~p"/api/v1/credit/payments/#{payment.id}/allocate", %{
          "allocations" => %{sale.id => "4000.00"}
        })
        |> json_response(422)

      assert body["error"]["code"]
      assert body["error"]["details"]
    end
  end

  describe "GET /api/v1/credit/statement/:customer_id" do
    test "shows the ledger and the open invoices together", ctx do
      credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")

      body =
        ctx.conn
        |> get(~p"/api/v1/credit/statement/#{ctx.customer.id}")
        |> json_response(200)

      assert body["data"]["balance"] == "2500.00"
      assert body["data"]["outstanding"] == "2500.00"
      assert length(body["data"]["entries"]) == 1
      assert length(body["data"]["open_invoices"]) == 1
    end
  end

  describe "gift cards" do
    test "the code comes back once, on issue, and never again", ctx do
      created =
        ctx.conn
        |> post(~p"/api/v1/gift-cards", %{"amount" => "5000.00"})
        |> json_response(201)

      code = created["data"]["code"]
      assert is_binary(code)
      assert created["data"]["masked_code"] =~ String.slice(code, -4, 4)

      # Reading it back gives the mask, never the code.
      fetched = ctx.conn |> get(~p"/api/v1/gift-cards/#{code}") |> json_response(200)
      refute Map.has_key?(fetched["data"], "code")
      assert fetched["data"]["masked_code"] == created["data"]["masked_code"]
      assert fetched["data"]["balance"] == "5000.00"
    end

    test "cannot be spent before it is activated", ctx do
      created =
        ctx.conn
        |> post(~p"/api/v1/gift-cards", %{"amount" => "1000.00"})
        |> json_response(201)

      code = created["data"]["code"]

      assert ctx.conn
             |> post(~p"/api/v1/gift-cards/#{code}/redeem", %{"amount" => "100.00"})
             |> json_response(422)

      assert ctx.conn |> post(~p"/api/v1/gift-cards/#{code}/activate") |> json_response(200)

      spent =
        ctx.conn
        |> post(~p"/api/v1/gift-cards/#{code}/redeem", %{"amount" => "100.00"})
        |> json_response(201)

      assert spent["data"]["balance_after"] == "900.00"
    end

    test "an unknown code is a 404, not a hint", ctx do
      assert ctx.conn |> get(~p"/api/v1/gift-cards/NOSUCHCODE1234") |> json_response(404)
    end
  end

  describe "loyalty" do
    setup ctx do
      {:ok, _program} =
        Kaarobar.Loyalty.create_program(ctx.scope, %{
          "name" => "Shop points",
          "earn_rate" => "1",
          "redeem_rate" => "0.01"
        })

      ctx
    end

    test "reports a balance after a sale earns", ctx do
      {:ok, _earned} =
        Kaarobar.Loyalty.earn(ctx.scope, ctx.customer, %{subtotal: Decimal.new("1000.00")})

      body =
        ctx.conn
        |> get(~p"/api/v1/loyalty/customers/#{ctx.customer.id}")
        |> json_response(200)

      assert body["data"]["points_balance"] == 1000
    end

    test "redeeming returns what the points were worth", ctx do
      {:ok, _earned} =
        Kaarobar.Loyalty.earn(ctx.scope, ctx.customer, %{subtotal: Decimal.new("1000.00")})

      body =
        ctx.conn
        |> post(~p"/api/v1/loyalty/customers/#{ctx.customer.id}/redeem", %{
          "points" => 500,
          "bill_total" => "200.00"
        })
        |> json_response(200)

      assert body["data"]["value"] == "5.00"
      assert body["data"]["transaction"]["points"] == -500
    end
  end

  describe "permissions" do
    test "a cashier may redeem points but not change the programme", ctx do
      {:ok, _program} =
        Kaarobar.Loyalty.create_program(ctx.scope, %{"name" => "Points"})

      %{user: cashier} = staff_scope(ctx.scope, "cashier")

      cashier_conn =
        build_conn() |> sign_in(cashier, ctx.business) |> with_branch(ctx.branch)

      assert cashier_conn
             |> post(~p"/api/v1/loyalty/program", %{"name" => "Mine now"})
             |> json_response(403)
    end

    test "a cashier cannot manage customer groups", ctx do
      %{user: cashier} = staff_scope(ctx.scope, "cashier")

      cashier_conn =
        build_conn() |> sign_in(cashier, ctx.business) |> with_branch(ctx.branch)

      assert cashier_conn |> get(~p"/api/v1/customer-groups") |> json_response(200)

      assert cashier_conn
             |> post(~p"/api/v1/customer-groups", %{"name" => "Mates rates"})
             |> json_response(403)
    end
  end
end
