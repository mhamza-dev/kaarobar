alias Kaarobar.{
  Accounts,
  Accounting,
  Billing,
  Hr,
  Inventory,
  Pos,
  Repo,
  Tenancy
}

alias Kaarobar.Schemas.{InventoryRecord, Supplier}

import Ecto.Query

IO.puts("\n=== Kaarobar demo seed ===\n")

# —— Owner ————————————————————————————————————————————————————————

{:ok, owner} =
  case Accounts.get_user_by_email("owner@kaarobar.local") do
    nil ->
      Accounts.register(%{
        email: "owner@kaarobar.local",
        password: "Password@123",
        name: "Demo Owner",
        phone: "+923001234567"
      })

    user ->
      {:ok, user}
  end

{:ok, _} = Billing.set_plan(owner.id, "enterprise")

# —— Staff users (shared across businesses via memberships) ————

staff_specs = [
  {"manager@kaarobar.local", "Branch Manager", "Ayesha Khan", ["branch_manager"]},
  {"cashier@kaarobar.local", "Cashier", "Bilal Ahmed", ["cashier"]},
  {"accountant@kaarobar.local", "Accountant", "Sana Malik", ["accountant"]},
  {"hr@kaarobar.local", "HR Manager", "Imran Ali", ["hr_manager"]},
  {"inventory@kaarobar.local", "Inventory Manager", "Nadia Raza", ["inventory_manager"]}
]

staff =
  Enum.map(staff_specs, fn {email, _label, name, roles} ->
    {:ok, user} =
      case Accounts.get_user_by_email(email) do
        nil ->
          Accounts.register(%{
            email: email,
            password: "Password@123",
            name: name,
            phone: "+92300#{:rand.uniform(9_000_000) + 1_000_000}"
          })

        existing ->
          {:ok, existing}
      end

    {user, roles}
  end)

# —— Catalog templates ——————————————————————————————————————————

product_catalog = [
  %{sku: "TEA-001", name: "Green Tea 250g", category: "grocery", price: "450", qty: "80"},
  %{sku: "RCE-010", name: "Basmati Rice 5kg", category: "grocery", price: "1850", qty: "40"},
  %{sku: "OIL-003", name: "Cooking Oil 1L", category: "grocery", price: "620", qty: "55"},
  %{sku: "MLK-002", name: "Full Cream Milk 1L", category: "dairy", price: "280", qty: "60"},
  %{sku: "Bisc-12", name: "Cream Biscuits Pack", category: "snacks", price: "150", qty: "100"},
  %{sku: "SOAP-01", name: "Bath Soap 3pc", category: "personal-care", price: "220", qty: "70"},
  %{sku: "SHMP-02", name: "Shampoo 200ml", category: "personal-care", price: "480", qty: "35"},
  %{sku: "WTR-01", name: "Mineral Water 1.5L", category: "beverages", price: "90", qty: "120"}
]

city_names = [
  "Lahore",
  "Karachi",
  "Islamabad",
  "Faisalabad",
  "Rawalpindi",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Gujranwala",
  "Hyderabad",
  "Sukkur",
  "Abbottabad",
  "Bahawalpur",
  "Sargodha",
  "Sheikhupura",
  "Jhelum",
  "Sahiwal",
  "Mardan",
  "Gujrat"
]

business_defs = [
  {"Al-Falah Traders", "retail", false},
  {"Noor Mart", "supermarket", true},
  {"City Pharmacy", "pharmacy", false},
  {"Spice Route Wholesale", "wholesale", false},
  {"Karachi Cafe Co", "restaurant", false},
  {"Green Valley Grocers", "retail", false},
  {"Pak Hardware Hub", "retail", false},
  {"Sunrise Textiles", "retail", true},
  {"Desert Bloom Pharmacy", "pharmacy", false},
  {"Indus Auto Parts", "wholesale", false},
  {"Himalaya Dairy Points", "retail", false},
  {"Coastal Fresh Foods", "supermarket", true},
  {"Punjab Book Stall", "retail", false},
  {"Silk Road Traders", "wholesale", false},
  {"Capital Electronics", "retail", false},
  {"Frontier Medical Store", "pharmacy", false},
  {"Canal View Cafe", "restaurant", false},
  {"Oasis Superstore", "supermarket", false},
  {"Makran Marine Supplies", "wholesale", false},
  {"Chinar Gift Shop", "retail", false}
]

branch_suffixes = ["Main", "Mall", "Market", "Highway", "Township", "Cantt"]

