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

alias Kaarobar.Schemas.{Customer, InventoryRecord, ProductBranchPrice, Supplier}

import Ecto.Query

IO.puts("\n=== Kaarobar demo seed (multi-owner) ===\n")

# —— Catalogs ————————————————————————————————————————————————————

base_catalog = [
  %{sku: "TEA-001", name: "Green Tea 250g", category: "grocery", price: "450", qty: "80"},
  %{sku: "RCE-010", name: "Basmati Rice 5kg", category: "grocery", price: "1850", qty: "40"},
  %{sku: "OIL-003", name: "Cooking Oil 1L", category: "grocery", price: "620", qty: "55"},
  %{sku: "MLK-002", name: "Full Cream Milk 1L", category: "dairy", price: "280", qty: "60"},
  %{sku: "BISC-12", name: "Cream Biscuits Pack", category: "snacks", price: "150", qty: "100"},
  %{sku: "SOAP-01", name: "Bath Soap 3pc", category: "personal-care", price: "220", qty: "70"},
  %{sku: "SHMP-02", name: "Shampoo 200ml", category: "personal-care", price: "480", qty: "35"},
  %{sku: "WTR-01", name: "Mineral Water 1.5L", category: "beverages", price: "90", qty: "120"},
  %{sku: "CHF-01", name: "Chai Masala 100g", category: "grocery", price: "180", qty: "50"},
  %{sku: "NDL-02", name: "Instant Noodles 5pk", category: "snacks", price: "320", qty: "75"}
]

industry_extras = %{
  "pharmacy" => [
    %{sku: "MED-01", name: "Paracetamol 500mg", category: "pharmacy", price: "60", qty: "200"},
    %{sku: "MED-02", name: "ORS Sachet Pack", category: "pharmacy", price: "120", qty: "150"}
  ],
  "restaurant" => [
    %{sku: "FOOD-01", name: "Chicken Karahi (portion)", category: "food", price: "850", qty: "40"},
    %{sku: "FOOD-02", name: "Biryani Plate", category: "food", price: "450", qty: "60"}
  ],
  "wholesale" => [
    %{sku: "CTN-01", name: "Carton Tape Roll", category: "supplies", price: "95", qty: "300"},
    %{sku: "CTN-02", name: "Packing Boxes (10)", category: "supplies", price: "780", qty: "90"}
  ]
}

cities = [
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
  "Gujrat",
  "Okara",
  "Kasur",
  "Attock",
  "Swat"
]

branch_suffixes = ["Main", "Mall", "Market", "Highway", "Township", "Cantt", "Airport", "University"]

employee_names = [
  "Hassan Ali",
  "Fatima Noor",
  "Usman Raza",
  "Zara Khan",
  "Omar Siddiqui",
  "Amina Bibi",
  "Bilal Hussain",
  "Sana Iqbal",
  "Hamza Farooq",
  "Maria Ahmed"
]

positions = ["Cashier", "Sales Associate", "Store Keeper", "Supervisor", "Stock Clerk"]

customer_names = ["Walk-in Retail", "Corner Shop Credit", "Hotel Supplies Co", "Neighborhood Clinic"]

supplier_names = ["Lahore Distributors", "National Supply Co", "Local Cash & Carry", "Punjab Wholesalers"]

business_pool = [
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
  {"Chinar Gift Shop", "retail", false},
  {"Gulberg Fashion Hub", "retail", false},
  {"Riverbend Pharmacy", "pharmacy", true},
  {"Metro Fresh Foods", "supermarket", false},
  {"Khyber Wholesale Depot", "wholesale", false},
  {"Saffron Kitchen", "restaurant", false},
  {"Pearl Electronics", "retail", false},
  {"Valley Dairy Mart", "retail", false},
  {"Quetta Dry Fruits Co", "wholesale", false},
  {"Liberty Cafe", "restaurant", false},
  {"Aabpara Medicos", "pharmacy", false}
]

