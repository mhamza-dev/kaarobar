defmodule Kaarobar.CatalogTest do
  use Kaarobar.DataCase, async: true

  alias Kaarobar.{Catalog, Inventory, Tenancy, Accounts}

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "catalog-#{System.unique_integer([:positive])}@test.local",
        password: "password123",
        name: "Catalog Owner"
      })

    {:ok, business} =
      Tenancy.create_business(owner.id, %{name: "Test Shop", industry: "restaurant"})

    {:ok, branch} =
      Tenancy.create_branch(business.id, owner, %{name: "Main"})

    %{owner: owner, business: business, branch: branch}
  end

  test "creates product with barcode and finds by barcode", %{
    owner: owner,
    business: business,
    branch: branch
  } do
    {:ok, product} =
      Catalog.create_product(business.id, owner.id, %{
        sku: "SCAN-1",
        name: "Scan Me",
        barcode: "9990001112223",
        product_kind: "goods",
        tax_rate: "0.18"
      })

    {:ok, _} =
      Inventory.set_branch_price(product.id, branch.id, owner.id, business.id, "100")

    assert {:ok, %{product: found, variant: nil}} =
             Catalog.find_by_barcode(business.id, owner.id, "9990001112223")

    assert found.id == product.id
  end

  test "seeds default categories for industry", %{owner: owner, business: business} do
    cats = Catalog.list_categories(business.id, owner.id)
    assert length(cats) >= 3
    assert Enum.any?(cats, &(&1.name == "Beverages"))
  end

  test "variant barcode lookup", %{owner: owner, business: business} do
    {:ok, product} =
      Catalog.create_product(business.id, owner.id, %{
        sku: "VAR-1",
        name: "Sized Item",
        barcode: "1112223334445"
      })

    {:ok, variant} =
      Catalog.create_variant(product, %{
        name: "Large",
        sku: "VAR-1-L",
        barcode: "1112223334445L",
        price_override: "150"
      })

    assert {:ok, %{product: p, variant: v}} =
             Catalog.find_by_barcode(business.id, owner.id, "1112223334445L")

    assert p.id == product.id
    assert v.id == variant.id
  end
end
