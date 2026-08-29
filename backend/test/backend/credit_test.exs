defmodule Kaarobar.CreditTest do
  @moduledoc """
  The phase gate: a credit sale moves the balance, a part-payment allocates
  across invoices correctly, and the ageing report ties out.
  """

  use Kaarobar.DataCase, async: true

  import Kaarobar.Factory

  alias Kaarobar.Credit
  alias Kaarobar.Customers
  alias Kaarobar.Money

  # Priced at 500 so a test can name a round total and get a whole number of
  # units: checkout refuses a payment that is not exactly the total, so every
  # amount here has to be a multiple of the unit price.
  @unit_price 500

  setup do
    %{scope: scope} = owner_scope()
    product = product_fixture(scope, %{"name" => "Urea 50kg", "price" => "500.00"})
    [variant] = Kaarobar.Catalog.list_variants(scope, product)
    stock_fixture(scope, variant, "500", unit_cost: "2000.00")

    customer =
      customer_fixture(scope, %{
        "name" => "Riaz Traders",
        "credit_allowed" => true,
        "credit_limit" => "500000.00",
        "payment_terms_days" => 30
      })

    %{scope: scope, variant: variant, customer: customer}
  end

  defp credit_sale(scope, variant, customer, amount, opts \\ []) do
    quantity = amount |> Decimal.new() |> Decimal.div(@unit_price) |> Decimal.to_string(:normal)

    params = %{
      "customer_id" => customer.id,
      "lines" => [%{"variant_id" => variant.id, "quantity" => quantity}],
      "payments" => [%{"method" => "credit", "amount" => amount}]
    }

    params =
      case Keyword.get(opts, :sold_at) do
        nil -> params
        at -> Map.put(params, "sold_at", DateTime.to_iso8601(at))
      end

    {:ok, sale} = Kaarobar.Sales.Checkout.run(scope, params)
    sale
  end

  describe "a credit sale" do
    test "moves the customer's balance and records what it charged", ctx do
      sale = credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")

      {:ok, customer} = Customers.fetch_customer(ctx.scope, ctx.customer.id)
      assert Decimal.equal?(customer.balance, Decimal.new("2500.00"))
      assert Decimal.equal?(sale.credit_total, Decimal.new("2500.00"))
      assert Decimal.equal?(Credit.outstanding_on(ctx.scope, sale), Decimal.new("2500.00"))
    end

    test "shows up as an open invoice with a due date from the customer's terms", ctx do
      sale = credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")

      assert [invoice] = Credit.open_invoices(ctx.scope)
      assert invoice.sale_id == sale.id
      assert invoice.number == sale.number
      # 30-day terms, so due a month after it was sold.
      assert invoice.due_on == sale.sold_at |> DateTime.to_date() |> Date.add(30)
      assert invoice.days_overdue == 0
    end

    test "a cash sale never appears as an invoice", ctx do
      sale_fixture(ctx.scope, ctx.variant,
        quantity: "5",
        amount: "2500.00",
        customer_id: ctx.customer.id
      )

      assert Credit.open_invoices(ctx.scope) == []
    end

    test "is refused past the credit limit", ctx do
      tight =
        customer_fixture(ctx.scope, %{
          "name" => "Small Account",
          "credit_allowed" => true,
          "credit_limit" => "1000.00"
        })

      params = %{
        "customer_id" => tight.id,
        "lines" => [%{"variant_id" => ctx.variant.id, "quantity" => "5"}],
        "payments" => [%{"method" => "credit", "amount" => "2500.00"}]
      }

      assert {:error, {:credit_limit_exceeded, _available}} =
               Kaarobar.Sales.Checkout.run(ctx.scope, params)

      # Nothing landed: no debt, and the invoice list is still empty.
      {:ok, unchanged} = Customers.fetch_customer(ctx.scope, tight.id)
      assert Money.zero?(unchanged.balance)
      assert Credit.open_invoices(ctx.scope, customer_id: tight.id) == []
    end
  end

  describe "allocating a payment" do
    setup ctx do
      first = credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")
      second = credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")
      Map.merge(ctx, %{first: first, second: second})
    end

    test "settles the invoice it names, and leaves the other alone", ctx do
      {:ok, payment} =
        Customers.record_payment(ctx.scope, ctx.customer, %{
          "amount" => "2500.00",
          "allocations" => %{ctx.second.id => "2500.00"}
        })

      assert Money.zero?(Credit.unallocated_on(ctx.scope, payment))
      assert Money.zero?(Credit.outstanding_on(ctx.scope, ctx.second))
      assert Decimal.equal?(Credit.outstanding_on(ctx.scope, ctx.first), Decimal.new("2500.00"))

      # The one they actually paid for is gone from the list; the other is not.
      assert [remaining] = Credit.open_invoices(ctx.scope)
      assert remaining.sale_id == ctx.first.id
    end

    test "a part payment leaves the rest of that invoice outstanding", ctx do
      {:ok, _payment} =
        Customers.record_payment(ctx.scope, ctx.customer, %{
          "amount" => "1000.00",
          "allocations" => %{ctx.first.id => "1000.00"}
        })

      assert Decimal.equal?(Credit.outstanding_on(ctx.scope, ctx.first), Decimal.new("1500.00"))

      invoice = Enum.find(Credit.open_invoices(ctx.scope), &(&1.sale_id == ctx.first.id))
      assert Decimal.equal?(invoice.allocated, Decimal.new("1000.00"))
      assert Decimal.equal?(invoice.outstanding, Decimal.new("1500.00"))
    end

    test "refuses to allocate more than the invoice still owes", ctx do
      {:ok, payment} = Customers.record_payment(ctx.scope, ctx.customer, %{"amount" => "5000.00"})

      assert {:error, {:exceeds_outstanding, number, remaining}} =
               Credit.allocate(ctx.scope, payment, %{ctx.first.id => "4000.00"})

      assert number == ctx.first.number
      assert Decimal.equal?(remaining, Decimal.new("2500.00"))
    end

    test "refuses to allocate more than the payment is worth", ctx do
      {:ok, payment} = Customers.record_payment(ctx.scope, ctx.customer, %{"amount" => "1000.00"})

      assert {:error, {:over_allocated, available}} =
               Credit.allocate(ctx.scope, payment, %{ctx.first.id => "2500.00"})

      assert Decimal.equal?(available, Decimal.new("1000.00"))
    end

    test "refuses to settle another customer's invoice", ctx do
      stranger =
        customer_fixture(ctx.scope, %{"name" => "Someone Else", "credit_allowed" => true})

      {:ok, payment} = Customers.record_payment(ctx.scope, stranger, %{"amount" => "2500.00"})

      assert {:error, :customer_mismatch} =
               Credit.allocate(ctx.scope, payment, %{ctx.first.id => "2500.00"})
    end

    test "auto-allocation fills the oldest invoices first and stops when the money runs out",
         ctx do
      {:ok, payment} =
        Customers.record_payment(ctx.scope, ctx.customer, %{
          "amount" => "3000.00",
          "auto_allocate" => true
        })

      # 2,500 clears the first invoice; the remaining 500 goes onto the second.
      assert Money.zero?(Credit.outstanding_on(ctx.scope, ctx.first))
      assert Decimal.equal?(Credit.outstanding_on(ctx.scope, ctx.second), Decimal.new("2000.00"))
      assert Money.zero?(Credit.unallocated_on(ctx.scope, payment))
    end

    test "money over and above the invoices stays on account", ctx do
      {:ok, payment} =
        Customers.record_payment(ctx.scope, ctx.customer, %{
          "amount" => "6000.00",
          "auto_allocate" => true
        })

      assert Credit.open_invoices(ctx.scope) == []
      assert Decimal.equal?(Credit.unallocated_on(ctx.scope, payment), Decimal.new("1000.00"))

      # Both invoices cleared, and the extra 1,000 leaves them in credit.
      {:ok, customer} = Customers.fetch_customer(ctx.scope, ctx.customer.id)
      assert Decimal.equal?(customer.balance, Decimal.new("-1000.00"))
    end
  end

  describe "the ageing report" do
    test "ties out against the invoices behind it", ctx do
      credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")
      credit_sale(ctx.scope, ctx.variant, ctx.customer, "1500.00")

      ageing = Credit.ageing(ctx.scope)
      invoices = Credit.open_invoices(ctx.scope)

      assert Decimal.equal?(ageing.total, invoices |> Enum.map(& &1.outstanding) |> Money.sum())
      assert ageing.invoice_count == 2
    end

    test "counts from the due date, not the invoice date", ctx do
      sold_at = DateTime.add(DateTime.utc_now(), -40, :day)
      credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00", sold_at: sold_at)

      # Forty days old, but on thirty-day terms: ten days overdue, not forty.
      assert [invoice] = Credit.open_invoices(ctx.scope)
      assert invoice.days_overdue == 10

      ageing = Credit.ageing(ctx.scope)
      assert Decimal.equal?(ageing.days_1_30, Decimal.new("2500.00"))
      assert Money.zero?(ageing.current)
    end

    test "a customer inside their own terms is current, however old the invoice", ctx do
      patient =
        customer_fixture(ctx.scope, %{
          "name" => "Sixty Day Buyer",
          "credit_allowed" => true,
          "payment_terms_days" => 60
        })

      sold_at = DateTime.add(DateTime.utc_now(), -45, :day)
      credit_sale(ctx.scope, ctx.variant, patient, "2500.00", sold_at: sold_at)

      ageing = Credit.ageing(ctx.scope, customer_id: patient.id)
      assert Decimal.equal?(ageing.current, Decimal.new("2500.00"))
      assert Money.zero?(ageing.days_1_30)
    end

    test "drops an invoice out of the buckets as it is paid", ctx do
      sale = credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")
      assert Decimal.equal?(Credit.ageing(ctx.scope).total, Decimal.new("2500.00"))

      {:ok, _payment} =
        Customers.record_payment(ctx.scope, ctx.customer, %{
          "amount" => "2500.00",
          "allocations" => %{sale.id => "2500.00"}
        })

      after_payment = Credit.ageing(ctx.scope)
      assert Money.zero?(after_payment.total)
      assert after_payment.invoice_count == 0
    end

    test "groups by customer, worst first", ctx do
      other =
        customer_fixture(ctx.scope, %{"name" => "Newer Debt", "credit_allowed" => true})

      credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00",
        sold_at: DateTime.add(DateTime.utc_now(), -90, :day)
      )

      credit_sale(ctx.scope, ctx.variant, other, "1000.00")

      assert [worst | _rest] = Credit.ageing_by_customer(ctx.scope)
      assert worst.customer_id == ctx.customer.id
      assert worst.oldest_days_overdue == 60
    end

    test "overdue invoices exclude anything still within terms", ctx do
      credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")

      credit_sale(ctx.scope, ctx.variant, ctx.customer, "1500.00",
        sold_at: DateTime.add(DateTime.utc_now(), -60, :day)
      )

      assert [overdue] = Credit.overdue_invoices(ctx.scope)
      assert Decimal.equal?(overdue.outstanding, Decimal.new("1500.00"))
    end
  end

  describe "a statement" do
    test "shows the ledger, the open invoices and what is left to spend", ctx do
      sale = credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")

      {:ok, _payment} =
        Customers.record_payment(ctx.scope, ctx.customer, %{
          "amount" => "1000.00",
          "allocations" => %{sale.id => "1000.00"}
        })

      {:ok, customer} = Customers.fetch_customer(ctx.scope, ctx.customer.id)
      statement = Credit.statement(ctx.scope, customer)

      # One charge, one payment.
      assert length(statement.entries) == 2
      assert Decimal.equal?(statement.balance, Decimal.new("1500.00"))
      assert Decimal.equal?(statement.outstanding, Decimal.new("1500.00"))

      # The limit less what they owe.
      assert Decimal.equal?(statement.available_credit, Decimal.new("498500.00"))
    end

    test "the balance and the outstanding invoices agree", ctx do
      credit_sale(ctx.scope, ctx.variant, ctx.customer, "2500.00")
      credit_sale(ctx.scope, ctx.variant, ctx.customer, "1500.00")

      {:ok, customer} = Customers.fetch_customer(ctx.scope, ctx.customer.id)
      statement = Credit.statement(ctx.scope, customer)

      assert Decimal.equal?(statement.balance, statement.outstanding)
    end
  end
end
