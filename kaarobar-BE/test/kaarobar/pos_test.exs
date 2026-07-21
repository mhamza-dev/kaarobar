defmodule Kaarobar.PosTest do
  use Kaarobar.DataCase

  alias Kaarobar.{Accounts, Inventory, Pos, Tenancy}
  alias Kaarobar.Schemas.{InventoryRecord, ProductBranchPrice}
  alias Kaarobar.Repo

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "owner-p2-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner"
      })

    {:ok, business} = Tenancy.create_business(owner.id, %{name: "POS Biz"})

    {:ok, branch} =
      Tenancy.create_branch(business.id, owner, %{
        name: "Main",
        discount_auto_approve_limit: "100",
        refund_auto_approve_limit: "500",
        return_window_days: 14
      })

    {:ok, product} =
      Inventory.create_product(business.id, owner.id, %{
        sku: "SKU-#{System.unique_integer()}",
        name: "Test Tea",
        tax_rate: "0.18",
        is_active: true
      })

    {:ok, _} =
      Inventory.set_branch_price(product.id, branch.id, owner.id, business.id, "100")

    {:ok, _} =
      %InventoryRecord{}
      |> InventoryRecord.changeset(%{
        branch_id: branch.id,
        product_id: product.id,
        owner_id: owner.id,
        business_id: business.id,
        quantity_on_hand: Decimal.new("10"),
        avg_cost: Decimal.new("50")
      })
      |> Repo.insert()

    %{owner: owner, business: business, branch: branch, product: product}
  end

  defp sale_attrs(product, opts \\ []) do
    qty = Keyword.get(opts, :qty, "1")
    client_txn_id = Keyword.get(opts, :client_txn_id, Ecto.UUID.generate())
    discount = Keyword.get(opts, :discount_amount, "0")
    tax_amount = Keyword.get(opts, :tax_amount, nil)
    # unit 100 + 18% tax = 118 per unit when explicit tax is not provided
    unit_subtotal = Decimal.mult(Decimal.new(qty), Decimal.new("100"))
    computed_tax = Decimal.mult(Decimal.new(qty), Decimal.new("18"))
    effective_tax = if is_nil(tax_amount), do: computed_tax, else: Decimal.new(to_string(tax_amount))
    total =
      unit_subtotal
      |> Decimal.sub(Decimal.new(discount))
      |> Decimal.add(effective_tax)
      |> Decimal.round(2)

    # When cart discount applied, POS recomputes tax — for simple cases use matching payment after create
    attrs = %{
      client_txn_id: client_txn_id,
      items: [%{product_id: product.id, quantity: qty}],
      discount_amount: discount,
      payments: [%{method: "cash", amount: to_string(total)}]
    }

    if is_nil(tax_amount), do: attrs, else: Map.put(attrs, :tax_amount, to_string(tax_amount))
  end

  test "POS-FR idempotent client_txn_id returns same sale", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    txn = Ecto.UUID.generate()
    attrs = sale_attrs(product, client_txn_id: txn)

    assert {:ok, sale1} = Pos.create_sale(branch.id, owner.id, business.id, owner.id, attrs)
    assert {:ok, sale2} = Pos.create_sale(branch.id, owner.id, business.id, owner.id, attrs)
    assert sale1.id == sale2.id
    assert sale1.invoice_number == sale2.invoice_number

    inv = Inventory.get_inventory(branch.id, product.id, owner.id, business.id)
    assert Decimal.eq?(inv.quantity_on_hand, Decimal.new("9"))
  end

  test "POS-FR stock decrement is atomic and rejects oversell", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    attrs = sale_attrs(product, qty: "11")
    assert {:error, {:insufficient_stock, _}} =
             Pos.create_sale(branch.id, owner.id, business.id, owner.id, attrs)

    inv = Inventory.get_inventory(branch.id, product.id, owner.id, business.id)
    assert Decimal.eq?(inv.quantity_on_hand, Decimal.new("10"))
  end

  test "POS-FR sequential invoice numbers per branch", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    assert {:ok, s1} =
             Pos.create_sale(branch.id, owner.id, business.id, owner.id, sale_attrs(product))

    assert {:ok, s2} =
             Pos.create_sale(branch.id, owner.id, business.id, owner.id, sale_attrs(product))

    assert s1.invoice_number == "INV-000001"
    assert s2.invoice_number == "INV-000002"
  end

  test "POS-FR discount over limit is rejected", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    # limit is 100; discount 150 should fail
    attrs = %{
      client_txn_id: Ecto.UUID.generate(),
      items: [%{product_id: product.id, quantity: "1"}],
      discount_amount: "150",
      payments: [%{method: "cash", amount: "0"}]
    }

    assert {:error, {:discount_exceeds_limit, _}} =
             Pos.create_sale(branch.id, owner.id, business.id, owner.id, attrs)
  end

  test "POS-FR split payments must equal total", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    attrs = %{
      client_txn_id: Ecto.UUID.generate(),
      items: [%{product_id: product.id, quantity: "1"}],
      payments: [
        %{method: "cash", amount: "50"},
        %{method: "card", amount: "50"}
      ]
    }

    assert {:error, {:payment_mismatch, _, _}} =
             Pos.create_sale(branch.id, owner.id, business.id, owner.id, attrs)
  end

  test "POS-FR return auto-approves under refund limit and restores stock", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    {:ok, till} = Pos.open_till(branch.id, owner.id, business.id, owner.id, "500")

    {:ok, sale} =
      Pos.create_sale(branch.id, owner.id, business.id, owner.id, sale_attrs(product, qty: "2"))

    assert {:ok, ret} =
             Pos.create_return(sale.id, owner.id, business.id, branch.id, owner.id, %{
               reason: "customer changed mind",
               refund_method: "cash",
               till_id: till.id,
               items: [%{product_id: product.id, quantity: "1"}]
             })

    assert ret.status == "Approved"

    inv = Inventory.get_inventory(branch.id, product.id, owner.id, business.id)
    # sold 2 (8 left) then returned 1 → 9
    assert Decimal.eq?(inv.quantity_on_hand, Decimal.new("9"))

    sale = Pos.get_sale(sale.id, owner.id)
    assert sale.status == "PartiallyRefunded"
  end

  test "POS-FR till open/close computes over/short", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    assert {:ok, till} = Pos.open_till(branch.id, owner.id, business.id, owner.id, "100")

    {:ok, _sale} =
      Pos.create_sale(
        branch.id,
        owner.id,
        business.id,
        owner.id,
        Map.put(sale_attrs(product), :till_id, till.id)
      )

    # cash sale 118 + opening 100 = expected 218; close with 220 → over 2
    assert {:ok, closed} = Pos.close_till(till.id, owner.id, "220")
    assert closed.status == "closed"
    assert Decimal.eq?(closed.expected_cash, Decimal.new("218.00"))
    assert Decimal.eq?(closed.over_short, Decimal.new("2.00"))
  end

  test "INV-FR transfer confirm moves stock atomically", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    {:ok, branch_b} = Tenancy.create_branch(business.id, owner, %{name: "Outlet B"})

    assert {:ok, transfer} =
             Inventory.create_transfer(business.id, owner.id, %{
               from_branch_id: branch.id,
               to_branch_id: branch_b.id,
               items: [%{product_id: product.id, quantity: "3"}]
             })

    assert {:ok, _} = Inventory.confirm_transfer(transfer.id, owner.id)

    from = Inventory.get_inventory(branch.id, product.id, owner.id, business.id)
    to = Inventory.get_inventory(branch_b.id, product.id, owner.id, business.id)
    assert Decimal.eq?(from.quantity_on_hand, Decimal.new("7"))
    assert Decimal.eq?(to.quantity_on_hand, Decimal.new("3"))
  end

  test "INV-FR stock adjustment audits and blocks negative stock", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    assert {:error, :insufficient_stock} =
             Inventory.adjust_stock(branch.id, owner.id, business.id, owner.id, %{
               product_id: product.id,
               quantity_delta: "-20",
               reason_code: "damage"
             })

    assert {:ok, _} =
             Inventory.adjust_stock(branch.id, owner.id, business.id, owner.id, %{
               product_id: product.id,
               quantity_delta: "-2",
               reason_code: "damage"
             })

    logs = Kaarobar.Audit.list_for_owner(owner.id)
    assert Enum.any?(logs, &(&1.action == "inventory.adjust"))
  end

  test "server uses branch price not client unit_price", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    attrs = %{
      client_txn_id: Ecto.UUID.generate(),
      items: [%{product_id: product.id, quantity: "1", unit_price: "1"}],
      payments: [%{method: "cash", amount: "118.00"}]
    }

    assert {:ok, sale} = Pos.create_sale(branch.id, owner.id, business.id, owner.id, attrs)
    assert Decimal.eq?(sale.total_amount, Decimal.new("118.00"))

    price = Repo.get_by!(ProductBranchPrice, product_id: product.id, branch_id: branch.id)
    assert Decimal.eq?(price.price, Decimal.new("100"))
  end

  test "checkout supports no tax and no discount", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    attrs = sale_attrs(product, tax_amount: "0", discount_amount: "0")
    assert {:ok, sale} = Pos.create_sale(branch.id, owner.id, business.id, owner.id, attrs)
    assert Decimal.eq?(sale.subtotal, Decimal.new("100.00"))
    assert Decimal.eq?(sale.discount_amount, Decimal.new("0.00"))
    assert Decimal.eq?(sale.tax_amount, Decimal.new("0.00"))
    assert Decimal.eq?(sale.total_amount, Decimal.new("100.00"))
  end

  test "checkout supports discount with no tax", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    attrs = sale_attrs(product, tax_amount: "0", discount_amount: "10")
    assert {:ok, sale} = Pos.create_sale(branch.id, owner.id, business.id, owner.id, attrs)
    assert Decimal.eq?(sale.subtotal, Decimal.new("100.00"))
    assert Decimal.eq?(sale.discount_amount, Decimal.new("10.00"))
    assert Decimal.eq?(sale.tax_amount, Decimal.new("0.00"))
    assert Decimal.eq?(sale.total_amount, Decimal.new("90.00"))
  end

  test "checkout supports tax with no discount", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    attrs = sale_attrs(product, tax_amount: "12.50", discount_amount: "0")
    assert {:ok, sale} = Pos.create_sale(branch.id, owner.id, business.id, owner.id, attrs)
    assert Decimal.eq?(sale.subtotal, Decimal.new("100.00"))
    assert Decimal.eq?(sale.discount_amount, Decimal.new("0.00"))
    assert Decimal.eq?(sale.tax_amount, Decimal.new("12.50"))
    assert Decimal.eq?(sale.total_amount, Decimal.new("112.50"))
  end
end
