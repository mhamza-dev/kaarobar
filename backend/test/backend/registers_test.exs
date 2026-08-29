defmodule Kaarobar.RegistersTest do
  @moduledoc """
  Shifts open, take money, and close against a counted drawer.

  The number this whole module exists to produce is the variance: what the
  system expected to be in the till against what was actually there. Everything
  else — the running totals, the cash movements, the X report — is in service
  of making that number both cheap to produce and worth believing.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Registers
  alias Kaarobar.Registers.Shift
  alias Kaarobar.Sales.Checkout

  defp assert_money(actual, expected) do
    assert Decimal.equal?(actual, Decimal.new(expected)),
           "expected #{expected}, got #{Decimal.to_string(actual, :normal)}"
  end

  setup do
    %{scope: scope, branch: branch} = owner_scope()
    variant = variant_fixture(scope, %{"name" => "Widget", "price" => "100.00"})
    stock_fixture(scope, variant, "50", unit_cost: "60.00")

    %{scope: scope, branch: branch, variant: variant}
  end

  # ===========================================================================
  # Registers
  # ===========================================================================

  describe "registers" do
    test "a till gets its own invoice series when it is given a prefix", %{scope: scope} do
      {:ok, register} =
        Registers.create_register(scope, %{"name" => "Counter 1", "invoice_prefix" => "c1"})

      # Normalised: a series is read out loud, and case should not be part of it.
      assert register.invoice_prefix == "C1"
      assert Kaarobar.Registers.Register.invoice_series(register) == "C1"
    end

    test "falls back to the default series when it has no prefix", %{scope: scope} do
      register = register_fixture(scope)

      assert Kaarobar.Registers.Register.invoice_series(register) == "INV"
    end

    test "two tills at one branch cannot share a name", %{scope: scope} do
      _first = register_fixture(scope, %{"name" => "Counter"})

      assert {:error, changeset} = Registers.create_register(scope, %{"name" => "Counter"})
      assert errors_on(changeset).name != []
    end

    test "cannot be removed while a shift is open on it", %{scope: scope} do
      %{register: register} = open_till(scope)

      assert {:error, :shift_open} = Registers.delete_register(scope, register)
    end
  end

  # ===========================================================================
  # Shifts
  # ===========================================================================

  describe "opening a shift" do
    test "records the counted float and who opened it", %{scope: scope} do
      register = register_fixture(scope)

      {:ok, shift} = Registers.open_shift(scope, register, %{"opening_float" => "2500.00"})

      assert shift.status == "open"
      assert shift.opened_at
      assert shift.opened_by_id == scope.user.id
      assert_money(shift.opening_float, "2500.00")
      assert_money(Shift.expected_cash(shift), "2500.00")
    end

    test "refuses a second shift on the same till", %{scope: scope} do
      %{register: register} = open_till(scope)

      assert {:error, :shift_already_open} =
               Registers.open_shift(scope, register, %{"opening_float" => "0"})
    end

    test "a till may be opened again once the last shift is closed", %{scope: scope} do
      %{register: register, shift: shift} = open_till(scope)

      {:ok, _closed} = Registers.close_shift(scope, shift, %{"declared_cash" => "1000.00"})

      assert {:ok, second} = Registers.open_shift(scope, register, %{"opening_float" => "500.00"})
      assert second.status == "open"
      refute second.id == shift.id
    end
  end

  # ===========================================================================
  # The drawer
  # ===========================================================================

  describe "cash movements" do
    test "a pay-in adds to the drawer and a pay-out takes from it", %{scope: scope} do
      %{shift: shift} = open_till(scope, %{opening_float: "1000.00"})

      {:ok, pay_in} =
        Registers.record_cash_movement(scope, shift, %{
          "kind" => "pay_in",
          "amount" => "500.00",
          "reason" => "Change brought from the safe"
        })

      assert_money(pay_in.amount, "500.00")
      refute Kaarobar.Registers.CashMovement.outward?(pay_in)

      {:ok, updated} = Registers.fetch_shift(scope, shift.id)

      {:ok, pay_out} =
        Registers.record_cash_movement(scope, updated, %{
          "kind" => "pay_out",
          # Sent positive; the kind decides the sign, not the caller.
          "amount" => "200.00",
          "reason" => "Paid the milkman"
        })

      assert_money(pay_out.amount, "-200.00")
      assert Kaarobar.Registers.CashMovement.outward?(pay_out)

      {:ok, final} = Registers.fetch_shift(scope, shift.id)
      assert_money(final.cash_in, "500.00")
      assert_money(final.cash_out, "200.00")
      assert_money(Shift.expected_cash(final), "1300.00")
    end

    test "needs a reason, because an unexplained one is the whole problem", %{scope: scope} do
      %{shift: shift} = open_till(scope)

      assert {:error, changeset} =
               Registers.record_cash_movement(scope, shift, %{
                 "kind" => "drop",
                 "amount" => "500.00"
               })

      assert "can't be blank" in errors_on(changeset).reason
    end

    test "is refused on a closed shift", %{scope: scope} do
      %{shift: shift} = open_till(scope)
      {:ok, closed} = Registers.close_shift(scope, shift, %{"declared_cash" => "1000.00"})

      assert {:error, :shift_not_open} =
               Registers.record_cash_movement(scope, closed, %{
                 "kind" => "pay_in",
                 "amount" => "100.00",
                 "reason" => "Too late"
               })
    end
  end

  # ===========================================================================
  # Closing
  # ===========================================================================

  describe "closing a shift" do
    test "a drawer that balances closes level", %{scope: scope, variant: variant} do
      %{register: register, shift: shift} = open_till(scope, %{opening_float: "1000.00"})

      {:ok, _sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "3"}],
          "payments" => [
            %{"method" => "cash", "amount" => "300.00", "tendered_amount" => "300.00"}
          ]
        })

      {:ok, current} = Registers.fetch_shift(scope, shift.id)
      {:ok, closed} = Registers.close_shift(scope, current, %{"declared_cash" => "1300.00"})

      assert closed.status == "closed"
      assert closed.closed_at
      assert closed.closed_by_id == scope.user.id
      assert_money(closed.expected_cash, "1300.00")
      assert_money(closed.cash_variance, "0")
      assert Shift.balanced?(closed)
    end

    test "a short drawer still closes, and says how short", %{scope: scope, variant: variant} do
      %{register: register, shift: shift} = open_till(scope, %{opening_float: "1000.00"})

      {:ok, _sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "2"}],
          "payments" => [%{"method" => "cash", "amount" => "200.00"}]
        })

      {:ok, current} = Registers.fetch_shift(scope, shift.id)
      {:ok, closed} = Registers.close_shift(scope, current, %{"declared_cash" => "1150.00"})

      assert closed.status == "closed"
      assert_money(closed.expected_cash, "1200.00")
      assert_money(closed.cash_variance, "-50.00")
      refute Shift.balanced?(closed)
    end

    test "a card sale is counted per tender, not against the drawer", %{
      scope: scope,
      variant: variant
    } do
      %{register: register, shift: shift} = open_till(scope, %{opening_float: "1000.00"})

      {:ok, _sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "4"}],
          "payments" => [%{"method" => "card", "amount" => "400.00"}]
        })

      {:ok, current} = Registers.fetch_shift(scope, shift.id)

      assert_money(Shift.tender_total(current, "card"), "400.00")
      assert_money(Shift.tender_total(current, "cash"), "0")
      # The card money never reached the drawer, so the float is all that is in it.
      assert_money(Shift.expected_cash(current), "1000.00")

      {:ok, closed} = Registers.close_shift(scope, current, %{"declared_cash" => "1000.00"})
      assert Shift.balanced?(closed)
    end

    test "cannot be closed twice", %{scope: scope} do
      %{shift: shift} = open_till(scope)
      {:ok, closed} = Registers.close_shift(scope, shift, %{"declared_cash" => "1000.00"})

      assert {:error, :shift_not_open} =
               Registers.close_shift(scope, closed, %{"declared_cash" => "1000.00"})
    end
  end

  # ===========================================================================
  # Reports
  # ===========================================================================

  describe "reports" do
    test "the X report reads the shift without closing it", %{scope: scope, variant: variant} do
      %{register: register, shift: shift} = open_till(scope, %{opening_float: "1000.00"})

      {:ok, _sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "2"}],
          "payments" => [%{"method" => "cash", "amount" => "200.00"}]
        })

      {:ok, current} = Registers.fetch_shift(scope, shift.id)
      report = Registers.x_report(scope, current)

      assert report.shift.status == "open"
      assert_money(report.expected_cash, "1200.00")
      assert_money(report.net_sales, "200.00")
    end

    test "reconciliation recomputes the same totals from the sales themselves", %{
      scope: scope,
      variant: variant
    } do
      %{register: register, shift: shift} = open_till(scope)

      for _each <- 1..3 do
        {:ok, _sale} =
          Checkout.run(scope, %{
            "register_id" => register.id,
            "lines" => [%{"variant_id" => variant.id, "quantity" => "1"}],
            "payments" => [%{"method" => "cash", "amount" => "100.00"}]
          })
      end

      {:ok, current} = Registers.fetch_shift(scope, shift.id)
      report = Registers.reconcile_shift(scope, current)

      assert report.agrees?
      assert report.computed.sales_count == 3
      assert_money(report.computed.gross_sales, "300.00")
      assert_money(report.recorded.gross_sales, "300.00")
    end
  end
end