ensure_membership = fn business, user, roles, branch_id ->
  existing =
    if is_nil(branch_id) do
      from(m in Kaarobar.Schemas.Membership,
        where:
          m.user_id == ^user.id and m.business_id == ^business.id and is_nil(m.branch_id)
      )
      |> Repo.one()
    else
      from(m in Kaarobar.Schemas.Membership,
        where:
          m.user_id == ^user.id and m.business_id == ^business.id and
            m.branch_id == ^branch_id
      )
      |> Repo.one()
    end

  if existing do
    existing
  else
    {:ok, m} =
      Tenancy.create_membership(owner, %{
        user_id: user.id,
        business_id: business.id,
        branch_id: branch_id,
        roles: roles,
        status: "active"
      })

    m
  end
end

seed_products_for_business = fn business, branches ->
  Enum.map(product_catalog, fn p ->
    product =
      Inventory.list_products(business.id, owner.id)
      |> Enum.find(&(&1.sku == p.sku))

    product =
      case product do
        nil ->
          {:ok, prod} =
            Inventory.create_product(business.id, owner.id, %{
              sku: p.sku,
              name: p.name,
              category: p.category,
              tax_rate: "0.18",
              is_active: true
            })

          prod

        prod ->
          prod
      end

    Enum.each(branches, fn branch ->
      # Slight price variation per branch
      bump = Decimal.new(:rand.uniform(20))
      price = Decimal.add(Decimal.new(p.price), bump) |> Decimal.round(0)

      Inventory.set_branch_price(
        product.id,
        branch.id,
        owner.id,
        business.id,
        Decimal.to_string(price)
      )

      case Inventory.get_inventory(branch.id, product.id, owner.id, business.id) do
        nil ->
          qty = Decimal.new(p.qty) |> Decimal.add(Decimal.new(:rand.uniform(25)))

          %InventoryRecord{}
          |> InventoryRecord.changeset(%{
            branch_id: branch.id,
            product_id: product.id,
            owner_id: owner.id,
            business_id: business.id,
            quantity_on_hand: qty,
            avg_cost:
              price
              |> Decimal.div(Decimal.new("1.25"))
              |> Decimal.round(2)
          })
          |> Repo.insert!()

        _ ->
          :ok
      end
    end)

    product
  end)
end

seed_suppliers = fn business ->
  names = ["Lahore Distributors", "National Supply Co", "Local Cash & Carry"]

  Enum.each(names, fn name ->
    exists =
      from(s in Supplier,
        where: s.business_id == ^business.id and s.name == ^name
      )
      |> Repo.exists?()

    unless exists do
      %Supplier{}
      |> Supplier.changeset(%{
        name: name,
        business_id: business.id,
        owner_id: owner.id,
        payment_terms: "Net 15",
        contact: %{phone: "+92 42 111 2222", email: "orders@#{String.downcase(String.replace(name, " ", ""))}.pk"}
      })
      |> Repo.insert!()
    end
  end)
end

seed_employees = fn business, branches ->
  existing = Hr.list_employees(business.id, owner.id)

  if length(existing) >= 3 do
    existing
  else
    Enum.with_index(Enum.take(branches, 3), 1)
    |> Enum.map(fn {branch, idx} ->
      code = "E#{String.slice(business.id, 0, 4)}-#{idx}"

      case Enum.find(existing, &(&1.employee_code == code)) do
        nil ->
          {:ok, emp} =
            Hr.create_employee(%{
              employee_code: code,
              name: Enum.at(["Hassan", "Fatima", "Usman", "Zara", "Omar"], rem(idx, 5)),
              position: Enum.at(["Cashier", "Sales Associate", "Store Keeper"], rem(idx, 3)),
              join_date: Date.add(Date.utc_today(), -180 - idx * 10),
              basic_salary: "#{25_000 + idx * 2_500}",
              allowances: %{"transport" => "3000"},
              status: "active",
              business_id: business.id,
              owner_id: owner.id,
              branch_id: branch.id
            })

          emp

        emp ->
          emp
      end
    end)
  end
end

seed_opening_journal = fn business ->
  cash = Accounting.get_account_by_code(business.id, "1000")
  capital = Accounting.get_account_by_code(business.id, "3000")

  already =
    from(j in Kaarobar.Schemas.JournalEntry,
      where:
        j.business_id == ^business.id and j.source_type == "manual" and
          j.description == "Opening capital"
    )
    |> Repo.exists?()

  if cash && capital && not already do
    amount = Decimal.new("#{150_000 + :rand.uniform(350_000)}")

    Accounting.create_manual_journal(business.id, owner.id, owner.id, %{
      description: "Opening capital",
      date: Date.add(Date.utc_today(), -30),
      source_type: "manual",
      lines: [
        %{account_id: cash.id, debit: amount, credit: Decimal.new(0), description: "Cash float"},
        %{account_id: capital.id, debit: Decimal.new(0), credit: amount, description: "Owner capital"}
      ]
    })
  else
    {:ok, :skipped}
  end
end

