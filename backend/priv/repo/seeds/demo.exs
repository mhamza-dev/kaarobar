# Demo data: one owner, one organization, one business per vertical.
#
#     SEED_DEMO=true mix run priv/repo/seeds.exs
#
# The point is that every vertical the platform claims to support can be
# exercised immediately, by hand, without anyone first building a tenant. If a
# vertical cannot be set up here, it is not really supported.
#
# The volumes are chosen to be awkward rather than tidy: the catalog runs to
# several cursor pages, categories nest, some products carry no stock, and the
# staff list mixes roles and branch scoping. A client that mishandles any of
# those looks perfectly correct against four rows of sample data, which is the
# failure mode this file exists to prevent.
#
# Idempotent: re-running finds the existing owner and stops.

require Logger

alias Kaarobar.AccessControl
alias Kaarobar.AccessControl.MembershipRole
alias Kaarobar.Accounts
alias Kaarobar.Repo
alias Kaarobar.Scopes
alias Kaarobar.Tenancy

owner_email = System.get_env("SEED_DEMO_EMAIL", "owner@kaarobar.test")
owner_password = System.get_env("SEED_DEMO_PASSWORD", "kaarobar-demo-2026")

# The businesses a real multi-shop owner in this market might run side by side.
demo_businesses = [
  %{"name" => "Bilal Kiryana Store", "business_type" => "grocery", "branch_name" => "Main shop"},
  %{"name" => "Threads & Co", "business_type" => "fashion", "branch_name" => "Mall outlet"},
  %{"name" => "Karahi Corner", "business_type" => "restaurant", "branch_name" => "Dining hall"},
  %{"name" => "Studio Noor", "business_type" => "salon", "branch_name" => "Studio"},
  %{"name" => "Crisp Laundry", "business_type" => "laundry", "branch_name" => "Collection point"},
  %{"name" => "Green Fields Agri", "business_type" => "agri_supplies", "branch_name" => "Depot"}
]

