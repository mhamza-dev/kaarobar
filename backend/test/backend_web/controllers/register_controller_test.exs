defmodule KaarobarWeb.RegisterControllerTest do
  @moduledoc """
  The shift lifecycle over HTTP: open a till, take money, look at the X report,
  count the drawer, close.
  """

  use KaarobarWeb.ConnCase, async: true

  setup %{conn: conn} do
    %{scope: scope, user: user, business: business, branch: branch} = owner_scope()
    variant = variant_fixture(scope, %{"name" => "Widget", "price" => "100.00"})
    stock_fixture(scope, variant, "20", unit_cost: "60.00")

    conn = conn |> sign_in(user, business) |> with_branch(branch)

    %{conn: conn, scope: scope, business: business, branch: branch, variant: variant}
  end


  # Money arrives as a string so no client rounds it. Comparing as decimals
  # keeps these assertions honest about value rather than about column scale.
  defp assert_amount(actual, expected) do
    assert Decimal.equal?(Decimal.new(actual), Decimal.new(expected)),
           "expected #{expected}, got #{actual}"
  end

  describe "the shift lifecycle" do
    test "opens, takes a sale, reports, and closes level", %{
      conn: conn,
      variant: variant
    } do
      created = post(conn, ~p"/api/v1/registers", %{"name" => "Counter 1"})
      assert %{"data" => register} = json_response(created, 201)

      opened =
        post(conn, ~p"/api/v1/registers/#{register["id"]}/shift", %{"opening_float" => "1000.00"})

      assert %{"data" => shift} = json_response(opened, 201)
      assert shift["status"] == "open"
      assert_amount(shift["expected_cash"], "1000")

      sold =
        post(conn, ~p"/api/v1/sales", %{
          "register_id" => register["id"],
          "lines" => [%{"variant_id" => variant.id, "quantity" => "2"}],
          "payments" => [%{"method" => "cash", "amount" => "200.00"}]
        })

      assert json_response(sold, 201)

      report = get(conn, ~p"/api/v1/shifts/#{shift["id"]}/x-report")
      assert %{"data" => x} = json_response(report, 200)
      assert_amount(x["expected_cash"], "1200")
      assert_amount(x["net_sales"], "200")
      assert x["shift"]["status"] == "open"

      closed =
        post(conn, ~p"/api/v1/shifts/#{shift["id"]}/close", %{"declared_cash" => "1200.00"})

      assert %{"data" => final} = json_response(closed, 200)
      assert final["status"] == "closed"
      assert_amount(final["cash_variance"], "0")
      assert final["balanced"] == true
    end

    test "a short drawer closes and reports the difference", %{conn: conn} do
      created = post(conn, ~p"/api/v1/registers", %{"name" => "Counter 2"})
      %{"data" => register} = json_response(created, 201)

      opened =
        post(conn, ~p"/api/v1/registers/#{register["id"]}/shift", %{"opening_float" => "500.00"})

      %{"data" => shift} = json_response(opened, 201)

      closed = post(conn, ~p"/api/v1/shifts/#{shift["id"]}/close", %{"declared_cash" => "480.00"})

      assert %{"data" => final} = json_response(closed, 200)
      assert_amount(final["cash_variance"], "-20")
      assert final["balanced"] == false
    end

    test "refuses a second shift on the same till", %{conn: conn, scope: scope} do
      %{register: register} = open_till(scope)

      conn = post(conn, ~p"/api/v1/registers/#{register.id}/shift", %{"opening_float" => "0"})

      assert %{"error" => %{"code" => "shift_already_open"}} = json_response(conn, 409)
    end
  end

  describe "cash movements" do
    test "a pay-out is recorded with its sign applied and moves the expected cash", %{
      conn: conn,
      scope: scope
    } do
      %{shift: shift} = open_till(scope, %{opening_float: "1000.00"})

      created =
        post(conn, ~p"/api/v1/shifts/#{shift.id}/cash-movements", %{
          "kind" => "pay_out",
          "amount" => "150.00",
          "reason" => "Paid the milkman"
        })

      assert %{"data" => movement} = json_response(created, 201)
      assert_amount(movement["amount"], "-150")
      assert movement["outward"] == true

      listed = get(conn, ~p"/api/v1/shifts/#{shift.id}/cash-movements")
      assert %{"data" => [_one]} = json_response(listed, 200)

      report = get(conn, ~p"/api/v1/shifts/#{shift.id}/x-report")
      assert %{"data" => x} = json_response(report, 200)
      assert_amount(x["expected_cash"], "850")
    end
  end

  describe "permissions" do
    test "a cashier may open and close their own shift but not create tills", %{
      scope: owner,
      business: business,
      branch: branch
    } do
      %{user: cashier} = staff_scope(owner, "cashier")
      register = register_fixture(owner, %{"name" => "Counter 3"})

      conn =
        build_conn()
        |> put_req_header("accept", "application/json")
        |> sign_in(cashier, business)
        |> with_branch(branch)

      opened = post(conn, ~p"/api/v1/registers/#{register.id}/shift", %{"opening_float" => "0"})
      assert json_response(opened, 201)

      refused = post(conn, ~p"/api/v1/registers", %{"name" => "Their own till"})
      assert %{"error" => %{"code" => "forbidden"}} = json_response(refused, 403)
    end
  end
end
