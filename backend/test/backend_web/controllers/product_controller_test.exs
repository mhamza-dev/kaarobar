defmodule KaarobarWeb.ProductControllerTest do
  use KaarobarWeb.ConnCase, async: true

  alias Kaarobar.Catalog.Product

  setup do
    %{scope: scope, user: user, business: business} = owner_scope()
    %{scope: scope, user: user, business: business}
  end

  describe "POST /api/v1/products" do
    test "creates a product and its default variant", %{
      conn: conn,
      user: user,
      business: business
    } do
      conn =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/products", %{
          "name" => "Basmati Rice 5kg",
          "price" => "2400.00",
          "sku" => "RICE-5",
          "barcode" => "8964000111222"
        })

      assert %{
               "name" => "Basmati Rice 5kg",
               "kind" => "item",
               "tracks_stock" => true,
               "variants" => [variant]
             } = json_data(conn, 201)

      assert variant["is_default"]
      assert variant["price"] == "2400.0000"
      assert variant["sku"] == "RICE-5"
    end

    test "renders money as a string, never a JSON number", %{
      conn: conn,
      user: user,
      business: business
    } do
      # A price that reaches a browser as an IEEE-754 double has already lost
      # the argument.
      conn =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/products", %{"name" => "Widget", "price" => "1499.50"})

      assert %{"variants" => [%{"price" => price}]} = json_data(conn, 201)
      assert is_binary(price)
    end

    test "reports validation errors per field", %{conn: conn, user: user, business: business} do
      conn =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/products", %{"price" => "10"})

      assert %{"code" => "validation_failed", "details" => details} = json_error(conn, 422)
      assert details["name"]
    end

    test "refuses a kind the vertical does not sell", %{conn: conn} do
      %{scope: salon_scope, user: user, business: business} = owner_scope(business_type: "salon")
      assert salon_scope.business.business_type == "salon"

      conn =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/products", %{
          "name" => "Marquee",
          "kind" => "rental",
          "price" => "5000"
        })

      assert %{"details" => %{"kind" => [message]}} = json_error(conn, 422)
      assert message =~ "not sold by"
    end
  end

  describe "GET /api/v1/products" do
    setup %{scope: scope} do
      product_fixture(scope, %{"name" => "Basmati Rice 5kg", "sku" => "RICE-5"})
      product_fixture(scope, %{"name" => "Sunflower Oil 1L", "sku" => "OIL-1"})
      :ok
    end

    test "lists with cursor pagination", %{conn: conn, user: user, business: business} do
      conn = conn |> sign_in(user, business) |> get(~p"/api/v1/products")

      body = json_response(conn, 200)

      assert length(body["data"]) == 2
      assert body["meta"]["limit"]
      assert Map.has_key?(body["meta"], "has_more")
    end

    test "searches by name", %{conn: conn, user: user, business: business} do
      conn = conn |> sign_in(user, business) |> get(~p"/api/v1/products?q=basmati")

      assert [%{"name" => "Basmati Rice 5kg"}] = json_data(conn, 200)
    end

    test "does not leak another shop's catalog", %{conn: conn, user: user, business: business} do
      %{scope: other} = owner_scope()
      product_fixture(other, %{"name" => "Not yours"})

      names =
        conn
        |> sign_in(user, business)
        |> get(~p"/api/v1/products")
        |> json_data(200)
        |> Enum.map(& &1["name"])

      refute "Not yours" in names
    end
  end

  describe "GET /api/v1/products/scan/:barcode" do
    test "resolves a barcode to a variant with its product", %{
      conn: conn,
      scope: scope,
      user: user,
      business: business
    } do
      product = product_fixture(scope, %{"name" => "Tea", "barcode" => "8964000999888"})

      conn = conn |> sign_in(user, business) |> get(~p"/api/v1/products/scan/8964000999888")

      assert %{"id" => variant_id, "product" => %{"name" => "Tea"}} = json_data(conn, 200)
      assert variant_id == Product.default_variant(product).id
    end

    test "an unknown code is a 404", %{conn: conn, user: user, business: business} do
      conn = conn |> sign_in(user, business) |> get(~p"/api/v1/products/scan/0000000000000")

      assert %{"code" => "not_found"} = json_error(conn, 404)
    end

    test "another shop's barcode is a 404", %{conn: conn, user: user, business: business} do
      %{scope: other} = owner_scope()
      product_fixture(other, %{"barcode" => "7777777777777"})

      conn = conn |> sign_in(user, business) |> get(~p"/api/v1/products/scan/7777777777777")

      assert json_error(conn, 404)
    end
  end

  describe "permissions" do
    test "a cashier may read the catalog but not change it", %{
      conn: conn,
      scope: scope,
      business: business
    } do
      %{user: cashier} = staff_scope(scope, "cashier")

      assert is_list(
               conn |> sign_in(cashier, business) |> get(~p"/api/v1/products") |> json_data(200)
             )

      denied =
        build_conn()
        |> sign_in(cashier, business)
        |> post(~p"/api/v1/products", %{"name" => "Mine now", "price" => "1"})

      assert %{"code" => "forbidden"} = json_error(denied, 403)
    end

    test "a stock keeper may create products", %{conn: conn, scope: scope, business: business} do
      %{user: keeper} = staff_scope(scope, "stock_keeper")

      conn =
        conn
        |> sign_in(keeper, business)
        |> post(~p"/api/v1/products", %{"name" => "New stock", "price" => "50"})

      assert json_data(conn, 201)
    end

    test "a kitchen worker cannot change prices", %{conn: conn, scope: scope, business: business} do
      %{user: kitchen} = staff_scope(scope, "kitchen")
      product = product_fixture(scope, %{"name" => "Dish"})

      conn =
        conn
        |> sign_in(kitchen, business)
        |> patch(~p"/api/v1/products/#{product.id}", %{"name" => "Renamed"})

      assert json_error(conn, 403)
    end
  end

  describe "POST /api/v1/pricing/quote" do
    test "prices a cart with every step shown", %{
      conn: conn,
      scope: scope,
      user: user,
      business: business
    } do
      product = product_fixture(scope, %{"name" => "Widget", "price" => "100.00"})
      variant = Product.default_variant(product)

      price_rule_fixture(scope, %{
        "name" => "Launch offer",
        "kind" => "percent_off",
        "value" => "10"
      })

      conn =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/pricing/quote", %{
          "lines" => [%{"variant_id" => variant.id, "quantity" => "2"}]
        })

      assert %{"lines" => [line], "total" => total} = json_data(conn, 200)

      assert line["base_price"] == "100.00"
      assert line["unit_price"] == "90.00"
      assert [%{"name" => "Launch offer"}] = line["discounts"]
      assert total == "180.00"
    end

    test "an unknown variant is a 404", %{conn: conn, user: user, business: business} do
      conn =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/pricing/quote", %{
          "lines" => [%{"variant_id" => Ecto.UUID.generate(), "quantity" => "1"}]
        })

      assert json_error(conn, 404)
    end

    test "a missing lines key is refused", %{conn: conn, user: user, business: business} do
      conn = conn |> sign_in(user, business) |> post(~p"/api/v1/pricing/quote", %{})

      assert json_error(conn, 422)
    end
  end

  describe "DELETE /api/v1/products/:id" do
    test "archives rather than destroys", %{
      conn: conn,
      scope: scope,
      user: user,
      business: business
    } do
      product = product_fixture(scope)

      conn
      |> sign_in(user, business)
      |> delete(~p"/api/v1/products/#{product.id}")
      |> response(204)

      # Gone from the catalog, still on disk: sale lines reference its variants.
      assert Repo.get(Kaarobar.Catalog.Product, product.id).deleted_at
    end
  end
end
