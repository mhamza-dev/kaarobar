defmodule Kaarobar.MarketplaceProductsTest do
  @moduledoc """
  Public marketplace product feed (CUS-FR-012).
  """
  use KaarobarWeb.ConnCase

  alias Kaarobar.{Accounts, Catalog, Inventory, Marketplace, Tenancy}
  alias Kaarobar.Repo

  setup do
    {:ok, owner_a} =
      Accounts.register(%{
        email: "mkt-owner-a-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner A"
      })

    {:ok, owner_b} =
      Accounts.register(%{
        email: "mkt-owner-b-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner B"
      })

    {:ok, pub_biz} =
      Tenancy.create_business(owner_a.id, %{name: "Public Mart", industry: "retail"})

    {:ok, priv_biz} =
      Tenancy.create_business(owner_a.id, %{name: "Private Shop", industry: "retail"})

    {:ok, other_pub} =
      Tenancy.create_business(owner_b.id, %{name: "Other Market", industry: "salon"})

    {:ok, pub_branch} = Tenancy.create_branch(pub_biz.id, owner_a, %{name: "Public HQ"})
    {:ok, priv_branch} = Tenancy.create_branch(priv_biz.id, owner_a, %{name: "Private HQ"})
    {:ok, other_branch} = Tenancy.create_branch(other_pub.id, owner_b, %{name: "Other HQ"})

    pub_biz =
      pub_biz
      |> Ecto.Changeset.change(%{
        marketplace_enabled: true,
        online_branch_id: pub_branch.id,
        marketplace_slug: "public-mart-#{System.unique_integer()}"
      })
      |> Repo.update!()

    _priv_biz =
      priv_biz
      |> Ecto.Changeset.change(%{
        marketplace_enabled: false,
        online_branch_id: priv_branch.id
      })
      |> Repo.update!()

    other_pub =
      other_pub
      |> Ecto.Changeset.change(%{
        marketplace_enabled: true,
        online_branch_id: other_branch.id,
        marketplace_slug: "other-market-#{System.unique_integer()}"
      })
      |> Repo.update!()

    {:ok, tea} =
      Catalog.create_product(pub_biz.id, owner_a.id, %{
        name: "Green Tea",
        sku: "TEA-#{System.unique_integer()}",
        category: "Beverages",
        product_kind: "goods",
        tax_rate: "0"
      })

    {:ok, _} = Inventory.set_branch_price(tea.id, pub_branch.id, owner_a.id, pub_biz.id, "150")

    {:ok, secret} =
      Catalog.create_product(priv_biz.id, owner_a.id, %{
        name: "Secret Item",
        sku: "SEC-#{System.unique_integer()}",
        category: "Hidden",
        product_kind: "goods",
        tax_rate: "0"
      })

    {:ok, _} =
      Inventory.set_branch_price(secret.id, priv_branch.id, owner_a.id, priv_biz.id, "999")

    {:ok, cut} =
      Catalog.create_product(other_pub.id, owner_b.id, %{
        name: "Haircut",
        sku: "CUT-#{System.unique_integer()}",
        category: "Services",
        product_kind: "service",
        track_inventory: false,
        tax_rate: "0"
      })

    {:ok, _} = Inventory.set_branch_price(cut.id, other_branch.id, owner_b.id, other_pub.id, "500")

    {:ok, inactive} =
      Catalog.create_product(pub_biz.id, owner_a.id, %{
        name: "Inactive Snack",
        sku: "INA-#{System.unique_integer()}",
        category: "Snacks",
        product_kind: "goods",
        is_active: false,
        tax_rate: "0"
      })

    {:ok, _} =
      Inventory.set_branch_price(inactive.id, pub_branch.id, owner_a.id, pub_biz.id, "50")

    %{
      pub_biz: pub_biz,
      other_pub: other_pub,
      tea: tea,
      secret: secret,
      cut: cut,
      inactive: inactive
    }
  end

  test "CUS-FR-012 marketplace products appear with business fields and price", %{
    pub_biz: pub_biz,
    tea: tea,
    conn: conn
  } do
    %{data: data, meta: meta} = Marketplace.list_products()

    ids = Enum.map(data, & &1.id)
    assert tea.id in ids
    assert meta.limit == 24
    assert meta.next_cursor == nil

    row = Enum.find(data, &(&1.id == tea.id))
    assert row.name == "Green Tea"
    assert row.price in ["150", "150.00"]
    assert row.category == "Beverages"
    assert row.product_kind == "goods"
    assert row.business_id == pub_biz.id
    assert row.business_name == "Public Mart"
    assert row.business_slug == pub_biz.marketplace_slug
    assert row.industry == "retail"
    assert Map.has_key?(row, :image_url)

    conn = get(conn, "/api/v1/marketplace/products")
    body = json_response(conn, 200)
    assert Enum.any?(body["data"], &(&1["id"] == tea.id))
    assert is_map(body["meta"])
  end

  test "CUS-FR-012 non-marketplace and inactive products are excluded", %{
    tea: tea,
    secret: secret,
    cut: cut,
    inactive: inactive
  } do
    %{data: data} = Marketplace.list_products()
    ids = Enum.map(data, & &1.id)

    assert tea.id in ids
    assert cut.id in ids
    refute secret.id in ids
    refute inactive.id in ids
  end

  test "CUS-FR-012 tenant isolation: private catalog never leaks across owners", %{
    tea: tea,
    cut: cut,
    secret: secret,
    pub_biz: pub_biz,
    other_pub: other_pub
  } do
    %{data: data} = Marketplace.list_products()

    by_id = Map.new(data, &{&1.id, &1})

    assert by_id[tea.id].business_id == pub_biz.id
    assert by_id[cut.id].business_id == other_pub.id
    refute Map.has_key?(by_id, secret.id)

    # Owner A private shop stays out of the public feed even when same owner has a marketplace store
    refute Enum.any?(data, &(&1.name == "Secret Item"))
  end

  test "CUS-FR-012 filters by q, category, industry and paginates with cursor", %{
    tea: tea,
    cut: cut
  } do
    %{data: by_q} = Marketplace.list_products(q: "Green")
    assert Enum.map(by_q, & &1.id) == [tea.id]

    %{data: by_cat} = Marketplace.list_products(category: "Services")
    assert Enum.map(by_cat, & &1.id) == [cut.id]

    %{data: by_ind} = Marketplace.list_products(industry: "salon")
    assert Enum.map(by_ind, & &1.id) == [cut.id]

    %{data: page1, meta: meta1} = Marketplace.list_products(limit: 1)
    assert length(page1) == 1
    assert is_binary(meta1.next_cursor)

    %{data: page2, meta: meta2} = Marketplace.list_products(limit: 1, cursor: meta1.next_cursor)
    assert length(page2) == 1
    assert hd(page1).id != hd(page2).id
    assert meta2.next_cursor == nil or is_binary(meta2.next_cursor)
  end

  test "CUS-FR-012 multi-value category and industry filters", %{
    tea: tea,
    cut: cut,
    conn: conn
  } do
    %{data: by_csv_cat} = Marketplace.list_products(category: "Beverages,Services")
    csv_cat_ids = Enum.map(by_csv_cat, & &1.id)
    assert tea.id in csv_cat_ids
    assert cut.id in csv_cat_ids

    %{data: by_list_cat} = Marketplace.list_products(category: ["Beverages", "Services"])
    list_cat_ids = Enum.map(by_list_cat, & &1.id)
    assert tea.id in list_cat_ids
    assert cut.id in list_cat_ids

    %{data: by_csv_ind} = Marketplace.list_products(industry: "retail,salon")
    csv_ind_ids = Enum.map(by_csv_ind, & &1.id)
    assert tea.id in csv_ind_ids
    assert cut.id in csv_ind_ids

    %{data: by_list_ind} = Marketplace.list_products(industry: ["retail", "salon"])
    list_ind_ids = Enum.map(by_list_ind, & &1.id)
    assert tea.id in list_ind_ids
    assert cut.id in list_ind_ids

    # Blank / empty values do not filter
    %{data: blank_cat} = Marketplace.list_products(category: "")
    assert tea.id in Enum.map(blank_cat, & &1.id)
    assert cut.id in Enum.map(blank_cat, & &1.id)

    %{data: empty_list} = Marketplace.list_products(category: [])
    assert tea.id in Enum.map(empty_list, & &1.id)

    conn = get(conn, "/api/v1/marketplace/products?category=Beverages%2CServices")
    body = json_response(conn, 200)
    api_ids = Enum.map(body["data"], & &1["id"])
    assert tea.id in api_ids
    assert cut.id in api_ids
  end
end