seed_sales = fn business, branches, products ->
  branch = hd(branches)
  product = hd(products)

  sale_count =
    from(s in Kaarobar.Schemas.Sale, where: s.business_id == ^business.id)
    |> Repo.aggregate(:count)

  if sale_count >= 3 do
    :ok
  else
    Enum.each(1..3, fn i ->
      qty = Decimal.new(i)
      unit = Decimal.new("450")
      line = Decimal.mult(unit, qty)
      tax = Decimal.mult(line, Decimal.new("0.18")) |> Decimal.round(2)
      total = Decimal.add(line, tax)

      inventory = Inventory.get_inventory(branch.id, product.id, owner.id, business.id)

      if inventory && Decimal.compare(inventory.quantity_on_hand, qty) in [:gt, :eq] do
        Pos.create_sale(branch.id, owner.id, business.id, owner.id, %{
          client_txn_id: Ecto.UUID.generate(),
          subtotal: line,
          tax_amount: tax,
          discount_amount: Decimal.new(0),
          total_amount: total,
          items: [
            %{
              product_id: product.id,
              sku: product.sku || "SKU",
              name: product.name || "Item",
              quantity: qty,
              unit_price: unit,
              discount: Decimal.new(0),
              tax_rate: Decimal.new("0.18"),
              line_total: total
            }
          ],
          payments: [%{method: "cash", amount: total}]
        })
      end
    end)
  end
end

# —— Create / reuse 20 businesses ————————————————————————————————

IO.puts("Creating businesses, branches, stock, staff, and books...")

businesses =
  business_defs
  |> Enum.with_index()
  |> Enum.map(fn {{name, industry, fbr}, idx} ->
    business =
      from(b in Kaarobar.Schemas.Business,
        where: b.owner_id == ^owner.id and b.name == ^name
      )
      |> Repo.one()

    business =
      case business do
        nil ->
          {:ok, b} =
            Tenancy.create_business(owner.id, %{
              name: name,
              industry: industry,
              tax_jurisdiction: "PK",
              fbr_tier1: fbr,
              subscription_plan: "enterprise"
            })

          b

        b ->
          b
      end

    desired_branch_count = 3 + rem(idx, 3)
    city = Enum.at(city_names, idx)

    existing_branches = Tenancy.list_branches_for_business(business.id, owner, active_only: false)

    branches =
      if length(existing_branches) >= desired_branch_count do
        existing_branches
      else
        needed = desired_branch_count - length(existing_branches)

        new_branches =
          Enum.map(0..(needed - 1), fn i ->
            suffix = Enum.at(branch_suffixes, rem(length(existing_branches) + i, length(branch_suffixes)))
            branch_name = "#{city} #{suffix}"

            {:ok, br} =
              Tenancy.create_branch(business.id, owner, %{
                name: branch_name,
                timezone: "Asia/Karachi",
                refund_auto_approve_limit: "5000",
                discount_auto_approve_limit: "1500",
                address: %{city: city, area: suffix}
              })

            br
          end)

        existing_branches ++ new_branches
      end

    # Memberships: managers business-wide; cashier on first branch
    Enum.each(staff, fn {user, roles} ->
      branch_id =
        if "cashier" in roles do
          hd(branches).id
        else
          nil
        end

      ensure_membership.(business, user, roles, branch_id)
    end)

    products = seed_products_for_business.(business, branches)
    seed_suppliers.(business)
    seed_employees.(business, branches)
    seed_opening_journal.(business)

    # Sample sales only on first 5 businesses (keeps seed fast)
    if idx < 5 do
      seed_sales.(business, branches, products)
    end

    IO.puts("  • #{business.name} — #{length(branches)} branches, #{length(products)} products")

    %{business: business, branches: branches, products: products}
  end)

# —— Summary ————————————————————————————————————————————————————

total_branches =
  Enum.reduce(businesses, 0, fn %{branches: brs}, acc -> acc + length(brs) end)

total_employees =
  from(e in Kaarobar.Schemas.Employee, where: e.owner_id == ^owner.id)
  |> Repo.aggregate(:count)

total_products =
  from(p in Kaarobar.Schemas.Product, where: p.owner_id == ^owner.id)
  |> Repo.aggregate(:count)

total_sales =
  from(s in Kaarobar.Schemas.Sale, where: s.owner_id == ^owner.id)
  |> Repo.aggregate(:count)

total_journals =
  from(j in Kaarobar.Schemas.JournalEntry, where: j.owner_id == ^owner.id)
  |> Repo.aggregate(:count)

IO.puts("""

Seed complete.

Login (owner):      owner@kaarobar.local / Password@123
Staff (same pass):  manager@ / cashier@ / accountant@ / hr@ / inventory@kaarobar.local
Plan:               enterprise

Counts
  Businesses:  #{length(businesses)}
  Branches:    #{total_branches}
  Products:    #{total_products}
  Employees:   #{total_employees}
  Sales:       #{total_sales}
  Journals:    #{total_journals}
""")
