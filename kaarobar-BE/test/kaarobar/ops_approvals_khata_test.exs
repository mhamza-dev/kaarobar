defmodule Kaarobar.OpsApprovalsKhataTest do
  use Kaarobar.DataCase

  alias Kaarobar.{Accounts, Accounting, Inventory, Notifications, Pos, Roles, Tenancy}
  alias Kaarobar.Schemas.{Customer, InventoryRecord, Notification}

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "owner-ops-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner"
      })

    {:ok, business} = Tenancy.create_business(owner.id, %{name: "Ops Biz"})
    {:ok, branch} = Tenancy.create_branch(business.id, owner, %{name: "Main"})

    {:ok, admin} =
      Accounts.register(%{
        email: "admin-ops-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Admin"
      })

    {:ok, _} =
      Tenancy.create_membership(owner, %{
        user_id: admin.id,
        business_id: business.id,
        branch_id: branch.id,
        roles: ["admin"]
      })

    {:ok, product} =
      Inventory.create_product(business.id, owner.id, %{
        sku: "SKU-#{System.unique_integer()}",
        name: "Test Tea",
        tax_rate: "0",
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
        quantity_on_hand: Decimal.new("10"),
        avg_cost: Decimal.new("50")
      })
      |> Repo.insert()

    %{owner: owner, admin: admin, business: business, branch: branch, product: product}
  end

  test "leave_approve and pos_approve exclude branch_manager" do
    assert Roles.bundle_allowed?(:leave_approve, "owner")
    assert Roles.bundle_allowed?(:leave_approve, "admin")
    assert Roles.bundle_allowed?(:leave_approve, "hr_manager")
    refute Roles.bundle_allowed?(:leave_approve, "branch_manager")

    assert Roles.bundle_allowed?(:pos_approve, "owner")
    assert Roles.bundle_allowed?(:pos_approve, "admin")
    refute Roles.bundle_allowed?(:pos_approve, "branch_manager")
  end

  test "khata sale creates AR invoice and ledger", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    {:ok, customer} =
      %Customer{}
      |> Customer.changeset(%{
        name: "Ali",
        phone: "03001234567",
        khata_enabled: true,
        business_id: business.id,
        owner_id: owner.id
      })
      |> Repo.insert()

    attrs = %{
      client_txn_id: Ecto.UUID.generate(),
      customer_id: customer.id,
      items: [%{product_id: product.id, quantity: "1"}],
      tax_amount: "0",
      discount_amount: "0",
      payments: [%{method: "khata", amount: "100"}]
    }

    assert {:ok, sale} = Pos.create_sale(branch.id, owner.id, business.id, owner.id, attrs)
    sale = Repo.preload(sale, [:payments])
    assert sale.customer_id == customer.id
    assert Enum.any?(sale.payments, &(&1.method == "khata"))
    assert sale.ar_invoice_id

    balance = Accounting.customer_balance(customer.id, business.id, owner.id)
    assert Decimal.compare(Decimal.new(balance), Decimal.new("0")) == :gt

    entries = Accounting.customer_ledger(customer.id, business.id, owner.id)
    assert entries != []
  end

  test "low stock notify debounced per day", %{
    owner: owner,
    business: business,
    branch: branch,
    product: product
  } do
    inv = Repo.get_by!(InventoryRecord, branch_id: branch.id, product_id: product.id)

    inv
    |> InventoryRecord.changeset(%{quantity_on_hand: Decimal.new("3")})
    |> Repo.update!()

    assert :ok = Inventory.maybe_notify_low_stock(branch.id, product.id, business.id, owner.id)

    count1 =
      from(n in Notification,
        where: n.type == "inventory.low_stock" and n.channel == "in_app" and n.user_id == ^owner.id
      )
      |> Repo.aggregate(:count)

    assert count1 >= 1

    assert :ok = Inventory.maybe_notify_low_stock(branch.id, product.id, business.id, owner.id)

    count2 =
      from(n in Notification,
        where: n.type == "inventory.low_stock" and n.channel == "in_app" and n.user_id == ^owner.id
      )
      |> Repo.aggregate(:count)

    assert count2 == count1
  end

  test "notify_roles fans out to matching memberships", %{
    owner: owner,
    admin: admin,
    business: business
  } do
    assert {:ok, n} =
             Notifications.notify_roles(
               business.id,
               owner.id,
               ["owner", "admin"],
               "return.pending",
               %{x: 1},
               title: "Return",
               body: "Pending"
             )

    assert n >= 2
    assert Repo.get_by(Notification, user_id: admin.id, type: "return.pending", channel: "in_app")
  end
end
