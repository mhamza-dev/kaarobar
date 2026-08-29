defmodule Kaarobar.AccessControl.RoleTemplatesTest do
  use ExUnit.Case, async: true

  alias Kaarobar.AccessControl.Permissions
  alias Kaarobar.AccessControl.RoleTemplates

  describe "template integrity" do
    test "every template only grants permissions that exist" do
      for template <- RoleTemplates.all() do
        unknown = Enum.reject(template.permissions, &Permissions.known?/1)

        assert unknown == [], "#{template.key} grants unknown permissions: #{inspect(unknown)}"
      end
    end

    test "every template has a name, a description and at least one permission" do
      for template <- RoleTemplates.all() do
        assert is_binary(template.name) and template.name != ""
        assert is_binary(template.description) and template.description != ""
        assert template.permissions != [], "#{template.key} grants nothing"
      end
    end

    test "role keys are unique" do
      keys = RoleTemplates.keys()

      assert length(keys) == length(Enum.uniq(keys))
    end

    test "all/0 is ordered from most to least powerful" do
      ranks = Enum.map(RoleTemplates.all(), & &1.rank)

      assert ranks == Enum.sort(ranks)
    end
  end

  describe "owner and admin" do
    test "the owner template holds every permission" do
      assert Enum.sort(RoleTemplates.permissions_for("owner")) == Enum.sort(Permissions.keys())
    end

    test "an administrator can do everything except destroy the organization" do
      admin = RoleTemplates.permissions_for("admin")

      refute "organization:delete" in admin
      assert "organization:billing" in admin
      assert "role:create" in admin
      assert length(admin) == length(Permissions.keys()) - 1
    end
  end

  describe "the manager boundary" do
    test "a manager runs the business but cannot rewrite the permission model" do
      manager = RoleTemplates.permissions_for("manager")

      assert "sales:checkout" in manager
      assert "purchase_order:approve" in manager
      assert "staff:invite" in manager
      assert "report:financial" in manager

      refute "role:create" in manager
      refute "role:edit" in manager
      refute "permission:grant" in manager
      refute "organization:billing" in manager
      refute "organization:delete" in manager
      refute "data:erase" in manager
    end
  end

  describe "counter and floor roles" do
    test "a cashier sells but cannot approve their own refund" do
      cashier = RoleTemplates.permissions_for("cashier")

      assert "sales:checkout" in cashier
      assert "sale:refund_request" in cashier

      refute "sale:refund_approve" in cashier
      refute "sale:void" in cashier
      refute "discount:override" in cashier
      refute "sale:view_all" in cashier
      refute "product:edit" in cashier
      refute "price:edit" in cashier
    end

    test "a supervisor exists to approve what the cashier cannot" do
      supervisor = RoleTemplates.permissions_for("supervisor")

      assert "sale:refund_approve" in supervisor
      assert "sale:void" in supervisor
      assert "discount:override" in supervisor
      assert "sale:view_all" in supervisor
    end

    test "a waiter takes orders but never takes money" do
      waiter = RoleTemplates.permissions_for("waiter")

      assert "order:create" in waiter
      assert "table:view" in waiter

      refute "sales:checkout" in waiter
      refute "cash:movement" in waiter
      refute "shift:open" in waiter
    end

    test "kitchen and rider roles are narrow by design" do
      kitchen = RoleTemplates.permissions_for("kitchen")
      rider = RoleTemplates.permissions_for("rider")

      assert "kitchen:bump" in kitchen
      refute "sales:checkout" in kitchen
      refute "customer:view" in kitchen

      assert "delivery:update" in rider
      refute "sales:checkout" in rider
      refute "delivery:assign" in rider
    end
  end

  describe "back-office roles" do
    test "a stock keeper moves goods but does not sell them" do
      stock_keeper = RoleTemplates.permissions_for("stock_keeper")

      assert "stock:transfer" in stock_keeper
      assert "purchase_order:receive" in stock_keeper
      assert "batch:manage" in stock_keeper

      refute "sales:checkout" in stock_keeper
      refute "sale:refund_approve" in stock_keeper
    end

    test "an accountant reads the books but does not touch stock or prices" do
      accountant = RoleTemplates.permissions_for("accountant")

      assert "report:financial" in accountant
      assert "supplier_payment:record" in accountant
      assert "credit:adjust" in accountant
      assert "valuation:view" in accountant

      refute "sales:checkout" in accountant
      refute "stock:adjust" in accountant
      refute "price:edit" in accountant
    end
  end

  describe "service roles" do
    test "a stylist owns their book and can ring up the client they served" do
      stylist = RoleTemplates.permissions_for("stylist")

      assert "appointment:manage" in stylist
      assert "sales:checkout" in stylist
      assert "commission:view" in stylist

      refute "product:edit" in stylist
      refute "staff:invite" in stylist
    end

    test "a technician takes a job in and hands it back" do
      technician = RoleTemplates.permissions_for("technician")

      assert "service_job:create" in technician
      assert "service_job:deliver" in technician

      refute "sales:checkout" in technician
      refute "stock:adjust" in technician
    end
  end

  describe "viewer" do
    test "holds every read permission and no write permission" do
      viewer = RoleTemplates.permissions_for("viewer")

      assert "sale:view" in viewer
      assert "inventory:view" in viewer
      assert "report:sales" in viewer

      writes = Enum.reject(viewer, &(String.ends_with?(&1, ":view") or &1 =~ ~r/^report:/))
      assert writes == [], "viewer should never hold a write permission: #{inspect(writes)}"
    end
  end

  describe "can_assign?/2" do
    test "a role may assign its own rank and below" do
      assert RoleTemplates.can_assign?(["admin"], "manager")
      assert RoleTemplates.can_assign?(["manager"], "cashier")
      assert RoleTemplates.can_assign?(["manager"], "manager")
    end

    test "a role may never assign a more powerful one" do
      refute RoleTemplates.can_assign?(["manager"], "admin")
      refute RoleTemplates.can_assign?(["cashier"], "manager")
      refute RoleTemplates.can_assign?(["viewer"], "cashier")
    end

    test "the most powerful role held is what counts" do
      assert RoleTemplates.can_assign?(["cashier", "admin"], "manager")
    end

    test "holding no role assigns nothing" do
      refute RoleTemplates.can_assign?([], "cashier")
    end

    test "an unknown role is treated as the least powerful, never as an escalation" do
      refute RoleTemplates.can_assign?(["not_a_role"], "cashier")
      assert RoleTemplates.rank("not_a_role") > RoleTemplates.rank("viewer")
    end
  end

  describe "system_role?/1" do
    test "recognises seeded roles only" do
      assert RoleTemplates.system_role?("owner")
      assert RoleTemplates.system_role?("technician")
      refute RoleTemplates.system_role?("weekend_supervisor")
      refute RoleTemplates.system_role?(nil)
    end
  end
end