# Each owner: 1–6 businesses
owner_defs = [
  %{
    email: "owner@kaarobar.local",
    name: "Demo Owner",
    phone: "+923001234567",
    plan: "enterprise",
    business_count: 6,
    staff_prefix: ""
  },
  %{
    email: "owner2@kaarobar.local",
    name: "Sara Malik",
    phone: "+923001112233",
    plan: "growth",
    business_count: 4,
    staff_prefix: "2"
  },
  %{
    email: "owner3@kaarobar.local",
    name: "Imtiaz Ahmed",
    phone: "+923004445566",
    plan: "starter",
    business_count: 2,
    staff_prefix: "3"
  },
  %{
    email: "owner4@kaarobar.local",
    name: "Nadia Qureshi",
    phone: "+923007778899",
    plan: "trial",
    business_count: 1,
    staff_prefix: "4"
  }
]

staff_role_defs = [
  {"manager", "Ayesha Khan", ["branch_manager"]},
  {"cashier", "Bilal Ahmed", ["cashier"]},
  {"accountant", "Sana Malik", ["accountant"]},
  {"hr", "Imran Ali", ["hr_manager"]},
  {"inventory", "Nadia Raza", ["inventory_manager"]}
]

ensure_user = fn email, name, phone ->
  case Accounts.get_user_by_email(email) do
    nil ->
      {:ok, user} =
        Accounts.register(%{
          email: email,
          password: "Password@123",
          name: name,
          phone: phone
        })

      user

    user ->
      user
  end
end

ensure_membership = fn actor, business, user, roles, branch_id ->
  existing =
    if is_nil(branch_id) do
      from(m in Kaarobar.Schemas.Membership,
        where: m.user_id == ^user.id and m.business_id == ^business.id and is_nil(m.branch_id)
      )
      |> Repo.one()
    else
      from(m in Kaarobar.Schemas.Membership,
        where:
          m.user_id == ^user.id and m.business_id == ^business.id and m.branch_id == ^branch_id
      )
      |> Repo.one()
    end

  if existing do
    existing
  else
    case Tenancy.create_membership(actor, %{
           user_id: user.id,
           business_id: business.id,
           branch_id: branch_id,
           roles: roles,
           status: "active"
         }) do
      {:ok, m} ->
        m

      {:error, :plan_limit_reached} ->
        IO.puts("    ! user limit — skip #{user.email} on #{business.name}")
        nil

      {:error, reason} ->
        IO.puts("    ! membership #{user.email}: #{inspect(reason)}")
        nil
    end
  end
end

catalog_for = fn industry ->
  base_catalog ++ Map.get(industry_extras, industry, [])
end

seed_products = fn owner, business, branches, catalog ->
  Enum.map(catalog, fn p ->
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

    Enum.each(Enum.with_index(branches), fn {branch, bidx} ->
      bump = Decimal.new(rem(bidx * 7 + :erlang.phash2({branch.id, p.sku}, 25), 25))
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
          qty = Decimal.add(Decimal.new(p.qty), Decimal.new(10 + rem(bidx * 11, 40)))

          %InventoryRecord{}
          |> InventoryRecord.changeset(%{
            branch_id: branch.id,
            product_id: product.id,
            owner_id: owner.id,
            business_id: business.id,
            quantity_on_hand: qty,
            avg_cost: price |> Decimal.div(Decimal.new("1.25")) |> Decimal.round(2)
          })
          |> Repo.insert!()

        _ ->
          :ok
      end
    end)

    product
  end)
end

seed_suppliers = fn owner, business ->
  Enum.each(supplier_names, fn name ->
    unless from(s in Supplier, where: s.business_id == ^business.id and s.name == ^name)
           |> Repo.exists?() do
      slug = name |> String.downcase() |> String.replace(~r/[^a-z0-9]+/, "")

      %Supplier{}
      |> Supplier.changeset(%{
        name: name,
        business_id: business.id,
        owner_id: owner.id,
        payment_terms: Enum.at(["Net 7", "Net 15", "Net 30"], rem(:erlang.phash2(name), 3)),
        contact: %{phone: "+92 42 1110000", email: "orders@#{slug}.pk"}
      })
      |> Repo.insert!()
    end
  end)
end

