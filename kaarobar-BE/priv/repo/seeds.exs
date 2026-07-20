alias Kaarobar.{Accounts, Tenancy, Inventory, Billing, Repo}
alias Kaarobar.Schemas.InventoryRecord

IO.puts("Seeding Kaarobar demo tenant...")

{:ok, owner} =
  case Accounts.get_user_by_email("owner@kaarobar.local") do
    nil ->
      Accounts.register(%{
        email: "owner@kaarobar.local",
        password: "password123",
        name: "Demo Owner",
        phone: "+923001234567"
      })

    user ->
      {:ok, user}
  end

{:ok, _} = Billing.ensure_subscription(owner.id)

business =
  case Tenancy.list_businesses_for_owner(owner.id) do
    [b | _] ->
      b

    [] ->
      {:ok, b} =
        Tenancy.create_business(owner.id, %{
          name: "Al-Falah Traders",
          industry: "retail",
          tax_jurisdiction: "PK",
          fbr_tier1: false
        })

      b
  end

branch =
  case Tenancy.list_branches_for_business(business.id, owner.id) do
    [br | _] ->
      br

    [] ->
      {:ok, br} =
        Tenancy.create_branch(business.id, owner.id, %{
          name: "Shahkot Outlet",
          timezone: "Asia/Karachi",
          refund_auto_approve_limit: "5000",
          discount_auto_approve_limit: "1000"
        })

      br
  end

products = [
  %{sku: "TEA-001", name: "Green Tea 250g", price: "450", qty: "50"},
  %{sku: "RCE-010", name: "Basmati Rice 5kg", price: "1850", qty: "30"},
  %{sku: "OIL-003", name: "Cooking Oil 1L", price: "620", qty: "40"}
]

Enum.each(products, fn p ->
  existing =
    Inventory.list_products(business.id, owner.id)
    |> Enum.find(&(&1.sku == p.sku))

  product =
    case existing do
      nil ->
        {:ok, prod} =
          Inventory.create_product(business.id, owner.id, %{
            sku: p.sku,
            name: p.name,
            category: "grocery",
            tax_rate: "0.18",
            is_active: true
          })

        prod

      prod ->
        prod
    end

  Inventory.set_branch_price(product.id, branch.id, owner.id, business.id, p.price)

  case Inventory.get_inventory(branch.id, product.id, owner.id, business.id) do
    nil ->
      %InventoryRecord{}
      |> InventoryRecord.changeset(%{
        branch_id: branch.id,
        product_id: product.id,
        owner_id: owner.id,
        business_id: business.id,
        quantity_on_hand: p.qty,
        avg_cost: Decimal.div(Decimal.new(p.price), Decimal.new("1.3")) |> Decimal.round(2)
      })
      |> Repo.insert!()

    _ ->
      :ok
  end
end)

IO.puts("Seed complete.")
IO.puts("Login: owner@kaarobar.local / password123")
IO.puts("Business: #{business.name} (#{business.id})")
IO.puts("Branch: #{branch.name} (#{branch.id})")
