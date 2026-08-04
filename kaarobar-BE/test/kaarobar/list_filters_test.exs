defmodule Kaarobar.ListFiltersTest do
  @moduledoc """
  List filter behavior for sales / products / customers (tenant-scoped).
  """
  use Kaarobar.DataCase

  alias Kaarobar.{Accounts, Accounting, Catalog, Inventory, Pos, Tenancy}
  alias Kaarobar.Schemas.{Customer, InventoryRecord}
  alias Kaarobar.Repo

  setup do
    {:ok, owner_a} =
      Accounts.register(%{
        email: "owner-lf-a-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner A"
      })

    {:ok, owner_b} =
      Accounts.register(%{
        email: "owner-lf-b-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner B"
      })

    {:ok, biz_a} =
      Tenancy.create_business(owner_a.id, %{name: "Filter Shop A", industry: "retail"})

    {:ok, biz_b} =
      Tenancy.create_business(owner_b.id, %{name: "Filter Shop B", industry: "retail"})

    {:ok, branch_a} = Tenancy.create_branch(biz_a.id, owner_a, %{name: "A Main"})
    {:ok, branch_b} = Tenancy.create_branch(biz_b.id, owner_b, %{name: "B Main"})

    {:ok, cat} = Catalog.create_category(biz_a.id, owner_a.id, %{name: "Beverages"})

    {:ok, tea} =
      Catalog.create_product(biz_a.id, owner_a.id, %{
        sku: "TEA-#{System.unique_integer()}",
        name: "Green Tea",
        category_id: cat.id,
        category: "Beverages",
        tax_rate: "0",
        is_active: true
      })

    {:ok, coffee} =
      Catalog.create_product(biz_a.id, owner_a.id, %{
        sku: "COF-#{System.unique_integer()}",
        name: "Dark Coffee",
        category: "Hot Drinks",
        tax_rate: "0",
        is_active: false
      })

    {:ok, other} =
      Catalog.create_product(biz_b.id, owner_b.id, %{
        sku: "OTH-#{System.unique_integer()}",
        name: "Green Tea Rival",
        tax_rate: "0",
        is_active: true
      })

    {:ok, _} = Inventory.set_branch_price(tea.id, branch_a.id, owner_a.id, biz_a.id, "100")
    {:ok, _} = Inventory.set_branch_price(coffee.id, branch_a.id, owner_a.id, biz_a.id, "120")
    {:ok, _} = Inventory.set_branch_price(other.id, branch_b.id, owner_b.id, biz_b.id, "90")

    for {product, branch, owner, biz} <- [
          {tea, branch_a, owner_a, biz_a},
          {coffee, branch_a, owner_a, biz_a},
          {other, branch_b, owner_b, biz_b}
        ] do
      %InventoryRecord{}
      |> InventoryRecord.changeset(%{
        branch_id: branch.id,
        product_id: product.id,
        owner_id: owner.id,
        business_id: biz.id,
        quantity_on_hand: Decimal.new("20"),
        avg_cost: Decimal.new("40")
      })
      |> Repo.insert!()
    end

    {:ok, cust_a} =
      %Customer{}
      |> Customer.changeset(%{
        name: "Ali Filter",
        phone: "03001112233",
        email: "ali-filter@test.local",
        business_id: biz_a.id,
        owner_id: owner_a.id,
        credit_enabled: true,
        portal_enabled: true
      })
      |> Repo.insert()

    {:ok, _cust_b} =
      %Customer{}
      |> Customer.changeset(%{
        name: "Ali Rival",
        phone: "03009998877",
        business_id: biz_b.id,
        owner_id: owner_b.id
      })
      |> Repo.insert()

    sale_attrs = fn product, customer_id, amount ->
      %{
        client_txn_id: Ecto.UUID.generate(),
        customer_id: customer_id,
        items: [%{product_id: product.id, quantity: "1"}],
        discount_amount: "0",
        tax_amount: "0",
        payments: [%{method: "cash", amount: amount}]
      }
    end

    assert {:ok, sale} =
             Pos.create_sale(
               branch_a.id,
               owner_a.id,
               biz_a.id,
               owner_a.id,
               sale_attrs.(tea, cust_a.id, "100")
             )

    assert {:ok, _} =
             Pos.create_sale(
               branch_b.id,
               owner_b.id,
               biz_b.id,
               owner_b.id,
               sale_attrs.(other, nil, "90")
             )

    %{
      owner_a: owner_a,
      owner_b: owner_b,
      biz_a: biz_a,
      biz_b: biz_b,
      branch_a: branch_a,
      cat: cat,
      tea: tea,
      coffee: coffee,
      other: other,
      cust_a: cust_a,
      sale: sale
    }
  end

  test "products filter by q, active, category_id — tenant scoped", %{
    owner_a: owner_a,
    owner_b: owner_b,
    biz_a: biz_a,
    biz_b: biz_b,
    cat: cat,
    tea: tea,
    coffee: coffee,
    other: other
  } do
    by_q = Catalog.list_products(biz_a.id, owner_a.id, q: "Green").data
    assert Enum.map(by_q, & &1.id) == [tea.id]

    active_only = Catalog.list_products(biz_a.id, owner_a.id, active: true).data
    assert Enum.any?(active_only, &(&1.id == tea.id))
    refute Enum.any?(active_only, &(&1.id == coffee.id))

    inactive_only = Catalog.list_products(biz_a.id, owner_a.id, active: false).data
    assert Enum.map(inactive_only, & &1.id) == [coffee.id]

    by_cat = Catalog.list_products(biz_a.id, owner_a.id, category_id: cat.id).data
    assert Enum.map(by_cat, & &1.id) == [tea.id]

    # SEC-NFR-001: other tenant's matching name must not leak
    a_names = Catalog.list_products(biz_a.id, owner_a.id, q: "Green").data |> Enum.map(& &1.name)
    refute other.name in a_names

    refute Enum.any?(
             Catalog.list_products(biz_b.id, owner_b.id).data,
             &(&1.id == tea.id)
           )
  end

  test "customers filter by q and khata — tenant scoped", %{
    owner_a: owner_a,
    owner_b: owner_b,
    biz_a: biz_a,
    biz_b: biz_b,
    cust_a: cust_a
  } do
    found = Accounting.list_customers(biz_a.id, owner_a.id, q: "Ali").data
    assert Enum.map(found, fn {c, _} -> c.id end) == [cust_a.id]

    khata = Accounting.list_customers(biz_a.id, owner_a.id, credit_enabled: true).data
    assert Enum.map(khata, fn {c, _} -> c.id end) == [cust_a.id]

    portal = Accounting.list_customers(biz_a.id, owner_a.id, portal_enabled: true).data
    assert Enum.map(portal, fn {c, _} -> c.id end) == [cust_a.id]

    # SEC-NFR-001
    b_list = Accounting.list_customers(biz_b.id, owner_b.id, q: "Ali").data
    refute Enum.any?(b_list, fn {c, _} -> c.id == cust_a.id end)
  end

  test "sales filter by q and status — tenant scoped", %{
    owner_a: owner_a,
    owner_b: owner_b,
    biz_a: biz_a,
    biz_b: biz_b,
    branch_a: branch_a,
    sale: sale
  } do
    by_q = Pos.list_sales(branch_a.id, owner_a.id, biz_a.id, q: "Ali").data
    assert Enum.any?(by_q, &(&1.id == sale.id))

    by_status = Pos.list_sales(branch_a.id, owner_a.id, biz_a.id, status: sale.status).data
    assert Enum.any?(by_status, &(&1.id == sale.id))

    today = Date.utc_today()
    from_at = DateTime.new!(today, ~T[00:00:00], "Etc/UTC")
    to_at = DateTime.new!(today, ~T[23:59:59], "Etc/UTC")

    by_range =
      Pos.list_sales(branch_a.id, owner_a.id, biz_a.id, from: from_at, to: to_at).data

    assert Enum.any?(by_range, &(&1.id == sale.id))

    # SEC-NFR-001
    b_sales = Pos.list_sales(nil, owner_b.id, biz_b.id, q: sale.invoice_number).data
    refute Enum.any?(b_sales, &(&1.id == sale.id))
  end

  test "Inventory.list_products passes filter opts through", %{
    owner_a: owner_a,
    biz_a: biz_a,
    tea: tea
  } do
    [only] = Inventory.list_products(biz_a.id, owner_a.id, q: tea.sku).data
    assert only.id == tea.id
  end
end