seed_customers = fn owner, business ->
  Enum.each(customer_names, fn name ->
    unless from(c in Customer, where: c.business_id == ^business.id and c.name == ^name)
           |> Repo.exists?() do
      %Customer{}
      |> Customer.changeset(%{
        name: name,
        phone: "+92300#{1_000_000 + :erlang.phash2({business.id, name}, 8_999_999)}",
        business_id: business.id,
        owner_id: owner.id
      })
      |> Repo.insert!()
    end
  end)
end

seed_employees = fn owner, business, branches, cashier_user ->
  existing = Hr.list_employees(business.id, owner.id)

  Enum.flat_map(Enum.with_index(branches, 1), fn {branch, bidx} ->
    Enum.map(1..2, fn eidx ->
      code = "E#{String.slice(business.id, 0, 4)}-B#{bidx}-#{eidx}"
      gidx = (bidx - 1) * 2 + eidx

      case Enum.find(existing, &(&1.employee_code == code)) do
        nil ->
          {:ok, emp} =
            Hr.create_employee(%{
              employee_code: code,
              name: Enum.at(employee_names, rem(gidx, length(employee_names))),
              position: Enum.at(positions, rem(gidx, length(positions))),
              join_date: Date.add(Date.utc_today(), -(90 + gidx * 7)),
              basic_salary: "#{22_000 + gidx * 1_500}",
              allowances: %{"transport" => "2500", "meal" => "1500"},
              phone: "+92301#{1_000_000 + gidx * 117}",
              status: "active",
              business_id: business.id,
              owner_id: owner.id,
              branch_id: branch.id,
              user_id: if(bidx == 1 and eidx == 1 and cashier_user, do: cashier_user.id)
            })

          emp

        emp ->
          if is_nil(emp.user_id) and bidx == 1 and eidx == 1 and cashier_user do
            {:ok, updated} = Hr.update_employee(emp.id, owner.id, %{user_id: cashier_user.id})
            updated
          else
            emp
          end
      end
    end)
  end)
end

seed_attendance = fn owner, business, employees, branches ->
  employees
  |> Enum.take(4)
  |> Enum.with_index()
  |> Enum.each(fn {emp, idx} ->
    branch = Enum.find(branches, &(&1.id == emp.branch_id)) || hd(branches)

    Enum.each(0..2, fn day_offset ->
      date = Date.add(Date.utc_today(), -(day_offset + 1))

      unless from(a in Kaarobar.Schemas.AttendanceRecord,
               where: a.employee_id == ^emp.id and a.date == ^date
             )
             |> Repo.exists?() do
        cin =
          DateTime.new!(date, ~T[04:00:00], "Etc/UTC")
          |> DateTime.add(idx * 300, :second)
          |> DateTime.truncate(:second)

        cout = DateTime.add(cin, 8 * 3600 + rem(idx, 3) * 1800, :second)

        %Kaarobar.Schemas.AttendanceRecord{}
        |> Kaarobar.Schemas.AttendanceRecord.changeset(%{
          employee_id: emp.id,
          branch_id: branch.id,
          owner_id: owner.id,
          business_id: business.id,
          date: date,
          clock_in: cin,
          clock_out: cout,
          source: "pos"
        })
        |> Repo.insert()
      end
    end)
  end)
end

seed_leave = fn owner, business, employees ->
  with %{} = emp <- List.first(employees) do
    unless from(l in Kaarobar.Schemas.LeaveRequest,
             where: l.employee_id == ^emp.id and l.status == "Pending"
           )
           |> Repo.exists?() do
      Hr.request_leave(%{
        employee_id: emp.id,
        business_id: business.id,
        owner_id: owner.id,
        type: "annual",
        start_date: Date.add(Date.utc_today(), 7),
        end_date: Date.add(Date.utc_today(), 8),
        reason: "Family event",
        status: "Pending"
      })
    end
  end
end

seed_opening_journal = fn owner, business ->
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
    amount = Decimal.new("#{120_000 + rem(:erlang.phash2(business.id), 400_000)}")

    Accounting.create_manual_journal(business.id, owner.id, owner.id, %{
      description: "Opening capital",
      date: Date.add(Date.utc_today(), -45),
      source_type: "manual",
      lines: [
        %{account_id: cash.id, debit: amount, credit: Decimal.new(0), memo: "Cash float"},
        %{account_id: capital.id, debit: Decimal.new(0), credit: amount, memo: "Owner capital"}
      ]
    })
  end
