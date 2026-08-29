defmodule KaarobarWeb.BusinessControllerTest do
  @moduledoc """
  The multi-business, multi-vertical promise, exercised over HTTP.

  One owner, several businesses, each a different kind of shop, each telling
  the client a different set of modules to render — from one schema.
  """

  use KaarobarWeb.ConnCase, async: true

  setup do
    %{scope: owner, user: user, business: business} = owner_scope()
    %{owner: owner, user: user, business: business}
  end

  describe "GET /api/v1/business-types" do
    test "is public, because the signup form needs it", %{conn: conn} do
      conn = get(conn, ~p"/api/v1/business-types")

      assert %{"groups" => groups, "modules" => modules, "product_kinds" => kinds} =
               json_data(conn, 200)

      assert is_map(groups)
      assert "tables" in modules
      assert "service" in kinds

      # Every vertical the product claims to serve is offered at signup.
      all_types =
        groups
        |> Map.values()
        |> List.flatten()
        |> Enum.map(& &1["type"])

      for expected <- ~w(retail fashion grocery restaurant salon laundry agri_supplies rental) do
        assert expected in all_types, "#{expected} should be offered at signup"
      end
    end
  end

  describe "POST /api/v1/businesses" do
    test "creates the business and its main branch", %{conn: conn, user: user, business: business} do
      conn =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/businesses", %{
          "name" => "Karahi Corner",
          "business_type" => "restaurant"
        })

      assert %{
               "name" => "Karahi Corner",
               "business_type" => "restaurant",
               "branches" => [%{"is_main" => true, "code" => "MAIN"}]
             } = json_data(conn, 201)
    end

    test "tells the client which modules to render", %{conn: conn, user: user, business: business} do
      signed_in = sign_in(conn, user, business)

      restaurant =
        signed_in
        |> post(~p"/api/v1/businesses", %{"name" => "Karahi", "business_type" => "restaurant"})
        |> json_data(201)

      assert "tables" in restaurant["modules"]
      assert "kitchen" in restaurant["modules"]
      assert restaurant["required_sale_fields"] == ["service_mode"]

      salon =
        build_conn()
        |> sign_in(user, business)
        |> post(~p"/api/v1/businesses", %{"name" => "Studio Noor", "business_type" => "salon"})
        |> json_data(201)

      assert "appointments" in salon["modules"]
      assert "commissions" in salon["modules"]
      refute "tables" in salon["modules"]
      assert salon["required_sale_fields"] == ["served_by"]
    end

    test "flags the verticals that must track batch and expiry", %{
      conn: conn,
      user: user,
      business: business
    } do
      pesticides =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/businesses", %{
          "name" => "Green Fields Agri",
          "business_type" => "agri_supplies"
        })
        |> json_data(201)

      assert pesticides["requires_batch"]
      assert "batches" in pesticides["modules"]

      clothes =
        build_conn()
        |> sign_in(user, business)
        |> post(~p"/api/v1/businesses", %{"name" => "Threads", "business_type" => "fashion"})
        |> json_data(201)

      refute clothes["requires_batch"]
      assert "variants" in clothes["modules"]
    end

    test "takes in laundry jobs but does not lay tables", %{
      conn: conn,
      user: user,
      business: business
    } do
      laundry =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/businesses", %{"name" => "Crisp Laundry", "business_type" => "laundry"})
        |> json_data(201)

      assert "service_jobs" in laundry["modules"]
      refute "tables" in laundry["modules"]
      assert "service" in laundry["product_kinds"]
    end

    test "refuses an unsupported kind of business", %{
      conn: conn,
      user: user,
      business: business
    } do
      conn =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/businesses", %{"name" => "Nope", "business_type" => "spaceport"})

      assert %{"details" => %{"business_type" => [message]}} = json_error(conn, 422)
      assert message =~ "not a supported"
    end
  end

  describe "GET /api/v1/businesses" do
    test "lists every business the owner runs", %{conn: conn, user: user, business: business} do
      signed_in = sign_in(conn, user, business)

      post(signed_in, ~p"/api/v1/businesses", %{"name" => "Second", "business_type" => "salon"})

      names =
        build_conn()
        |> sign_in(user, business)
        |> get(~p"/api/v1/businesses")
        |> json_data(200)
        |> Enum.map(& &1["name"])

      assert length(names) == 2
      assert "Second" in names
    end
  end

  describe "PATCH /api/v1/businesses/:id" do
    test "updates the details", %{conn: conn, user: user, business: business} do
      conn =
        conn
        |> sign_in(user, business)
        |> patch(~p"/api/v1/businesses/#{business.id}", %{
          "name" => "Renamed Shop",
          "brand_color" => "#2d6df6"
        })

      assert %{"name" => "Renamed Shop", "brand_color" => "#2d6df6"} = json_data(conn, 200)
    end

    test "refuses an invalid brand colour", %{conn: conn, user: user, business: business} do
      conn =
        conn
        |> sign_in(user, business)
        |> patch(~p"/api/v1/businesses/#{business.id}", %{"brand_color" => "blue"})

      assert %{"details" => %{"brand_color" => _messages}} = json_error(conn, 422)
    end

    test "silently ignores an attempt to change the vertical", %{
      conn: conn,
      user: user,
      business: business
    } do
      conn =
        conn
        |> sign_in(user, business)
        |> patch(~p"/api/v1/businesses/#{business.id}", %{"business_type" => "restaurant"})

      assert %{"business_type" => "retail"} = json_data(conn, 200)
    end
  end

  describe "DELETE /api/v1/businesses/:id" do
    test "archives rather than destroys", %{conn: conn, user: user, business: business} do
      conn
      |> sign_in(user, business)
      |> delete(~p"/api/v1/businesses/#{business.id}")
      |> response(204)

      # Gone from the list, still on disk for reporting and audit.
      assert Repo.get(Kaarobar.Tenancy.Business, business.id).deleted_at
    end
  end
end
