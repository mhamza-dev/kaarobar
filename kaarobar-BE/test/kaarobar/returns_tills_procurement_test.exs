defmodule Kaarobar.ReturnsTillsProcurementTest do
  use Kaarobar.DataCase

  alias Kaarobar.{Accounts, Accounting, Inventory, Pos, Tenancy}
  alias Kaarobar.Schemas.{InventoryRecord, JournalEntry, Supplier}
  alias Kaarobar.Repo

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "owner-p3-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner"
      })

    {:ok, business} = Tenancy.create_business(owner.id, %{name: "P3 Biz"})

    {:ok, branch} =
      Tenancy.create_branch(business.id, owner, %{
        name: "Main",
        discount_auto_approve_limit: "50",
        refund_auto_approve_limit: "100",
        return_window_days: 14
      })

    {:ok, product} =
      Inventory.create_product(business.id, owner.id, %{
        sku: "P3-#{System.unique_integer()}",
        name: "P3 Tea",
        tax_rate: "0.18",
        is_active: true
      })

    {:ok, _} = Inventory.set_branch_price(product.id, branch.id, owner.id, business.id, "100")

    {:ok, _} =
      %InventoryRecord{}
      |> InventoryRecord.changeset(%{
        branch_id: branch.id,
        product_id: product.id,
        owner_id: owner.id,
        business_id: business.id,
        quantity_on_hand: Decimal.new("20"),
        avg_cost: Decimal.new("40")
      })
      |> Repo.insert()

    {:ok, supplier} =
      %Supplier{}
      |> Supplier.changeset(%{
        name: "Demo Supplier",
        business_id: business.id,
        owner_id: owner.id
      })
      |> Repo.insert()

    %{
      owner: owner,
      business: business,
      branch: branch,
      product: product,
      supplier: supplier
    }
  end

  defp make_sale(owner, business, branch, product, qty) do
    total =
      Decimal.mult(Decimal.new(qty), Decimal.new("118"))
      |> Decimal.round(2)

    Pos.create_sale(branch.id, owner.id, business.id, owner.id, %{
      client_txn_id: Ecto.UUID.generate(),
      items: [%{product_id: product.id, quantity: qty}],
      payments: [%{method: "cash", amount: to_string(total)}]
    })
  end

  test "POS-FR-008 pending return above refund limit; reject leaves stock unchanged", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    {:ok, till} = Pos.open_till(branch.id, owner.id, business.id, owner.id, "1000")
    # 2 units = 236 refund > limit 100
    {:ok, sale} = make_sale(owner, business, branch, product, "2")

    assert {:ok, ret} =
             Pos.create_return(sale.id, owner.id, business.id, branch.id, owner.id, %{
               refund_method: "cash",
               till_id: till.id,
               items: [%{product_id: product.id, quantity: "2"}]
             })

    assert ret.status == "PendingApproval"

    before = Inventory.get_inventory(branch.id, product.id, owner.id, business.id)

    assert {:ok, rejected} = Pos.reject_return(ret.id, owner.id, owner.id, "manager denied")
    assert rejected.status == "Rejected"

    after_inv = Inventory.get_inventory(branch.id, product.id, owner.id, business.id)
    assert Decimal.eq?(before.quantity_on_hand, after_inv.quantity_on_hand)

    logs = Kaarobar.Audit.list_for_owner(owner.id)
    assert Enum.any?(logs, &(&1.action == "return.reject"))
  end

  test "POS-FR-007/008 approve pending return restores stock and posts journal", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    {:ok, till} = Pos.open_till(branch.id, owner.id, business.id, owner.id, "1000")
    {:ok, sale} = make_sale(owner, business, branch, product, "2")

    {:ok, ret} =
      Pos.create_return(sale.id, owner.id, business.id, branch.id, owner.id, %{
        refund_method: "cash",
        till_id: till.id,
        items: [%{product_id: product.id, quantity: "2"}]
      })

    assert ret.status == "PendingApproval"

    assert {:ok, approved} = Pos.approve_return(ret.id, owner.id, owner.id)
    assert approved.status == "Approved"

    inv = Inventory.get_inventory(branch.id, product.id, owner.id, business.id)
    # sold 2 → 18, return 2 → 20
    assert Decimal.eq?(inv.quantity_on_hand, Decimal.new("20"))

    assert {:ok, _} =
             Accounting.post_return_journal(approved.id, business.id, owner.id, owner.id)

    journal =
      Repo.get_by!(JournalEntry, source_type: "sale_return", source_id: approved.id)

    assert journal.source_id == approved.id
  end

  test "POS-FR-010 till expected cash subtracts only cash refunds on that till", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    {:ok, till} = Pos.open_till(branch.id, owner.id, business.id, owner.id, "100")

    {:ok, sale} =
      Pos.create_sale(
        branch.id,
        owner.id,
        business.id,
        owner.id,
        Map.put(
          %{
            client_txn_id: Ecto.UUID.generate(),
            items: [%{product_id: product.id, quantity: "1"}],
            payments: [%{method: "cash", amount: "118.00"}]
          },
          :till_id,
          till.id
        )
      )

    # Auto-approve: refund 118 <= limit? limit is 100, so pending — use card refund under limit via qty that fits
    # Use 1 unit = 118 > 100 → pending. Approve after.
    {:ok, ret} =
      Pos.create_return(sale.id, owner.id, business.id, branch.id, owner.id, %{
        refund_method: "cash",
        till_id: till.id,
        items: [%{product_id: product.id, quantity: "1"}]
      })

    assert ret.status == "PendingApproval"
    {:ok, _} = Pos.approve_return(ret.id, owner.id, owner.id)

    # opening 100 + sale 118 - refund 118 = 100
    assert {:ok, closed} = Pos.close_till(till.id, owner.id, "100")
    assert Decimal.eq?(closed.expected_cash, Decimal.new("100.00"))
    assert Decimal.eq?(closed.over_short, Decimal.new("0.00"))
  end

  test "INV GRN over-receive is rejected; partial then full marks PO received", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product,
    supplier: supplier
  } do
    assert {:ok, po} =
             Inventory.create_purchase_order(business.id, branch.id, owner.id, %{
               supplier_id: supplier.id,
               items: [%{product_id: product.id, quantity: "10", unit_cost: "40"}]
             })

    assert po.status == "ordered"

    assert {:error, {:over_receive, _}} =
             Inventory.receive_goods(po.id, branch.id, owner.id, business.id, owner.id, %{
               items: [%{product_id: product.id, quantity_received: "11"}]
             })

    assert {:ok, _} =
             Inventory.receive_goods(po.id, branch.id, owner.id, business.id, owner.id, %{
               items: [%{product_id: product.id, quantity_received: "4"}]
             })

    po = Inventory.get_purchase_order(po.id, owner.id)
    assert po.status == "partial"

    assert {:ok, _} =
             Inventory.receive_goods(po.id, branch.id, owner.id, business.id, owner.id, %{
               items: [%{product_id: product.id, quantity_received: "6"}]
             })

    po = Inventory.get_purchase_order(po.id, owner.id)
    assert po.status == "received"

    inv = Inventory.get_inventory(branch.id, product.id, owner.id, business.id)
    assert Decimal.eq?(inv.quantity_on_hand, Decimal.new("30"))
  end

  test "accounting journals persist source_id for sale and GRN", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product,
    supplier: supplier
  } do
    {:ok, sale} = make_sale(owner, business, branch, product, "1")

    assert {:ok, je} =
             Accounting.post_sale_journal(sale.id, business.id, owner.id, owner.id)

    assert je.source_type == "sale"
    assert je.source_id == sale.id

    {:ok, po} =
      Inventory.create_purchase_order(business.id, branch.id, owner.id, %{
        supplier_id: supplier.id,
        items: [%{product_id: product.id, quantity: "2", unit_cost: "40"}]
      })

    {:ok, gr} =
      Inventory.receive_goods(po.id, branch.id, owner.id, business.id, owner.id, %{
        items: [%{product_id: product.id, quantity_received: "2"}]
      })

    assert {:ok, gr_je} =
             Accounting.post_purchase_journal(gr.id, business.id, owner.id, owner.id)

    assert gr_je.source_type == "grn"
    assert gr_je.source_id == gr.id
  end

  test "cash refund requires open till", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    {:ok, sale} = make_sale(owner, business, branch, product, "1")

    assert {:error, :till_required_for_cash_refund} =
             Pos.create_return(sale.id, owner.id, business.id, branch.id, owner.id, %{
               refund_method: "cash",
               items: [%{product_id: product.id, quantity: "1"}]
             })
  end
end