end

expected_sale_total = fn product, branch_id, qty ->
  price_row =
    Repo.get_by(ProductBranchPrice, product_id: product.id, branch_id: branch_id)

  unit = (price_row && price_row.price) || Decimal.new("100")
  line = Decimal.mult(unit, qty)
  tax_rate = product.tax_rate || Decimal.new("0.18")
  tax = Decimal.mult(line, tax_rate) |> Decimal.round(2)
  Decimal.add(line, tax) |> Decimal.round(2)
end

seed_branch_sales = fn owner, business, branch, products, cashier ->
  sale_count =
    from(s in Kaarobar.Schemas.Sale, where: s.branch_id == ^branch.id)
    |> Repo.aggregate(:count)

  if sale_count >= 2 or products == [] do
    :ok
  else
    till =
      case Pos.open_till_for_branch(branch.id) do
        nil ->
          case Pos.open_till(branch.id, owner.id, business.id, cashier.id, "5000") do
            {:ok, t} -> t
            _ -> nil
          end

        t ->
          t
      end

    Enum.each(1..2, fn i ->
      product = Enum.at(products, rem(i + :erlang.phash2(branch.id), length(products)))
      qty = Decimal.new(i)
      inv = Inventory.get_inventory(branch.id, product.id, owner.id, business.id)

      if inv && Decimal.compare(inv.quantity_on_hand, qty) in [:gt, :eq] do
        total = expected_sale_total.(product, branch.id, qty)
        method = Enum.at(["cash", "card", "wallet"], rem(i, 3))

        Pos.create_sale(branch.id, owner.id, business.id, cashier.id, %{
          client_txn_id: Ecto.UUID.generate(),
          till_id: till && till.id,
          items: [%{product_id: product.id, quantity: qty, discount: "0"}],
          payments: [%{method: method, amount: total}]
        })
      end
    end)
  end
end

# —— Allocate businesses across owners ——————————————————————————

{assignments, _} =
  Enum.map_reduce(owner_defs, 0, fn def, offset ->
    slice = Enum.slice(business_pool, offset, def.business_count)
    {{def, slice}, offset + def.business_count}
  end)

# —— Seed each owner ————————————————————————————————————————————