case Accounts.get_user_by_email(owner_email) do
  %Accounts.User{} ->
    Logger.info("Demo data already present for #{owner_email}; nothing to do.")

  nil ->
    {:ok, result} =
      Tenancy.register_owner(%{
        "user" => %{
          "email" => owner_email,
          "password" => owner_password,
          "name" => "Demo Owner",
          "timezone" => "Asia/Karachi",
          "locale" => "en"
        },
        "organization" => %{
          "name" => "Kaarobar Demo Group",
          "slug" => "kaarobar-demo",
          "country_code" => "PK",
          "default_currency" => "PKR",
          "timezone" => "Asia/Karachi"
        }
      })

    # Everything below writes to RLS-protected tables (`businesses`,
    # `products`, `stock_items`, `sales`, ...), so it has to run with the
    # tenant context set the same way a real request would — see
    # `Kaarobar.Repo.with_tenant_context/2`.
    :ok =
      Repo.with_tenant_context(result.organization.id, fn ->
    {:ok, scope} = Scopes.build(result.user, %{organization_id: result.organization.id})

    for attrs <- demo_businesses do
      {:ok, %{business: business}} = Tenancy.create_business(scope, attrs)
      Logger.info("  created #{business.name} (#{business.business_type})")
    end

    # One staff member per system role, so every permission path has somebody
    # to exercise it with.
    grocery = scope |> Tenancy.list_businesses() |> Enum.find(&(&1.business_type == "grocery"))

    for role_key <- ~w(manager supervisor cashier stock_keeper accountant) do
      {:ok, role} = AccessControl.fetch_system_role(role_key)

      {:ok, staff_user} =
        Accounts.register_user(%{
          "email" => "#{role_key}@kaarobar.test",
          "password" => owner_password,
          "name" => String.capitalize(role_key)
        })

      {:ok, membership} =
        %Kaarobar.Tenancy.Membership{
          organization_id: result.organization.id,
          user_id: staff_user.id,
          business_id: grocery.id
        }
        |> Kaarobar.Tenancy.Membership.create_changeset(%{
          "job_title" => String.capitalize(role_key),
          "status" => "active"
        })
        |> Repo.insert()

      %MembershipRole{}
      |> MembershipRole.changeset(%{membership_id: membership.id, role_id: role.id})
      |> Repo.insert!()
    end

    # --- A shop that can actually sell something ------------------------------
    #
    # Catalog, stock, a till with an open shift, a credit customer and one
    # completed sale. Without these, "the backend works" can only be taken on
    # trust: with them, the whole checkout path can be walked by hand within a
    # minute of `mix ecto.setup`.

    {:ok, shop} = Scopes.build(result.user, %{business_id: grocery.id})

    # A kiryana store's aisles. Nested one level deep, because the category
    # screen's indentation and the `in_category_tree` filter are both
    # meaningless against a flat list.
    category_tree = [
      {"Pantry", ["Rice & grains", "Cooking oil & ghee", "Flour & pulses", "Sugar & salt"]},
      {"Beverages", ["Tea & coffee", "Soft drinks", "Juices & water"]},
      {"Dairy & bakery", ["Milk & yoghurt", "Bread & rusk"]},
      {"Household", ["Cleaning", "Paper & disposables"]},
      {"Personal care", ["Soap & shampoo", "Oral care"]},
      {"Snacks", ["Biscuits", "Crisps & nuts"]}
    ]

    categories =
      for {parent_name, child_names} <- category_tree, reduce: %{} do
        acc ->
          {:ok, parent} = Kaarobar.Catalog.create_category(shop, %{"name" => parent_name})

          Enum.reduce(child_names, Map.put(acc, parent_name, parent), fn child_name, inner ->
            {:ok, child} =
              Kaarobar.Catalog.create_category(shop, %{
                "name" => child_name,
                "parent_id" => parent.id
              })

            Map.put(inner, child_name, child)
          end)
      end

    Logger.info("  built #{map_size(categories)} categories")

    # Deliberately more than one page of products. The list is cursor
    # paginated, so a catalog of four rows never exercises "load more", and a
    # client that pages incorrectly looks perfectly fine against it.
    demo_products = [
      # {name, category, price, cost, stock, opts}
      {"Basmati rice 5kg", "Rice & grains", "1850.00", "1600.00", "40", %{}},
      {"Basmati rice 25kg sack", "Rice & grains", "8600.00", "7800.00", "12", %{}},
      {"Sella rice 5kg", "Rice & grains", "1650.00", "1420.00", "30", %{}},
      {"Broken rice 1kg", "Rice & grains", "210.00", "180.00", "60", %{}},
      {"Brown rice 1kg", "Rice & grains", "420.00", "360.00", "25", %{}},
      {"Cooking oil 1L", "Cooking oil & ghee", "620.00", "540.00", "80", %{}},
      {"Cooking oil 5L tin", "Cooking oil & ghee", "2980.00", "2650.00", "35", %{}},
      {"Banaspati ghee 1kg", "Cooking oil & ghee", "690.00", "600.00", "45", %{}},
      {"Desi ghee 500g", "Cooking oil & ghee", "1450.00", "1280.00", "18", %{}},
      {"Olive oil 500ml", "Cooking oil & ghee", "1890.00", "1650.00", "10", %{}},
      {"Chakki atta 10kg", "Flour & pulses", "1320.00", "1180.00", "50", %{}},
      {"Maida 1kg", "Flour & pulses", "180.00", "152.00", "40", %{}},
      {"Besan 1kg", "Flour & pulses", "320.00", "270.00", "35", %{}},
      {"Chana daal 1kg", "Flour & pulses", "340.00", "290.00", "44", %{}},
      {"Masoor daal 1kg", "Flour & pulses", "360.00", "310.00", "38", %{}},
      {"Mash daal 1kg", "Flour & pulses", "480.00", "420.00", "22", %{}},
      {"White chickpeas 1kg", "Flour & pulses", "395.00", "340.00", "28", %{}},
      {"Sugar 1kg", "Sugar & salt", "165.00", "142.00", "200", %{}},
      {"Brown sugar 500g", "Sugar & salt", "240.00", "205.00", "20", %{}},
      {"Iodised salt 800g", "Sugar & salt", "65.00", "52.00", "90", %{}},
      {"Loose sugar", "Sugar & salt", "158.00", "138.00", "300", %{"is_weighted" => true}},
      {"Tea 250g", "Tea & coffee", "480.00", "400.00", "120", %{}},
      {"Tea 950g pack", "Tea & coffee", "1720.00", "1500.00", "40", %{}},
      {"Green tea 100 bags", "Tea & coffee", "560.00", "470.00", "25", %{}},
      {"Instant coffee 100g", "Tea & coffee", "1250.00", "1080.00", "16", %{}},
      {"Cola 1.5L", "Soft drinks", "220.00", "185.00", "96", %{}},
      {"Cola 500ml", "Soft drinks", "90.00", "72.00", "144", %{}},
      {"Lemon drink 1.5L", "Soft drinks", "210.00", "178.00", "60", %{}},
      {"Energy drink 250ml", "Soft drinks", "180.00", "150.00", "48", %{}},
      {"Mineral water 1.5L", "Juices & water", "80.00", "62.00", "120", %{}},
      {"Mango juice 1L", "Juices & water", "290.00", "245.00", "36", %{}},
      {"Orange juice 200ml", "Juices & water", "70.00", "55.00", "72", %{}},
      {"Fresh milk 1L", "Milk & yoghurt", "230.00", "205.00", "60", %{}},
      {"UHT milk 1L", "Milk & yoghurt", "270.00", "240.00", "84", %{}},
      {"Yoghurt 500g", "Milk & yoghurt", "180.00", "150.00", "40", %{}},
      {"Butter 200g", "Milk & yoghurt", "520.00", "455.00", "24", %{}},
      {"Cheese slices 200g", "Milk & yoghurt", "640.00", "560.00", "18", %{}},
      {"Milk pack 250ml", "Milk & yoghurt", "70.00", "58.00", "96", %{}},
      {"White bread", "Bread & rusk", "150.00", "125.00", "30", %{}},
      {"Brown bread", "Bread & rusk", "180.00", "152.00", "24", %{}},
      {"Rusk 350g", "Bread & rusk", "260.00", "220.00", "28", %{}},
      {"Bun pack of 6", "Bread & rusk", "140.00", "115.00", "20", %{}},
      {"Dishwash liquid 500ml", "Cleaning", "320.00", "270.00", "44", %{}},
      {"Dishwash bar", "Cleaning", "70.00", "55.00", "88", %{}},
      {"Washing powder 1kg", "Cleaning", "480.00", "410.00", "52", %{}},
      {"Floor cleaner 1L", "Cleaning", "390.00", "330.00", "30", %{}},
      {"Bleach 750ml", "Cleaning", "260.00", "215.00", "26", %{}},
      {"Tissue box 150s", "Paper & disposables", "230.00", "190.00", "40", %{}},
      {"Kitchen roll", "Paper & disposables", "290.00", "245.00", "32", %{}},
      {"Garbage bags 30s", "Paper & disposables", "340.00", "285.00", "28", %{}},
      {"Foil roll 10m", "Paper & disposables", "420.00", "360.00", "18", %{}},
      {"Bath soap 100g", "Soap & shampoo", "160.00", "132.00", "110", %{}},
      {"Shampoo 200ml", "Soap & shampoo", "560.00", "480.00", "38", %{}},
      {"Hand wash 500ml", "Soap & shampoo", "380.00", "320.00", "30", %{}},
      {"Shower gel 250ml", "Soap & shampoo", "690.00", "590.00", "14", %{}},
      {"Toothpaste 150g", "Oral care", "380.00", "320.00", "46", %{}},
      {"Toothbrush twin pack", "Oral care", "290.00", "240.00", "34", %{}},
      {"Mouthwash 500ml", "Oral care", "720.00", "620.00", "12", %{}},
      {"Biscuits family pack", "Biscuits", "240.00", "198.00", "72", %{}},
      {"Cream biscuits", "Biscuits", "120.00", "95.00", "90", %{}},
      {"Digestive biscuits", "Biscuits", "310.00", "265.00", "36", %{}},
      {"Potato crisps 60g", "Crisps & nuts", "120.00", "96.00", "84", %{}},
      {"Salted peanuts 250g", "Crisps & nuts", "340.00", "285.00", "30", %{}},
      {"Almonds 250g", "Crisps & nuts", "1450.00", "1280.00", "12", %{}},
      {"Cashews 250g", "Crisps & nuts", "1890.00", "1690.00", "8", %{}},
      {"Carry bag", nil, "10.00", nil, nil, %{"kind" => "fee", "tracks_stock" => false}}
    ]

    stocked =
      for {name, category_name, price, cost, stock, opts} <- demo_products do
        attrs =
          Map.merge(
            %{
              "name" => name,
              "price" => price,
              "cost" => cost,
              "category_id" => category_name && categories[category_name].id
            },
            opts
          )

        {:ok, product} = Kaarobar.Catalog.create_product(shop, attrs)
        variant = Kaarobar.Catalog.Product.default_variant(product)

        # A fee has nothing to count, so it gets no opening stock — giving it
        # one would put a carry bag in the stock valuation.
        if stock do
          {:ok, _move} =
            Kaarobar.Inventory.set_opening_stock(shop, %{
              "variant_id" => variant.id,
              "branch_id" => shop.branch.id,
              "quantity" => stock,
              "unit_cost" => cost
            })
        end

        {name, variant, price}
      end

    variants_by_name = Map.new(stocked, fn {name, variant, _price} -> {name, variant} end)
    prices_by_name = Map.new(stocked, fn {name, _variant, price} -> {name, price} end)

    Logger.info("  stocked #{length(stocked)} products")

    # The wholesalers behind that catalog.
    for supplier <- [
          %{
            "name" => "Al-Madina Wholesale",
            "contact_name" => "Imran Sheikh",
            "phone" => "03211234567",
            "city" => "Lahore",
            "payment_terms_days" => 30
          },
          %{
            "name" => "Punjab Foods Distributors",
            "contact_name" => "Nadia Aslam",
            "phone" => "03009876543",
            "city" => "Lahore",
            "payment_terms_days" => 15
          },
          %{
            "name" => "Crescent Beverages",
            "contact_name" => "Usman Tariq",
            "phone" => "03337654321",
            "city" => "Sheikhupura",
            "payment_terms_days" => 7
          }
        ] do
      {:ok, _supplier} = Kaarobar.Purchasing.create_supplier(shop, supplier)
    end

    {:ok, register} =
      Kaarobar.Registers.create_register(shop, %{
        "name" => "Front counter",
        "invoice_prefix" => "FC"
      })

    {:ok, _shift} =
      Kaarobar.Registers.open_shift(shop, register, %{"opening_float" => "5000.00"})

    # Named rather than positional: the basket used to be "the first two
    # things in the catalog", which silently became a different basket — and
    # an underpaid sale — the moment the product list grew.
    basket = [{"Basmati rice 5kg", "2"}, {"Cooking oil 1L", "1"}]

    basket_total =
      Enum.reduce(basket, Decimal.new(0), fn {name, quantity}, total ->
        prices_by_name
        |> Map.fetch!(name)
        |> Decimal.new()
        |> Decimal.mult(Decimal.new(quantity))
        |> Decimal.add(total)
      end)

    {:ok, sale} =
      Kaarobar.Sales.Checkout.run(shop, %{
        "register_id" => register.id,
        "lines" =>
          Enum.map(basket, fn {name, quantity} ->
            %{"variant_id" => Map.fetch!(variants_by_name, name).id, "quantity" => quantity}
          end),
        "payments" => [
          %{
            "method" => "cash",
            "amount" => Decimal.to_string(basket_total, :normal),
            "tendered_amount" => "5000.00"
          }
        ]
      })

    Logger.info("  rang sale #{sale.number} on #{register.name}")

    # --- A second branch ------------------------------------------------------
    #
    # One branch is the case every screen accidentally handles: branch pickers,
    # transfers and per-branch stock only mean anything from two upwards.

    {:ok, warehouse} =
      Tenancy.create_branch(shop, %{
        "name" => "Township godown",
        "code" => "GOD-01",
        "is_warehouse" => true,
        "phone" => "0429876543",
        "address" => %{"line1" => "Plot 44, Township", "city" => "Lahore", "country_code" => "PK"}
      })

    Logger.info("  added branch #{warehouse.name}")

    # --- Customers ------------------------------------------------------------
    #
    # A mix of walk-in and account trade: a kiryana store's ledger is mostly
    # the handful of businesses that buy monthly on credit, not the counter
    # queue. Phone numbers are unique per business, so these double as the
    # fixture for that constraint.

    for customer <- [
          %{
            "name" => "Hotel Shalimar",
            "phone" => "03001234567",
            "city" => "Lahore",
            "credit_allowed" => true,
            "credit_limit" => "50000.00",
            "payment_terms_days" => 30
          },
          %{
            "name" => "Rehman Catering",
            "phone" => "03214567890",
            "city" => "Lahore",
            "credit_allowed" => true,
            "credit_limit" => "25000.00",
            "payment_terms_days" => 15
          },
          %{
            "name" => "Ayesha Siddiqui",
            "phone" => "03337778888",
            "city" => "Lahore",
            "tags" => ["regular"]
          },
          %{"name" => "Faisal Mehmood", "phone" => "03459990000", "city" => "Lahore"},
          %{
            "name" => "Green Valley School",
            "phone" => "04235551234",
            "city" => "Lahore",
            "credit_allowed" => true,
            "credit_limit" => "80000.00",
            "payment_terms_days" => 30,
            "is_tax_exempt" => true
          }
        ] do
      {:ok, _customer} = Kaarobar.Customers.create_customer(shop, customer)
    end

    # --- A custom role and pending invitations --------------------------------
    #
    # The system roles cover the usual shapes, but the roles screen is only
    # honestly exercised by a role somebody actually made up — and the
    # invitations screen needs something still outstanding to show.

    {:ok, weekend_role} =
      AccessControl.create_role(scope, %{
        "name" => "Weekend cashier",
        "description" => "Rings sales and takes payment, but cannot discount or refund.",
        "permissions" => ~w(
          sale:create sale:view payment:take customer:view product:view
          register:open_shift register:close_shift
        )
      })

    Logger.info("  created role #{weekend_role.name}")

    {:ok, cashier_role} = AccessControl.fetch_system_role("cashier")

    for invite <- [
          %{
            "email" => "saad.hussain@example.com",
            "name" => "Saad Hussain",
            "role_id" => cashier_role.id,
            "message" => "Starting on the front counter from Monday."
          },
          %{
            "email" => "hina.raza@example.com",
            "name" => "Hina Raza",
            "role_id" => weekend_role.id,
            "message" => "Weekend shifts only."
          }
        ] do
      {:ok, invitation} =
        Kaarobar.Staffing.invite(shop, invite, &KaarobarWeb.ClientLinks.accept_invitation/1)

      Logger.info("  invited #{invitation.email} as #{invitation.role.name}")
    end

    # --- The other verticals get a catalog too --------------------------------
    #
    # Each one is seeded with the product kinds its vertical actually permits
    # (Kaarobar.Verticals.product_kinds/1) — a grocery has no services to
    # sell, and a salon's stock-in-trade is time.

    businesses_by_type =
      scope |> Tenancy.list_businesses() |> Map.new(&{&1.business_type, &1})

    vertical_catalogs = [
      {"restaurant",
       [
         %{"name" => "Chicken karahi (full)", "price" => "2400.00", "kind" => "item"},
         %{"name" => "Mutton karahi (full)", "price" => "3600.00", "kind" => "item"},
         %{"name" => "Chicken tikka", "price" => "550.00", "kind" => "item"},
         %{"name" => "Seekh kebab (4 pcs)", "price" => "780.00", "kind" => "item"},
         %{"name" => "Daal makhani", "price" => "650.00", "kind" => "item"},
         %{"name" => "Garlic naan", "price" => "120.00", "kind" => "item"},
         %{"name" => "Plain naan", "price" => "60.00", "kind" => "item"},
         %{"name" => "Kashmiri chai", "price" => "280.00", "kind" => "item"},
         %{"name" => "Mineral water", "price" => "80.00", "kind" => "item"},
         %{"name" => "Family deal (karahi + 4 naan)", "price" => "2750.00", "kind" => "deal"},
         %{"name" => "Service charge", "price" => "150.00", "kind" => "fee"}
       ]},
      {"salon",
       [
         %{
           "name" => "Haircut & blow dry",
           "price" => "2500.00",
           "kind" => "service",
           "service_duration_minutes" => 45
         },
         %{
           "name" => "Hair colour (full)",
           "price" => "8500.00",
           "kind" => "service",
           "service_duration_minutes" => 120
         },
         %{
           "name" => "Party makeup",
           "price" => "12000.00",
           "kind" => "service",
           "service_duration_minutes" => 90
         },
         %{
           "name" => "Bridal package",
           "price" => "45000.00",
           "kind" => "service",
           "service_duration_minutes" => 240
         },
         %{
           "name" => "Manicure",
           "price" => "1800.00",
           "kind" => "service",
           "service_duration_minutes" => 30
         },
         %{
           "name" => "Threading",
           "price" => "500.00",
           "kind" => "service",
           "service_duration_minutes" => 15
         },
         %{"name" => "Gold membership", "price" => "25000.00", "kind" => "membership",
           "membership_days" => 365},
         %{"name" => "Gift voucher 5000", "price" => "5000.00", "kind" => "gift_card"},
         %{"name" => "Hair serum 100ml", "price" => "3200.00", "kind" => "item"}
       ]},
      {"fashion",
       [
         %{"name" => "Lawn suit (3 pc, unstitched)", "price" => "6500.00", "kind" => "item"},
         %{"name" => "Embroidered kurta", "price" => "4200.00", "kind" => "item"},
         %{"name" => "Cotton shalwar kameez", "price" => "3800.00", "kind" => "item"},
         %{"name" => "Denim jeans", "price" => "5400.00", "kind" => "item"},
         %{"name" => "Formal shirt", "price" => "3900.00", "kind" => "item"},
         %{"name" => "Pashmina shawl", "price" => "8900.00", "kind" => "item"},
         %{"name" => "Leather sandals", "price" => "6200.00", "kind" => "item"},
         %{"name" => "Gift card 10000", "price" => "10000.00", "kind" => "gift_card"},
         %{"name" => "Alteration charge", "price" => "500.00", "kind" => "fee"}
       ]}
    ]

    for {type, items} <- vertical_catalogs,
        business = businesses_by_type[type],
        not is_nil(business) do
      {:ok, vertical_scope} = Scopes.build(result.user, %{business_id: business.id})

      for attrs <- items do
        {:ok, _product} = Kaarobar.Catalog.create_product(vertical_scope, attrs)
      end

      Logger.info("  #{business.name}: #{length(items)} products")
    end

    Logger.info("""

    Demo data ready.

      Owner:      #{owner_email} / #{owner_password}
      Staff:      manager@ supervisor@ cashier@ stock_keeper@ accountant@ (kaarobar.test)
      Password:   #{owner_password}
      Verticals:  #{Enum.map_join(demo_businesses, ", ", & &1["business_type"])}

      Bilal Kiryana Store: #{length(stocked)} products across #{map_size(categories)} categories,
      2 branches, 5 customers (3 on credit), 3 suppliers, an open shift and one
      completed sale. Two invitations are still pending, and "Weekend cashier"
      is a custom role.
    """)

    :ok
      end)
end
