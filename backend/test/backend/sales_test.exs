defmodule Kaarobar.SalesTest do
  @moduledoc """
  The other half of the phase gate: refunds, voids and open tickets all
  balance, and neither ever edits the sale it reverses.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Customers
  alias Kaarobar.Inventory
  alias Kaarobar.Registers
  alias Kaarobar.Sales
  alias Kaarobar.Sales.Checkout
  alias Kaarobar.Sales.RefundRequest

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
  # Voids
  # ===========================================================================

  describe "voiding a sale" do
    test "puts the stock back, reverses the tender and leaves the sale intact", %{
      scope: scope,
      variant: variant,
      branch: branch,
      register: register
    } do
      sale = sale_fixture(scope, variant, register_id: register.id, quantity: "3", amount: "300.00")

      assert_money(on_hand(scope, variant, branch), "17")

      {:ok, voided} = Sales.void_sale(scope, sale, "Rang up the wrong customer")

      assert voided.status == "voided"
      assert voided.void_reason == "Rang up the wrong customer"
      assert voided.voided_at

      # The original figures are untouched: a void reverses, it does not erase.
      assert_money(voided.total, "300.00")
      assert_money(on_hand(scope, variant, branch), "20")

      {:ok, reloaded} = Sales.fetch_sale(scope, sale.id)
      [payment] = reloaded.payments
      assert_money(payment.refunded_amount, "300.00")
    end

    test "requires a reason", %{scope: scope, variant: variant, register: register} do
      sale = sale_fixture(scope, variant, register_id: register.id)

      assert {:error, changeset} = Sales.void_sale(scope, sale, nil)
      assert "is required to void a sale" in errors_on(changeset).void_reason
    end

    test "refuses once anything has been refunded", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      sale = sale_fixture(scope, variant, register_id: register.id, quantity: "2", amount: "200.00")
      [item] = sale.items

      {:ok, _record} =
        Sales.process_return(scope, sale, %{
          "items" => [%{"sale_item_id" => item.id, "quantity" => "1"}]
        })

      {:ok, refunded} = Sales.fetch_sale(scope, sale.id)

      assert {:error, :already_refunded} = Sales.void_sale(scope, refunded, "Too late")
    end

    test "takes the debt off a credit customer's balance", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      customer = customer_fixture(scope, %{"credit_allowed" => true})

      {:ok, sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "customer_id" => customer.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "2"}],
          "payments" => [%{"method" => "credit", "amount" => "200.00"}]
        })

      {:ok, owing} = Customers.fetch_customer(scope, customer.id)
      assert_money(owing.balance, "200.00")

      {:ok, _voided} = Sales.void_sale(scope, sale, "Customer changed their mind")

      {:ok, settled} = Customers.fetch_customer(scope, customer.id)
      assert_money(settled.balance, "0")
    end
  end

  # ===========================================================================
  # Returns
  # ===========================================================================

  describe "a partial return" do
    test "prorates the line, restocks it and refunds the tender", %{
      scope: scope,
      variant: variant,
      branch: branch,
      register: register
    } do
      sale = sale_fixture(scope, variant, register_id: register.id, quantity: "5", amount: "500.00")
      [item] = sale.items

      {:ok, record} =
        Sales.process_return(scope, sale, %{
          "reason" => "Two were the wrong size",
          "items" => [%{"sale_item_id" => item.id, "quantity" => "2"}]
        })

      # Two fifths of a 500 line.
      assert_money(record.total, "200.00")
      # Two fifths of the 300 it cost us.
      assert_money(record.cost_total, "120.00")

      assert [returned] = record.items
      assert_money(returned.quantity, "2")
      assert returned.restock

      # Back on the shelf: 20 less 5 sold, plus 2 returned.
      assert_money(on_hand(scope, variant, branch), "17")

      {:ok, reloaded} = Sales.fetch_sale(scope, sale.id)
      assert reloaded.status == "partially_refunded"
      assert_money(reloaded.refunded_total, "200.00")
      assert_money(Kaarobar.Sales.Sale.refundable_amount(reloaded), "300.00")

      [line] = reloaded.items
      assert_money(line.refunded_quantity, "2")
      assert_money(Kaarobar.Sales.SaleItem.refundable_quantity(line), "3")
    end

    test "a faulty line is taken back and written off rather than shelved", %{
      scope: scope,
      variant: variant,
      branch: branch,
      register: register
    } do
      sale = sale_fixture(scope, variant, register_id: register.id, quantity: "4", amount: "400.00")
      [item] = sale.items

      {:ok, _record} =
        Sales.process_return(scope, sale, %{
          "items" => [
            %{"sale_item_id" => item.id, "quantity" => "1", "restock" => false, "reason" => "Broken"}
          ]
        })

      # 20 less 4 sold. The unit came back and was immediately written off, so
      # the shelf is unchanged — but both movements are on the ledger.
      assert_money(on_hand(scope, variant, branch), "16")

      moves = scope |> Inventory.move_query(%{"variant_id" => variant.id}) |> Repo.all()
      kinds = moves |> Enum.map(& &1.kind) |> Enum.sort()
      assert kinds == ["opening", "sale", "sale_return", "wastage"]
    end

    test "returning the whole sale marks it refunded", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      sale = sale_fixture(scope, variant, register_id: register.id, quantity: "2", amount: "200.00")
      [item] = sale.items

      {:ok, _record} =
        Sales.process_return(scope, sale, %{
          "items" => [%{"sale_item_id" => item.id, "quantity" => "2"}]
        })

      {:ok, reloaded} = Sales.fetch_sale(scope, sale.id)
      assert reloaded.status == "refunded"
      assert_money(Kaarobar.Sales.Sale.refundable_amount(reloaded), "0")
    end

    test "refuses to take back more than was sold", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      sale = sale_fixture(scope, variant, register_id: register.id, quantity: "2", amount: "200.00")
      [item] = sale.items

      result =
        Sales.process_return(scope, sale, %{
          "items" => [%{"sale_item_id" => item.id, "quantity" => "3"}]
        })

      assert {:error, {:exceeds_refundable, item_id}} = result
      assert item_id == item.id
    end

    test "reduces the shift's takings and the drawer", %{
      scope: scope,
      variant: variant,
      register: register,
      shift: shift
    } do
      sale = sale_fixture(scope, variant, register_id: register.id, quantity: "2", amount: "200.00")
      [item] = sale.items

      {:ok, _record} =
        Sales.process_return(scope, sale, %{
          "shift_id" => shift.id,
          "items" => [%{"sale_item_id" => item.id, "quantity" => "1"}]
        })

      {:ok, reloaded} = Registers.fetch_shift(scope, shift.id)

      assert_money(reloaded.gross_sales, "200.00")
      assert_money(reloaded.refund_total, "100.00")
      assert_money(Kaarobar.Registers.Shift.net_sales(reloaded), "100.00")
      # Float 1000, took 200, gave 100 back.
      assert_money(Kaarobar.Registers.Shift.expected_cash(reloaded), "1100.00")
    end
  end

  # ===========================================================================
  # Refund requests
  # ===========================================================================

  describe "the approval workflow" do
    test "a request is raised, approved, and names who did each", %{
      scope: owner,
      variant: variant,
      register: register
    } do
      %{scope: cashier, user: cashier_user} = staff_scope(owner, "cashier")
      cashier = Kaarobar.Scope.put_branch(cashier, owner.branch)

      sale =
        sale_fixture(owner, variant, register_id: register.id, quantity: "1", amount: "100.00")

      [item] = sale.items

      {:ok, request} =
        Sales.create_refund_request(cashier, sale, %{
          "reason" => "Customer says it does not fit",
          "items" => [%{"sale_item_id" => item.id, "quantity" => "1"}]
        })

      assert request.status == "pending"
      assert request.requested_by_id == cashier_user.id
      assert [_line] = request.items
      assert RefundRequest.pending?(request)

      {:ok, approved} = Sales.approve_refund_request(owner, request, "Fine, take it back")

      assert approved.status == "approved"
      assert approved.reviewed_by_id == owner.user.id
      assert RefundRequest.approved?(approved)
    end

    test "a rejection has to say why", %{scope: scope, variant: variant, register: register} do
      sale = sale_fixture(scope, variant, register_id: register.id)
      [item] = sale.items

      {:ok, request} =
        Sales.create_refund_request(scope, sale, %{
          "reason" => "Changed their mind",
          "items" => [%{"sale_item_id" => item.id, "quantity" => "1"}]
        })

      assert {:error, changeset} = Sales.reject_refund_request(scope, request, nil)
      assert "is required when rejecting" in errors_on(changeset).review_note
    end

    test "a decided request cannot be decided again", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      sale = sale_fixture(scope, variant, register_id: register.id)
      [item] = sale.items

      {:ok, request} =
        Sales.create_refund_request(scope, sale, %{
          "reason" => "Faulty",
          "items" => [%{"sale_item_id" => item.id, "quantity" => "1"}]
        })

      {:ok, approved} = Sales.approve_refund_request(scope, request)

      assert {:error, :not_pending} = Sales.reject_refund_request(scope, approved, "Changed my mind")
    end
  end

  # ===========================================================================
  # Open tickets
  # ===========================================================================

  describe "an open ticket" do
    test "holds items, moves no stock, and becomes a sale when it is billed", %{
      scope: scope,
      variant: variant,
      branch: branch,
      register: register
    } do
      {:ok, order} =
        Sales.create_order(scope, %{
          "label" => "Table 4",
          "items" => [%{"variant_id" => variant.id, "quantity" => "2"}]
        })

      assert order.status == "open"
      assert [line] = order.items
      assert_money(line.quantity, "2")
      assert_money(order.total, "200.00")

      # Nothing has moved yet: a ticket is not a sale.
      assert_money(on_hand(scope, variant, branch), "20")

      {:ok, sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "order_id" => order.id,
          "payments" => [%{"method" => "cash", "amount" => "200.00"}]
        })

      assert sale.order_id == order.id
      assert_money(sale.total, "200.00")
      assert_money(on_hand(scope, variant, branch), "18")

      {:ok, billed} = Sales.fetch_order(scope, order.id)
      assert billed.status == "billed"
      assert billed.billed_at
    end

    test "splits: billing half a ticket leaves the rest open", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      {:ok, order} =
        Sales.create_order(scope, %{
          "items" => [%{"variant_id" => variant.id, "quantity" => "4"}]
        })

      [line] = order.items

      {:ok, _first} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "order_id" => order.id,
          "lines" => [
            %{"variant_id" => variant.id, "quantity" => "1", "order_item_id" => line.id}
          ],
          "payments" => [%{"method" => "cash", "amount" => "100.00"}]
        })

      {:ok, partly} = Sales.fetch_order(scope, order.id)
      assert partly.status == "open"

      [updated] = partly.items
      assert_money(updated.billed_quantity, "1")
      assert_money(Kaarobar.Sales.OrderItem.unbilled_quantity(updated), "3")
    end

    test "can be parked and brought back", %{scope: scope, variant: variant} do
      {:ok, order} =
        Sales.create_order(scope, %{"items" => [%{"variant_id" => variant.id, "quantity" => "1"}]})

      {:ok, held} = Sales.hold_order(scope, order)
      assert held.status == "held"

      {:ok, resumed} = Sales.resume_order(scope, held)
      assert resumed.status == "open"
    end

    test "cannot be cancelled once part of it has been paid for", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      {:ok, order} =
        Sales.create_order(scope, %{"items" => [%{"variant_id" => variant.id, "quantity" => "2"}]})

      {:ok, _sale} =
        Checkout.run(scope, %{
          "register_id" => register.id,
          "order_id" => order.id,
          "lines" => [%{"variant_id" => variant.id, "quantity" => "1"}],
          "payments" => [%{"method" => "cash", "amount" => "100.00"}]
        })

      {:ok, partly} = Sales.fetch_order(scope, order.id)

      assert {:error, :already_billed} = Sales.cancel_order(scope, partly, "Walked out")
    end

    test "a cancelled ticket keeps the reason", %{scope: scope, variant: variant} do
      {:ok, order} =
        Sales.create_order(scope, %{"items" => [%{"variant_id" => variant.id, "quantity" => "1"}]})

      {:ok, cancelled} = Sales.cancel_order(scope, order, "Customer left")

      assert cancelled.status == "cancelled"
      assert cancelled.cancel_reason == "Customer left"
    end
  end

  # ===========================================================================
  # Visibility
  # ===========================================================================

  describe "who can see which sales" do
    test "a cashier sees their own; a manager sees the branch's", %{
      scope: owner,
      variant: variant,
      register: register
    } do
      %{scope: cashier} = staff_scope(owner, "cashier")
      cashier = Kaarobar.Scope.put_branch(cashier, owner.branch)

      %{scope: manager} = staff_scope(owner, "manager")
      manager = Kaarobar.Scope.put_branch(manager, owner.branch)

      _theirs = sale_fixture(cashier, variant, register_id: register.id)
      _someone_elses = sale_fixture(owner, variant, register_id: register.id)

      assert length(Sales.list_sales(cashier, %{})) == 1
      assert length(Sales.list_sales(manager, %{})) == 2
    end
  end
end
