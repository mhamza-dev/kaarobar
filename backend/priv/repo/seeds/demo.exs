# Demo data: one owner, one organization, one business per vertical.
#
#     SEED_DEMO=true mix run priv/repo/seeds.exs
#
# The point is that every vertical the platform claims to support can be
# exercised immediately, by hand, without anyone first building a tenant. If a
# vertical cannot be set up here, it is not really supported.
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

    demo_products = [
      %{"name" => "Basmati rice 5kg", "price" => "1850.00", "cost" => "1600.00", "stock" => "40"},
      %{"name" => "Cooking oil 1L", "price" => "620.00", "cost" => "540.00", "stock" => "80"},
      %{"name" => "Tea 250g", "price" => "480.00", "cost" => "400.00", "stock" => "120"},
      %{"name" => "Sugar 1kg", "price" => "165.00", "cost" => "142.00", "stock" => "200"}
    ]

    stocked =
      for attrs <- demo_products do
        {:ok, product} =
          Kaarobar.Catalog.create_product(shop, Map.take(attrs, ~w(name price cost)))

        variant = Kaarobar.Catalog.Product.default_variant(product)

        {:ok, _move} =
          Kaarobar.Inventory.set_opening_stock(shop, %{
            "variant_id" => variant.id,
            "branch_id" => shop.branch.id,
            "quantity" => attrs["stock"],
            "unit_cost" => attrs["cost"]
          })

        variant
      end

    {:ok, register} =
      Kaarobar.Registers.create_register(shop, %{
        "name" => "Front counter",
        "invoice_prefix" => "FC"
      })

    {:ok, _shift} =
      Kaarobar.Registers.open_shift(shop, register, %{"opening_float" => "5000.00"})

    # A wholesale customer who buys on account, which is how a kiryana store
    # actually does much of its trade.
    {:ok, _customer} =
      Kaarobar.Customers.create_customer(shop, %{
        "name" => "Hotel Shalimar",
        "phone" => "03001234567",
        "credit_allowed" => true,
        "credit_limit" => "50000.00"
      })

    [rice, oil | _rest] = stocked

    {:ok, sale} =
      Kaarobar.Sales.Checkout.run(shop, %{
        "register_id" => register.id,
        "lines" => [
          %{"variant_id" => rice.id, "quantity" => "2"},
          %{"variant_id" => oil.id, "quantity" => "1"}
        ],
        "payments" => [
          %{"method" => "cash", "amount" => "4320.00", "tendered_amount" => "5000.00"}
        ]
      })

    Logger.info("  rang sale #{sale.number} on #{register.name}")

    Logger.info("""

    Demo data ready.

      Owner:    #{owner_email} / #{owner_password}
      Staff:    manager@ supervisor@ cashier@ stock_keeper@ accountant@ (kaarobar.test)
      Password: #{owner_password}
      Verticals: #{Enum.map_join(demo_businesses, ", ", & &1["business_type"])}
    """)
end