owner_summaries =
  Enum.map(assignments, fn {odef, biz_defs} ->
    IO.puts("Owner #{odef.email} (#{odef.plan}) — #{length(biz_defs)} businesses")

    owner = ensure_user.(odef.email, odef.name, odef.phone)
    {:ok, _} = Billing.set_plan(owner.id, odef.plan)

    # Per-owner staff (primary owner keeps classic emails)
    staff =
      Enum.map(staff_role_defs, fn {role, name, roles} ->
        email =
          if odef.staff_prefix == "" do
            "#{role}@kaarobar.local"
          else
            "#{role}#{odef.staff_prefix}@kaarobar.local"
          end

        user =
          ensure_user.(
            email,
            if(odef.staff_prefix == "", do: name, else: "#{name} #{odef.staff_prefix}"),
            "+92300#{1_000_000 + :erlang.phash2(email, 8_999_999)}"
          )

        {user, roles, role, email}
      end)

    cashier = Enum.find_value(staff, fn {u, roles, _, _} -> if "cashier" in roles, do: u end)

    businesses =
      biz_defs
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
                  subscription_plan: odef.plan
                })

              b

            b ->
              b
          end

        # 2–5 branches per business, capped by plan limits
        plan_branch_cap =
          case odef.plan do
            "trial" -> 2
            "starter" -> 10
            "growth" -> 50
            _ -> 500
          end

        desired_branches =
          min(2 + rem(idx + :erlang.phash2(business.id), 4), plan_branch_cap)

        city = Enum.at(cities, rem(idx + :erlang.phash2(owner.id), length(cities)))
        existing = Tenancy.list_branches_for_business(business.id, owner, active_only: false)

        branches =
          if length(existing) >= desired_branches do
            Enum.take(existing, desired_branches)
          else
            needed = desired_branches - length(existing)

            new =
              Enum.reduce_while(0..(needed - 1), [], fn i, acc ->
                unless Billing.within_limits?(owner.id, :branch) do
                  {:halt, acc}
                else
                  suffix =
                    Enum.at(
                      branch_suffixes,
                      rem(length(existing) + i, length(branch_suffixes))
                    )

                  case Tenancy.create_branch(business.id, owner, %{
                         name: "#{city} #{suffix}",
                         timezone: "Asia/Karachi",
                         refund_auto_approve_limit: "5000",
                         discount_auto_approve_limit: "1500",
                         return_window_days: 14,
                         address: %{city: city, area: suffix}
                       }) do
                    {:ok, br} -> {:cont, acc ++ [br]}
                    _ -> {:halt, acc}
                  end
                end
              end)

            existing ++ new
          end

        if branches == [] do
          IO.puts("  ! #{business.name} — no branches (plan limit?)")
          %{business: business, branches: [], products: [], employees: []}
        else
          # Memberships: managers/accountant/hr/inventory business-wide; cashier on first branch
          Enum.each(staff, fn {user, roles, _role, _email} ->
            branch_id = if "cashier" in roles, do: hd(branches).id, else: nil
            ensure_membership.(owner, business, user, roles, branch_id)
          end)

          catalog = catalog_for.(industry)
          products = seed_products.(owner, business, branches, catalog)
          seed_suppliers.(owner, business)
          seed_customers.(owner, business)
          employees = seed_employees.(owner, business, branches, cashier)
          seed_attendance.(owner, business, employees, branches)
          seed_leave.(owner, business, employees)
          seed_opening_journal.(owner, business)

          # Sales on every branch for first 3 businesses of each owner
          if idx < 3 do
            Enum.each(branches, fn branch ->
              seed_branch_sales.(owner, business, branch, products, cashier || owner)
            end)
          end

          IO.puts(
            "  • #{business.name} [#{industry}] — #{length(branches)} branches, #{length(products)} products, #{length(employees)} employees"
          )

          %{
            business: business,
            branches: branches,
            products: products,
            employees: employees
          }
        end
      end)

    %{
      owner: owner,
      email: odef.email,
      plan: odef.plan,
      staff: staff,
      businesses: businesses
    }
  end)

# —— Summary ————————————————————————————————————————————————————

total_owners = length(owner_summaries)

total_businesses =
  Enum.reduce(owner_summaries, 0, fn s, acc -> acc + length(s.businesses) end)

total_branches =
  Enum.reduce(owner_summaries, 0, fn s, acc ->
    acc + Enum.reduce(s.businesses, 0, fn b, a -> a + length(b.branches) end)
  end)

total_employees =
  from(e in Kaarobar.Schemas.Employee) |> Repo.aggregate(:count)

total_products =
  from(p in Kaarobar.Schemas.Product) |> Repo.aggregate(:count)

total_sales =
  from(s in Kaarobar.Schemas.Sale) |> Repo.aggregate(:count)

total_attendance =
  from(a in Kaarobar.Schemas.AttendanceRecord) |> Repo.aggregate(:count)

total_customers =
  from(c in Customer) |> Repo.aggregate(:count)

staff_logins =
  owner_summaries
  |> Enum.flat_map(fn s ->
    Enum.map(s.staff, fn {_u, _roles, _role, email} -> email end)
  end)
  |> Enum.join("\n  ")

owner_logins =
  owner_summaries
  |> Enum.map(fn s ->
    "#{s.email} (#{s.plan}, #{length(s.businesses)} businesses)"
  end)
  |> Enum.join("\n  ")

IO.puts("""

Seed complete. Password for all demo users: Password@123

Owners
  #{owner_logins}

Staff
  #{staff_logins}

ESS demo: cashier@kaarobar.local is linked to an employee on the primary owner's first business.

Counts
  Owners:       #{total_owners}
  Businesses:   #{total_businesses}
  Branches:     #{total_branches}
  Products:     #{total_products}
  Employees:    #{total_employees}
  Customers:    #{total_customers}
  Sales:        #{total_sales}
  Attendance:   #{total_attendance}
""")
