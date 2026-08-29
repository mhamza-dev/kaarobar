defmodule KaarobarWeb.SalesControllerTest do
  @moduledoc """
  The till over HTTP.

  Includes the idempotency test the plan calls for: a replayed checkout with
  the same key produces one sale, not two. A shop's connection drops
  mid-request more often than anyone would like, and the retry must not charge
  the customer twice.
  """

  use KaarobarWeb.ConnCase, async: true

  alias Kaarobar.Inventory
  alias Kaarobar.Sales

  setup %{conn: conn} do
    %{scope: scope, user: user, business: business, branch: branch} = owner_scope()
    variant = variant_fixture(scope, %{"name" => "Widget", "price" => "100.00"})
    stock_fixture(scope, variant, "20", unit_cost: "60.00")
    %{register: register, shift: shift} = open_till(scope)

    conn = conn |> sign_in(user, business) |> with_branch(branch)

    %{
      conn: conn,
      scope: scope,
      user: user,
      business: business,
      branch: branch,
      variant: variant,
      register: register,
      shift: shift
    }
  end

  defp basket(variant, register, overrides \\ %{}) do
    Map.merge(
      %{
        "register_id" => register.id,
        "lines" => [%{"variant_id" => variant.id, "quantity" => "2"}],
        "payments" => [
          %{"method" => "cash", "amount" => "200.00", "tendered_amount" => "500.00"}
        ]
      },
      overrides
    )
  end


  # Money arrives as a string so no client rounds it. Comparing as decimals
  # keeps these assertions honest about value rather than about column scale.
  defp assert_amount(actual, expected) do
    assert Decimal.equal?(Decimal.new(actual), Decimal.new(expected)),
           "expected #{expected}, got #{actual}"
  end

  # ===========================================================================
  # Selling
  # ===========================================================================

  describe "POST /api/v1/sales" do
    test "rings up a sale and returns it with its lines and tenders", %{
      conn: conn,
      variant: variant,
      register: register
    } do
      conn = post(conn, ~p"/api/v1/sales", basket(variant, register))

      assert %{"data" => sale} = json_response(conn, 201)
      assert sale["status"] == "completed"
      assert_amount(sale["total"], "200")
      assert_amount(sale["change_due"], "300")
      assert [line] = sale["items"]
      assert line["name"] == "Widget"
      assert [tender] = sale["payments"]
      assert tender["method"] == "cash"
    end

    test "a replay with the same idempotency key produces one sale", %{
      conn: conn,
      scope: scope,
      variant: variant,
      branch: branch,
      register: register
    } do
      key = Ecto.UUID.generate()
      params = basket(variant, register)

      first =
        conn
        |> with_idempotency_key(key)
        |> post(~p"/api/v1/sales", params)

      assert %{"data" => original} = json_response(first, 201)

      second =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> sign_in(scope.user, scope.business)
        |> with_branch(branch)
        |> with_idempotency_key(key)
        |> post(~p"/api/v1/sales", params)

      assert %{"data" => replayed} = json_response(second, 201)

      # The same sale came back, and the stock moved exactly once.
      assert replayed["id"] == original["id"]
      assert replayed["number"] == original["number"]
      assert length(Sales.list_sales(scope, %{})) == 1

      {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)
      assert Decimal.equal?(item.on_hand, Decimal.new(18))
    end

    test "names the item that ran out rather than just refusing", %{
      conn: conn,
      variant: variant,
      register: register
    } do
      params =
        basket(variant, register, %{
          "lines" => [%{"variant_id" => variant.id, "quantity" => "500"}],
          "payments" => [%{"method" => "cash", "amount" => "50000.00"}]
        })

      conn = post(conn, ~p"/api/v1/sales", params)

      assert %{"error" => error} = json_response(conn, 409)
      assert error["code"] == "insufficient_stock"
      assert error["details"]["value"] == variant.id
    end

    test "says how much is missing when the tenders fall short", %{
      conn: conn,
      variant: variant,
      register: register
    } do
      params = basket(variant, register, %{"payments" => [%{"method" => "cash", "amount" => "50"}]})

      conn = post(conn, ~p"/api/v1/sales", params)

      assert %{"error" => error} = json_response(conn, 422)
      assert error["code"] == "underpaid"
      assert_amount(error["details"]["value"], "150")
    end

    test "is refused to someone without the permission", %{
      scope: owner,
      business: business,
      branch: branch,
      variant: variant,
      register: register
    } do
      %{user: viewer} = staff_scope(owner, "viewer")

      conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> sign_in(viewer, business)
        |> with_branch(branch)
        |> post(~p"/api/v1/sales", basket(variant, register))

      assert %{"error" => %{"code" => "forbidden"}} = json_response(conn, 403)
    end
  end

  describe "POST /api/v1/sales/quote" do
    test "prices the basket without writing anything", %{
      conn: conn,
      scope: scope,
      variant: variant,
      register: register
    } do
      conn = post(conn, ~p"/api/v1/sales/quote", basket(variant, register))

      assert %{"data" => summary} = json_response(conn, 200)
      assert_amount(summary["totals"]["total"], "200")
      assert [line] = summary["lines"]
      assert line["name"] == "Widget"

      assert Sales.list_sales(scope, %{}) == []
    end
  end

  # ===========================================================================
  # Reading
  # ===========================================================================

  describe "GET /api/v1/sales" do
    test "lists sales newest first, with pagination metadata", %{
      conn: conn,
      scope: scope,
      variant: variant,
      register: register
    } do
      _first = sale_fixture(scope, variant, register_id: register.id)
      _second = sale_fixture(scope, variant, register_id: register.id)

      conn = get(conn, ~p"/api/v1/sales")

      assert %{"data" => sales, "meta" => meta} = json_response(conn, 200)
      assert length(sales) == 2
      assert Map.has_key?(meta, "next_cursor")
    end

    test "finds one by the number on the receipt", %{
      conn: conn,
      scope: scope,
      variant: variant,
      register: register
    } do
      sale = sale_fixture(scope, variant, register_id: register.id)

      conn = get(conn, ~p"/api/v1/sales/by-number/#{sale.number}")

      assert %{"data" => found} = json_response(conn, 200)
      assert found["id"] == sale.id
    end
  end

  # ===========================================================================
  # Undoing
  # ===========================================================================

  describe "POST /api/v1/sales/:id/void" do
    test "voids with a reason and puts the stock back", %{
      conn: conn,
      scope: scope,
      variant: variant,
      branch: branch,
      register: register
    } do
      sale = sale_fixture(scope, variant, register_id: register.id, quantity: "3", amount: "300.00")

      conn = post(conn, ~p"/api/v1/sales/#{sale.id}/void", %{"reason" => "Wrong customer"})

      assert %{"data" => voided} = json_response(conn, 200)
      assert voided["status"] == "voided"
      assert voided["void_reason"] == "Wrong customer"

      {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)
      assert Decimal.equal?(item.on_hand, Decimal.new(20))
    end
  end

  describe "POST /api/v1/sales/:id/refund" do
    test "takes part of a sale back and prorates the money", %{
      conn: conn,
      scope: scope,
      variant: variant,
      register: register
    } do
      sale = sale_fixture(scope, variant, register_id: register.id, quantity: "4", amount: "400.00")
      [item] = sale.items

      params = %{"items" => [%{"sale_item_id" => item.id, "quantity" => "1"}]}
      conn = post(conn, ~p"/api/v1/sales/#{sale.id}/refund", params)

      assert %{"data" => record} = json_response(conn, 201)
      assert_amount(record["total"], "100")
      assert [returned] = record["items"]
      assert_amount(returned["quantity"], "1")

      {:ok, reloaded} = Sales.fetch_sale(scope, sale.id)
      assert reloaded.status == "partially_refunded"
    end
  end

  # ===========================================================================
  # Tenant isolation
  # ===========================================================================

  describe "isolation" do
    test "another organization's sale is not found", %{
      scope: scope,
      variant: variant,
      register: register
    } do
      sale = sale_fixture(scope, variant, register_id: register.id)

      %{user: outsider, business: their_business, branch: their_branch} = owner_scope()

      conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> sign_in(outsider, their_business)
        |> with_branch(their_branch)
        |> get(~p"/api/v1/sales/#{sale.id}")

      assert json_response(conn, 404)
    end
  end
end
