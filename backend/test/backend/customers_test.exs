defmodule Kaarobar.CustomersTest do
  @moduledoc """
  Who owes what, and the ledger that proves it.

  The balance is a projection; the ledger is the truth. Every test here asserts
  both, because the whole point of keeping a ledger is that the two can be
  checked against each other.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Customers
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Money
  alias Kaarobar.Sales.Checkout

  defp assert_money(actual, expected) do
    assert Decimal.equal?(actual, Decimal.new(expected)),
           "expected #{expected}, got #{Decimal.to_string(actual, :normal)}"
  end

  setup do
    %{scope: scope} = owner_scope()
    %{scope: scope}
  end

  # ===========================================================================
  # Records
  # ===========================================================================

  describe "creating a customer" do
    test "starts at zero and may not buy on credit", %{scope: scope} do
      {:ok, customer} = Customers.create_customer(scope, %{"name" => "Ali Raza"})

      assert_money(customer.balance, "0")
      refute customer.credit_allowed
      assert Decimal.equal?(Customer.available_credit(customer), Money.zero())
    end

    test "an opening balance posts as a ledger entry, not a bare number", %{scope: scope} do
      {:ok, customer} =
        Customers.create_customer(scope, %{
          "name" => "Old debtor",
          "opening_balance" => "1500.00"
        })

      assert_money(customer.balance, "1500.00")

      [entry] = Customers.list_ledger_entries(scope, customer)
      assert entry.kind == "opening"
      assert_money(entry.amount, "1500.00")
      assert_money(entry.balance_after, "1500.00")
    end

    test "refuses a credit limit on a customer who may not use credit", %{scope: scope} do
      assert {:error, changeset} =
               Customers.create_customer(scope, %{
                 "name" => "Confused setting",
                 "credit_limit" => "5000.00"
               })

      assert "has no effect unless credit is allowed" in errors_on(changeset).credit_limit
    end

    test "two customers cannot share a phone number", %{scope: scope} do
      _first = customer_fixture(scope, %{"phone" => "03001234567"})

      assert {:error, changeset} =
               Customers.create_customer(scope, %{"name" => "Someone", "phone" => "03001234567"})

      assert "is already used by another customer" in errors_on(changeset).phone
    end

    test "is found by the phone number a cashier types", %{scope: scope} do
      customer = customer_fixture(scope, %{"name" => "Regular", "phone" => "03009999999"})

      found = Customers.find_by_phone(scope, "03009999999")
      assert found.id == customer.id

      assert Customers.find_by_phone(scope, "03000000000") == nil
    end

    test "cannot be removed while they still owe money", %{scope: scope} do
      customer =
        customer_fixture(scope, %{"credit_allowed" => true, "opening_balance" => "100.00"})

      assert {:error, :balance_outstanding} = Customers.delete_customer(scope, customer)
    end
  end

  # ===========================================================================
  # Credit limits
  # ===========================================================================

  describe "credit limits" do
    test "no limit means no ceiling, but credit must still be allowed" do
      unlimited = %Customer{credit_allowed: true, credit_limit: nil, balance: Decimal.new(0)}
      barred = %Customer{credit_allowed: false, credit_limit: nil, balance: Decimal.new(0)}

      assert Customer.credit_check(unlimited, Decimal.new(1_000_000)) == :ok
      assert Customer.available_credit(unlimited) == :unlimited
      assert Customer.credit_check(barred, Decimal.new(1)) == {:error, :credit_not_allowed}
    end

    test "the check is against what they would owe, not what they owe now" do
      customer = %Customer{
        credit_allowed: true,
        credit_limit: Decimal.new(1000),
        balance: Decimal.new(800)
      }

      assert Customer.credit_check(customer, Decimal.new(200)) == :ok
      assert {:error, {:credit_limit_exceeded, room}} =
               Customer.credit_check(customer, Decimal.new(201))
      assert_money(room, "200")
    end
  end

  # ===========================================================================
  # The ledger
  # ===========================================================================

  describe "the ledger" do
    test "a sale on credit and a payment against it net to zero", %{scope: scope} do
      variant = variant_fixture(scope, %{"name" => "Sack of feed", "price" => "2000.00"})
      stock_fixture(scope, variant, "10", unit_cost: "1500.00")
      %{register: register} = open_till(scope)

      customer =
        customer_fixture(scope, %{"credit_allowed" => true, "credit_limit" => "10000.00"})

      {:ok, sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "customer_id" => customer.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "2"}],
          "payments" => [%{"method" => "credit", "amount" => "4000.00"}]
        })

      {:ok, owing} = Customers.fetch_customer(scope, customer.id)
      assert_money(owing.balance, "4000.00")

      {:ok, payment} =
        Customers.record_payment(scope, owing, %{"amount" => "4000.00", "method" => "cash"})

      assert String.starts_with?(payment.number, "RCPT-")

      {:ok, settled} = Customers.fetch_customer(scope, customer.id)
      assert_money(settled.balance, "0")

      entries = Customers.list_ledger_entries(scope, settled)
      assert Enum.map(entries, & &1.kind) == ["sale", "payment"]

      # The running balance is snapshotted, so a statement adds up on its own.
      [first, second] = entries
      assert_money(first.balance_after, "4000.00")
      assert_money(second.balance_after, "0")

      assert first.reference_id == sale.id
    end

    test "a part payment leaves the rest owing", %{scope: scope} do
      customer =
        customer_fixture(scope, %{"credit_allowed" => true, "opening_balance" => "5000.00"})

      {:ok, _payment} = Customers.record_payment(scope, customer, %{"amount" => "1200.00"})

      {:ok, reloaded} = Customers.fetch_customer(scope, customer.id)
      assert_money(reloaded.balance, "3800.00")
      assert Customer.owing?(reloaded)
    end

    test "refuses a payment of nothing", %{scope: scope} do
      customer = customer_fixture(scope, %{"credit_allowed" => true})

      assert {:error, :amount_must_be_positive} =
               Customers.record_payment(scope, customer, %{"amount" => "0"})
    end

    test "charging credit under a lock refuses to breach the limit", %{scope: scope} do
      customer =
        customer_fixture(scope, %{"credit_allowed" => true, "credit_limit" => "1000.00"})

      assert {:ok, _entry} = Customers.charge_credit(scope, customer.id, Decimal.new(600))

      assert {:error, {:credit_limit_exceeded, room}} =
               Customers.charge_credit(scope, customer.id, Decimal.new(500))

      assert_money(room, "400")
    end
  end

  # ===========================================================================
  # Ageing
  # ===========================================================================

  describe "receivables ageing" do
    test "buckets what is owed by how long it has been outstanding", %{scope: scope} do
      _customer =
        customer_fixture(scope, %{"credit_allowed" => true, "opening_balance" => "2500.00"})

      ageing = Customers.receivables_ageing(scope)

      # Posted today, so it sits in the current bucket and nowhere else.
      assert_money(ageing.current, "2500.00")
      assert_money(ageing.days_30, "0")
      assert_money(ageing.total, "2500.00")
    end
  end
end
