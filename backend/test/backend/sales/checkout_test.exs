defmodule Kaarobar.Sales.CheckoutTest do
  @moduledoc """
  The phase gate: a full checkout — multi-tender split payment, line and order
  discounts, tax, stock decrement, customer ledger and a gapless invoice number
  — commits in one transaction, and everything that undoes one balances.

  The other half of the gate — two cashiers who must not both sell the last
  unit — lives in `Kaarobar.Sales.CheckoutConcurrencyTest`, which cannot run
  inside the sandbox because it needs two real database connections.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Customers
  alias Kaarobar.Inventory
  alias Kaarobar.Registers
  alias Kaarobar.Sales
  alias Kaarobar.Sales.Checkout
  alias Kaarobar.Sales.Sale

  defp assert_money(actual, expected) do
    assert Decimal.equal?(actual, Decimal.new(expected)),
           "expected #{expected}, got #{Decimal.to_string(actual, :normal)}"
  end

  defp on_hand(scope, variant, branch) do
    {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)
    item.on_hand
  end

  setup do
    %{scope: scope, branch: branch} = owner_scope()
    variant = variant_fixture(scope, %{"name" => "Widget", "price" => "100.00"})
    stock_fixture(scope, variant, "20", unit_cost: "60.00")
    %{register: register, shift: shift} = open_till(scope)

    %{scope: scope, branch: branch, variant: variant, register: register, shift: shift}
  end

  # ===========================================================================
  # The straight-through case
  # ===========================================================================

  describe "a plain cash sale" do
    test "commits the sale, its line, its tender and the stock move together",
         %{scope: scope, variant: variant, branch: branch, register: register} do
      {:ok, sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "2"}],
          "payments" => [
            %{"method" => "cash", "amount" => "200.00", "tendered_amount" => "500.00"}
          ]
        })

      assert sale.status == "completed"
      assert_money(sale.total, "200.00")
      assert_money(sale.paid_total, "200.00")
      assert_money(sale.change_due, "300.00")

      # Cost came from the ledger, not from the catalog.
      assert_money(sale.cost_total, "120.00")
      assert_money(Sale.margin(sale), "80.00")

      assert [item] = sale.items
      assert_money(item.quantity, "2")
      assert_money(item.unit_price, "100.00")
      assert item.name_snapshot == "Widget"

      assert_money(on_hand(scope, variant, branch), "18")
    end

    test "issues a gapless number in the register's own series", %{
      scope: scope,
      variant: variant,
      branch: branch
    } do
      {:ok, till} =
        Registers.create_register(scope, %{"name" => "Counter 2", "invoice_prefix" => "C2"})

      {:ok, _shift} = Registers.open_shift(scope, till, %{"opening_float" => "0"})

      first = sale_fixture(scope, variant, register_id: till.id)
      second = sale_fixture(scope, variant, register_id: till.id)

      assert String.starts_with?(first.number, "C2-")
      assert String.starts_with?(second.number, "C2-")
      refute first.number == second.number

      assert_money(on_hand(scope, variant, branch), "18")
    end

    test "refuses a sale whose tenders do not cover the total", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      result =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "2"}],
          "payments" => [%{"method" => "cash", "amount" => "150.00"}]
        })

      assert {:error, {:underpaid, short}} = result
      assert_money(short, "50.00")
    end

    test "refuses over-tendering on a card, which cannot give change", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      result =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "1"}],
          "payments" => [%{"method" => "card", "amount" => "150.00"}]
        })

      assert {:error, {:overpaid, over}} = result
      assert_money(over, "50.00")
    end
  end

  # ===========================================================================
  # Split tender
  # ===========================================================================

  describe "split payment" do
    test "records each tender separately and sums them to the total", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      {:ok, sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "5"}],
          "payments" => [
            %{"method" => "card", "amount" => "300.00", "card_last_four" => "4242"},
            %{"method" => "cash", "amount" => "200.00", "tendered_amount" => "200.00"}
          ]
        })

      assert_money(sale.total, "500.00")
      assert length(sale.payments) == 2

      card = Enum.find(sale.payments, &(&1.method == "card"))
      cash = Enum.find(sale.payments, &(&1.method == "cash"))

      assert_money(card.amount, "300.00")
      assert card.card_last_four == "4242"
      assert_money(cash.amount, "200.00")
    end
  end

  # ===========================================================================
  # Tax
  # ===========================================================================

  describe "tax" do
    test "adds tax to a tax-exclusive price and stores the rate that applied", %{
      scope: scope,
      register: register
    } do
      tax = tax_fixture(scope, %{"name" => "GST", "rate" => "0.17"})
      group = tax_group_fixture(scope, [tax])

      product = product_fixture(scope, %{"price" => "100.00", "tax_group_id" => group.id})
      [variant] = Kaarobar.Catalog.list_variants(scope, product)
      stock_fixture(scope, variant, "10", unit_cost: "50.00")

      {:ok, sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "1"}],
          "payments" => [%{"method" => "cash", "amount" => "117.00"}]
        })

      assert_money(sale.subtotal, "100.00")
      assert_money(sale.tax_total, "17.00")
      assert_money(sale.total, "117.00")

      assert [item] = sale.items
      assert [tax_line] = item.taxes
      assert tax_line.name_snapshot == "GST"
      assert_money(tax_line.rate_snapshot, "0.17")
      assert_money(tax_line.amount, "17.00")
    end
  end

  # ===========================================================================
  # Discounts
  # ===========================================================================

  describe "an order-level discount" do
    test "is prorated across the lines before tax", %{scope: scope, register: register} do
      tax = tax_fixture(scope, %{"name" => "GST", "rate" => "0.10"})
      group = tax_group_fixture(scope, [tax])

      product = product_fixture(scope, %{"price" => "100.00", "tax_group_id" => group.id})
      [variant] = Kaarobar.Catalog.list_variants(scope, product)
      stock_fixture(scope, variant, "10", unit_cost: "50.00")

      {:ok, sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "2"}],
          "order_discount" => "50.00",
          "payments" => [%{"method" => "cash", "amount" => "165.00"}]
        })

      # 200 less 50 is 150 net; 10% of 150 is 15.
      assert_money(sale.order_discount, "50.00")
      assert_money(sale.subtotal, "150.00")
      assert_money(sale.tax_total, "15.00")
      assert_money(sale.total, "165.00")
    end

  end

  describe "backdating" do
    test "is refused to a cashier, who may not choose when a sale happened", %{
      scope: owner,
      variant: variant,
      register: register
    } do
      %{scope: cashier} = staff_scope(owner, "cashier")
      cashier = Kaarobar.Scope.put_branch(cashier, owner.branch)

      result =
        Checkout.run(cashier, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "1"}],
          "sold_at" => "2026-01-01T10:00:00Z",
          "payments" => [%{"method" => "cash", "amount" => "100.00"}]
        })

      assert {:error, {:forbidden, "sale:backdate"}} = result
    end
  end

  # ===========================================================================
  # Credit
  # ===========================================================================

  describe "selling on credit" do
    test "settles the sale and moves the debt to the customer's ledger", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      customer =
        customer_fixture(scope, %{
          "credit_allowed" => true,
          "credit_limit" => "5000.00"
        })

      {:ok, sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "customer_id" => customer.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "3"}],
          "payments" => [%{"method" => "credit", "amount" => "300.00"}]
        })

      assert sale.status == "completed"

      {:ok, reloaded} = Customers.fetch_customer(scope, customer.id)
      assert_money(reloaded.balance, "300.00")

      [entry] = Customers.list_ledger_entries(scope, reloaded)
      assert entry.kind == "sale"
      assert_money(entry.amount, "300.00")
      assert_money(entry.balance_after, "300.00")
      assert entry.reference_id == sale.id
    end

    test "refuses to take a customer past their credit limit", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      customer =
        customer_fixture(scope, %{"credit_allowed" => true, "credit_limit" => "250.00"})

      result =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "customer_id" => customer.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "3"}],
          "payments" => [%{"method" => "credit", "amount" => "300.00"}]
        })

      assert {:error, {:credit_limit_exceeded, available}} = result
      assert_money(available, "250.00")

      # Nothing was written: the stock is untouched.
      assert_money(on_hand(scope, variant, scope.branch), "20")
    end

    test "refuses credit for a customer who is not allowed it", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      customer = customer_fixture(scope)

      result =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "customer_id" => customer.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "1"}],
          "payments" => [%{"method" => "credit", "amount" => "100.00"}]
        })

      assert {:error, :credit_not_allowed} = result
    end

    test "refuses a credit sale with nobody named", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      result =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "1"}],
          "payments" => [%{"method" => "credit", "amount" => "100.00"}]
        })

      assert {:error, :credit_customer_required} = result
    end
  end

  # ===========================================================================
  # Stock
  # ===========================================================================

  describe "stock" do
    test "refuses to sell more than is on the shelf, and writes nothing", %{
      scope: scope,
      variant: variant,
      branch: branch,
      register: register
    } do
      result =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "50"}],
          "payments" => [%{"method" => "cash", "amount" => "5000.00"}]
        })

      assert {:error, {:insufficient_stock, variant_id}} = result
      assert variant_id == variant.id

      assert_money(on_hand(scope, variant, branch), "20")
      assert Sales.list_sales(scope, %{}) == []
    end

    test "does not touch stock for a service, which has none", %{
      scope: scope,
      register: register
    } do
      product = product_fixture(scope, %{"kind" => "service", "price" => "500.00"})
      [variant] = Kaarobar.Catalog.list_variants(scope, product)

      {:ok, sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "1"}],
          "payments" => [%{"method" => "cash", "amount" => "500.00"}]
        })

      assert_money(sale.total, "500.00")
      assert {:error, :not_found} = Inventory.fetch_stock_item(scope, variant.id, sale.branch_id)
    end
  end

  # ===========================================================================
  # The shift
  # ===========================================================================

  describe "the shift" do
    test "accumulates the sale and the change handed back", %{
      scope: scope,
      variant: variant,
      register: register,
      shift: shift
    } do
      {:ok, _sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "2"}],
          "payments" => [
            %{"method" => "cash", "amount" => "200.00", "tendered_amount" => "500.00"}
          ]
        })

      {:ok, reloaded} = Registers.fetch_shift(scope, shift.id)

      assert reloaded.sales_count == 1
      assert_money(reloaded.gross_sales, "200.00")

      # The customer handed over 500 and got 300 back, so 200 stayed in the
      # drawer — which is exactly the tender amount, and why the change is not
      # subtracted a second time.
      assert_money(Kaarobar.Registers.Shift.tender_total(reloaded, "cash"), "200.00")
      assert_money(reloaded.cash_out, "0")
      assert_money(Kaarobar.Registers.Shift.expected_cash(reloaded), "1200.00")
    end

    test "refuses to sell on a register with no open shift", %{
      scope: scope,
      variant: variant
    } do
      register = register_fixture(scope, %{"name" => "Unopened"})

      result =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "1"}],
          "payments" => [%{"method" => "cash", "amount" => "100.00"}]
        })

      assert {:error, :shift_not_open} = result
    end
  end

  # ===========================================================================
  # Vertical requirements
  # ===========================================================================

  describe "vertical requirements" do
    test "a restaurant sale must say how the food is served" do
      %{scope: scope} = owner_scope(business_type: "restaurant")
      variant = variant_fixture(scope, %{"name" => "Biryani", "price" => "450.00"})
      stock_fixture(scope, variant, "10", unit_cost: "200.00")
      %{register: register} = open_till(scope)

      params = %{
        "register_id" => register.id,
        "lines" => [%{"variant_id" => variant.id, "quantity" => "1"}],
        "payments" => [%{"method" => "cash", "amount" => "450.00"}]
      }

      assert {:error, :service_mode_required} = Checkout.run(scope, params)

      assert {:ok, sale} = Checkout.run(scope, Map.put(params, "service_mode", "dine_in"))
      assert sale.service_mode == "dine_in"
    end
  end

  # ===========================================================================
  # Previewing
  # ===========================================================================

  describe "preview" do
    test "prices the basket without writing anything", %{
      scope: scope,
      variant: variant,
      branch: branch
    } do
      {:ok, summary} =
        Checkout.preview(scope, %{
          "lines" => [%{"variant_id" => variant.id, "quantity" => "3"}]
        })

      assert_money(summary.totals.total, "300.00")
      assert [line] = summary.lines
      assert line.name == "Widget"

      assert_money(on_hand(scope, variant, branch), "20")
      assert Sales.list_sales(scope, %{}) == []
    end
  end
end
