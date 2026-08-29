defmodule KaarobarWeb.AuthorizationTest do
  @moduledoc """
  Checks that the permission model is actually enforced at the edge.

  `Kaarobar.PolicyMatrixTest` proves the permission sets are right. This proves
  the routes consult them — a route left off the authenticated pipeline, or a
  controller missing its `Authorize` plug, passes every context test and is
  wide open in production.
  """

  use KaarobarWeb.ConnCase, async: true

  alias Kaarobar.AccessControl
  alias Kaarobar.Tenancy

  setup do
    %{scope: owner, user: owner_user, business: business} = owner_scope()
    %{owner: owner, owner_user: owner_user, business: business}
  end

  describe "reads" do
    test "a cashier cannot list staff", %{owner: owner, business: business, conn: conn} do
      %{user: cashier} = staff_scope(owner, "cashier")

      conn = conn |> sign_in(cashier, business) |> get(~p"/api/v1/staff")

      assert %{"code" => "forbidden"} = json_error(conn, 403)
    end

    test "a manager can list staff", %{owner: owner, business: business, conn: conn} do
      %{user: manager} = staff_scope(owner, "manager")

      conn = conn |> sign_in(manager, business) |> get(~p"/api/v1/staff")

      assert is_list(json_data(conn, 200))
    end

    test "a kitchen worker cannot read the audit trail", %{
      owner: owner,
      business: business,
      conn: conn
    } do
      %{user: kitchen} = staff_scope(owner, "kitchen")

      conn = conn |> sign_in(kitchen, business) |> get(~p"/api/v1/audit-logs")

      assert json_error(conn, 403)
    end

    test "an owner can read the audit trail", %{
      owner_user: owner_user,
      business: business,
      conn: conn
    } do
      conn = conn |> sign_in(owner_user, business) |> get(~p"/api/v1/audit-logs")

      assert is_list(json_data(conn, 200))
    end
  end

  describe "writes" do
    test "a cashier cannot create a business", %{owner: owner, business: business, conn: conn} do
      %{user: cashier} = staff_scope(owner, "cashier")

      conn =
        conn
        |> sign_in(cashier, business)
        |> post(~p"/api/v1/businesses", %{"name" => "Mine now", "business_type" => "retail"})

      assert json_error(conn, 403)
    end

    test "a manager cannot create a role", %{owner: owner, business: business, conn: conn} do
      %{user: manager} = staff_scope(owner, "manager")

      conn =
        conn
        |> sign_in(manager, business)
        |> post(~p"/api/v1/roles", %{"name" => "Escalation", "permissions" => []})

      assert json_error(conn, 403)
    end

    test "an owner can create a role", %{owner_user: owner_user, business: business, conn: conn} do
      conn =
        conn
        |> sign_in(owner_user, business)
        |> post(~p"/api/v1/roles", %{
          "name" => "Weekend lead",
          "permissions" => ["sales:checkout"]
        })

      assert %{"key" => "weekend_lead"} = json_data(conn, 201)
    end

    test "a cashier cannot suspend a colleague", %{owner: owner, business: business, conn: conn} do
      %{user: cashier} = staff_scope(owner, "cashier")
      %{membership: colleague} = staff_scope(owner, "cashier")

      conn =
        conn
        |> sign_in(cashier, business)
        |> put(~p"/api/v1/staff/#{colleague.id}/status", %{"status" => "suspended"})

      assert json_error(conn, 403)
    end

    test "a manager cannot promote anyone to administrator", %{
      owner: owner,
      business: business,
      conn: conn
    } do
      %{user: manager} = staff_scope(owner, "manager")
      %{membership: target} = staff_scope(owner, "cashier")
      {:ok, admin_role} = AccessControl.fetch_system_role("admin")

      conn =
        conn
        |> sign_in(manager, business)
        |> put(~p"/api/v1/staff/#{target.id}/roles", %{"role_ids" => [admin_role.id]})

      assert json_error(conn, 403)
    end

    test "a manager can assign a cashier role", %{owner: owner, business: business, conn: conn} do
      %{user: manager} = staff_scope(owner, "manager")
      %{membership: target} = staff_scope(owner, "viewer")
      {:ok, cashier_role} = AccessControl.fetch_system_role("cashier")

      conn =
        conn
        |> sign_in(manager, business)
        |> put(~p"/api/v1/staff/#{target.id}/roles", %{"role_ids" => [cashier_role.id]})

      assert %{"roles" => [%{"key" => "cashier"}]} = json_data(conn, 200)
    end
  end

  describe "tenant isolation at the edge" do
    test "another organization's business cannot be selected", %{conn: conn} do
      %{user: outsider} = owner_scope()
      %{business: theirs} = owner_scope()

      conn =
        conn
        |> sign_in(outsider)
        |> put_req_header("x-business-id", theirs.id)
        |> get(~p"/api/v1/branches")

      assert %{"code" => "not_found"} = json_error(conn, 404)
    end

    test "another organization's branch cannot be fetched", %{
      owner_user: owner_user,
      business: business,
      conn: conn
    } do
      %{branch: theirs} = owner_scope()

      conn =
        conn
        |> sign_in(owner_user, business)
        |> get(~p"/api/v1/branches/#{theirs.id}")

      assert json_error(conn, 404)
    end

    test "another organization's staff cannot be read", %{
      owner_user: owner_user,
      business: business,
      conn: conn
    } do
      %{scope: other_owner} = owner_scope()
      %{membership: theirs} = staff_scope(other_owner, "cashier")

      conn =
        conn
        |> sign_in(owner_user, business)
        |> get(~p"/api/v1/staff/#{theirs.id}")

      assert json_error(conn, 404)
    end

    test "a branch-restricted supervisor sees only their branches", %{
      owner: owner,
      business: business,
      conn: conn
    } do
      {:ok, allowed} = Tenancy.create_branch(owner, %{"name" => "Allowed"})
      {:ok, hidden} = Tenancy.create_branch(owner, %{"name" => "Hidden"})

      %{user: supervisor} = staff_scope(owner, "supervisor", branch_ids: [allowed.id])

      conn = conn |> sign_in(supervisor, business) |> get(~p"/api/v1/branches")

      ids = conn |> json_data(200) |> Enum.map(& &1["id"])

      assert ids == [allowed.id]
      refute hidden.id in ids
    end
  end

  describe "malformed identifiers" do
    test "are answered with 404 rather than a crash", %{
      owner_user: owner_user,
      business: business,
      conn: conn
    } do
      conn = conn |> sign_in(owner_user, business) |> get("/api/v1/branches/not-a-uuid")

      assert %{"code" => "not_found", "details" => details} = json_error(conn, 404)
      assert details["id"]
    end

    test "a bogus business header yields no tenant", %{owner_user: owner_user, conn: conn} do
      conn =
        conn
        |> sign_in(owner_user)
        |> put_req_header("x-business-id", "definitely-not-a-uuid")
        |> get(~p"/api/v1/branches")

      assert json_error(conn, 404)
    end
  end
end
