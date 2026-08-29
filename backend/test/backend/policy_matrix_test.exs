defmodule Kaarobar.PolicyMatrixTest do
  @moduledoc """
  Proves that what the database enforces is what the code says.

  The role templates live in `Kaarobar.AccessControl.RoleTemplates`; the rows
  that actually gate requests live in `roles` and `role_permissions`, written by
  the seed. Nothing keeps those two in step except this test. Without it, an
  edit to a template silently does nothing until someone re-seeds production,
  which is the kind of gap that is only discovered by a cashier who can suddenly
  approve their own refunds.

  Every system role is checked against every permission — allow *and* deny.
  Asserting only what a role can do would let a role that grants everything pass.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.AccessControl.Permissions
  alias Kaarobar.AccessControl.RoleTemplates
  alias Kaarobar.Scope

  setup do
    %{scope: owner} = owner_scope()
    %{owner: owner}
  end

  describe "every system role" do
    for template <- RoleTemplates.all(), template.key != "owner" do
      @role_key template.key

      test "#{@role_key} holds exactly the permissions its template declares", %{owner: owner} do
        %{scope: scope} = staff_scope(owner, @role_key)

        expected = MapSet.new(RoleTemplates.permissions_for(@role_key))

        {granted, denied} =
          Enum.split_with(Permissions.keys(), &Scope.can?(scope, &1))

        assert MapSet.new(granted) == expected, """
        #{@role_key} does not match its template.

        Missing:     #{inspect(MapSet.to_list(MapSet.difference(expected, MapSet.new(granted))))}
        Unexpected:  #{inspect(MapSet.to_list(MapSet.difference(MapSet.new(granted), expected)))}
        """

        # And the complement really is denied, not merely absent from the list.
        for key <- denied do
          refute Scope.can?(scope, key), "#{@role_key} should not hold #{key}"
        end
      end
    end
  end

  describe "the owner" do
    test "holds every permission in the catalogue", %{owner: owner} do
      for key <- Permissions.keys() do
        assert Scope.can?(owner, key), "the owner should hold #{key}"
      end
    end
  end

  describe "separation of duties, end to end" do
    setup %{owner: owner} do
      %{
        cashier: staff_scope(owner, "cashier").scope,
        supervisor: staff_scope(owner, "supervisor").scope,
        manager: staff_scope(owner, "manager").scope,
        accountant: staff_scope(owner, "accountant").scope,
        stock_keeper: staff_scope(owner, "stock_keeper").scope,
        waiter: staff_scope(owner, "waiter").scope,
        kitchen: staff_scope(owner, "kitchen").scope
      }
    end

    test "a cashier requests a refund; a supervisor approves it", context do
      assert Scope.can?(context.cashier, "sale:refund_request")
      refute Scope.can?(context.cashier, "sale:refund_approve")

      assert Scope.can?(context.supervisor, "sale:refund_approve")
    end

    test "a cashier applies a discount; a supervisor overrides the limit", context do
      assert Scope.can?(context.cashier, "discount:apply")
      refute Scope.can?(context.cashier, "discount:override")

      assert Scope.can?(context.supervisor, "discount:override")
    end

    test "nobody below manager can change prices", context do
      refute Scope.can?(context.cashier, "price:edit")
      refute Scope.can?(context.supervisor, "price:edit")
      refute Scope.can?(context.accountant, "price:edit")

      assert Scope.can?(context.manager, "price:edit")
    end

    test "the accountant reads the books but never sells or moves stock", context do
      assert Scope.can?(context.accountant, "report:financial")
      assert Scope.can?(context.accountant, "supplier_payment:record")

      refute Scope.can?(context.accountant, "sales:checkout")
      refute Scope.can?(context.accountant, "stock:adjust")
    end

    test "the stock keeper moves stock but never sells", context do
      assert Scope.can?(context.stock_keeper, "stock:transfer")
      assert Scope.can?(context.stock_keeper, "purchase_order:receive")

      refute Scope.can?(context.stock_keeper, "sales:checkout")
    end

    test "the waiter takes orders but never money", context do
      assert Scope.can?(context.waiter, "order:create")

      refute Scope.can?(context.waiter, "sales:checkout")
      refute Scope.can?(context.waiter, "cash:movement")
    end

    test "the kitchen sees the queue and nothing else", context do
      assert Scope.can?(context.kitchen, "kitchen:bump")

      refute Scope.can?(context.kitchen, "customer:view")
      refute Scope.can?(context.kitchen, "sales:checkout")
    end

    test "only the owner touches billing or erases data", context do
      for scope <- [context.manager, context.supervisor, context.accountant, context.cashier] do
        refute Scope.can?(scope, "organization:billing")
        refute Scope.can?(scope, "organization:delete")
        refute Scope.can?(scope, "data:erase")
      end
    end

    test "nobody below administrator rewrites the permission model", context do
      for scope <- [context.manager, context.supervisor, context.accountant] do
        refute Scope.can?(scope, "role:create")
        refute Scope.can?(scope, "permission:grant")
      end
    end
  end
end
