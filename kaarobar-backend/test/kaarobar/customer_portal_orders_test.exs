defmodule Kaarobar.CustomerPortalOrdersTest do
  use Kaarobar.DataCase

  alias Kaarobar.{Accounts, Catalog, CustomerPortal, Marketplace, Tenancy}
  alias Kaarobar.Repo

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "owner-orders-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner"
      })

    {:ok, biz_a} = Tenancy.create_business(owner.id, %{name: "Store A"})
    {:ok, biz_b} = Tenancy.create_business(owner.id, %{name: "Store B"})
    {:ok, branch_a} = Tenancy.create_branch(biz_a.id, owner, %{name: "A HQ"})
    {:ok, branch_b} = Tenancy.create_branch(biz_b.id, owner, %{name: "B HQ"})

    _ =
      biz_a
      |> Ecto.Changeset.change(%{
        marketplace_enabled: true,
        online_branch_id: branch_a.id,
        marketplace_slug: "store-a-#{System.unique_integer()}"
      })
      |> Repo.update!()

    _ =
      biz_b
      |> Ecto.Changeset.change(%{
        marketplace_enabled: true,
        online_branch_id: branch_b.id,
        marketplace_slug: "store-b-#{System.unique_integer()}"
      })
      |> Repo.update!()

    {:ok, product_a} =
      Catalog.create_product(biz_a.id, owner.id, %{
        name: "Item A",
        sku: "A-#{System.unique_integer()}",
        product_kind: "service",
        track_inventory: false,
        tax_rate: "0",
        branch_prices: [%{branch_id: branch_a.id, price: "100"}]
      })

    {:ok, product_b} =
      Catalog.create_product(biz_b.id, owner.id, %{
        name: "Item B",
        sku: "B-#{System.unique_integer()}",
        product_kind: "service",
        track_inventory: false,
        tax_rate: "0",
        branch_prices: [%{branch_id: branch_b.id, price: "50"}]
      })

    {:ok, account} =
      CustomerPortal.register(%{
        email: "buyer-orders-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Buyer"
      })

    %{
      account: account,
      biz_a: biz_a,
      biz_b: biz_b,
      product_a: product_a,
      product_b: product_b
    }
  end

  test "CUS order history lists orders across stores; optional business_id filters", %{
    account: account,
    biz_a: biz_a,
    biz_b: biz_b,
    product_a: product_a,
    product_b: product_b
  } do
    assert {:ok, sale_a} =
             Marketplace.place_order(account, %{
               "business_id" => biz_a.id,
               "payment_method" => "card",
               "items" => [%{"product_id" => product_a.id, "quantity" => "1"}]
             })

    assert {:ok, sale_b} =
             Marketplace.place_order(account, %{
               "business_id" => biz_b.id,
               "payment_method" => "card",
               "items" => [%{"product_id" => product_b.id, "quantity" => "1"}]
             })

    all = CustomerPortal.list_orders(account)
    ids = Enum.map(all, & &1.id)
    assert sale_a.id in ids
    assert sale_b.id in ids

    only_a = CustomerPortal.list_orders(account, business_id: biz_a.id)
    assert Enum.map(only_a, & &1.id) == [sale_a.id]

    # Soft header-style filter must not be implied — nil/blank means all stores
    assert length(CustomerPortal.list_orders(account, business_id: nil)) == 2
    assert length(CustomerPortal.list_orders(account, business_id: "")) == 2
  end
end
