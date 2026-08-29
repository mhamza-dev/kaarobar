defmodule KaarobarWeb.Router do
  use KaarobarWeb, :router

  # ---------------------------------------------------------------------------
  # Pipelines
  # ---------------------------------------------------------------------------

  pipeline :api do
    plug :accepts, ["json"]
    plug KaarobarWeb.Plugs.RequestContext
    plug KaarobarWeb.Plugs.ValidateIdParams
  end

  # Unauthenticated endpoints that are worth attacking: sign-in, registration,
  # password reset, invitation acceptance. Throttled hard, by address.
  pipeline :api_sensitive do
    plug KaarobarWeb.Plugs.RateLimit,
      limit: 20,
      window: :timer.minutes(1),
      by: :ip,
      bucket: "auth"
  end

  # The main pipeline. Order matters:
  #
  #   RequireAuth  — who is calling
  #   LoadScope    — which tenant, and what they may do there
  #   Idempotency  — needs the tenant, since keys are scoped to it
  #   RateLimit    — by user, now that we know who they are
  pipeline :api_authenticated do
    plug KaarobarWeb.Plugs.RequireAuth
    plug KaarobarWeb.Plugs.LoadScope
    plug KaarobarWeb.Plugs.Idempotency

    # Generous. A barcode scanner fires bursts and a busy counter rings a sale
    # every few seconds; throttling checkout would be worse than the abuse it
    # prevents. The tight limits live on the sensitive pipeline above.
    plug KaarobarWeb.Plugs.RateLimit,
      limit: 600,
      window: :timer.minutes(1),
      by: :user,
      bucket: "api"
  end

  # ---------------------------------------------------------------------------
  # Public
  # ---------------------------------------------------------------------------

  scope "/api/v1", KaarobarWeb do
    pipe_through :api

    get "/health", HealthController, :show
    get "/ready", HealthController, :ready

    # The signup form needs this before an account exists.
    get "/business-types", BusinessController, :types
  end

  scope "/api/v1", KaarobarWeb do
    pipe_through [:api, :api_sensitive]

    post "/auth/register", AuthController, :register
    post "/auth/login", AuthController, :login
    post "/auth/forgot-password", AuthController, :forgot_password
    post "/auth/reset-password", AuthController, :reset_password
    post "/auth/confirm", AuthController, :confirm

    # Held by the invitee, who has no account yet. The token is the credential.
    get "/invitations/:token", InvitationController, :preview
    post "/invitations/:token/accept", InvitationController, :accept
  end

  # ---------------------------------------------------------------------------
  # Authenticated
  # ---------------------------------------------------------------------------

  scope "/api/v1", KaarobarWeb do
    pipe_through [:api, :api_authenticated]

    # --- Session ---
    post "/auth/logout", AuthController, :logout
    post "/auth/logout-all", AuthController, :logout_all
    post "/auth/resend-confirmation", AuthController, :resend_confirmation

    # --- The caller ---
    get "/me", MeController, :show
    patch "/me", MeController, :update
    put "/me/password", MeController, :update_password
    put "/me/email", MeController, :update_email
    get "/me/devices", MeController, :devices
    delete "/me/devices/:id", MeController, :revoke_device

    # --- Tenancy ---
    get "/organizations", OrganizationController, :index
    get "/organization", OrganizationController, :show
    patch "/organization", OrganizationController, :update

    resources "/businesses", BusinessController, except: [:new, :edit]

    post "/branches/:id/main", BranchController, :set_main
    resources "/branches", BranchController, except: [:new, :edit]

    # --- Staff ---
    get "/staff", StaffController, :index
    get "/staff/:id", StaffController, :show
    patch "/staff/:id", StaffController, :update
    delete "/staff/:id", StaffController, :delete
    put "/staff/:id/status", StaffController, :set_status
    put "/staff/:id/roles", StaffController, :assign_roles
    put "/staff/:id/branches", StaffController, :assign_branches
    put "/staff/:id/pin", StaffController, :set_pin
    put "/staff/:id/grants", StaffController, :put_grant
    delete "/staff/:id/grants/:permission_key", StaffController, :delete_grant

    resources "/invitations", InvitationController, only: [:index, :create, :delete]

    # --- Access control ---
    # Declared before the :id route so "permissions" is not read as an id.
    get "/roles/permissions", RoleController, :permissions
    get "/roles", RoleController, :index
    resources "/roles", RoleController, only: [:show, :create, :update, :delete]

    # --- Catalog ---
    # Declared before the :id route so "scan" is not read as a product id.
    get "/products/scan/:barcode", ProductController, :scan
    post "/products/:product_id/variants/matrix", VariantController, :matrix
    get "/products/:product_id/variants", VariantController, :index
    post "/products/:product_id/variants", VariantController, :create
    resources "/products", ProductController, except: [:new, :edit]

    patch "/variants/:id", VariantController, :update
    delete "/variants/:id", VariantController, :delete
    post "/variants/:variant_id/barcodes", VariantController, :add_barcode
    delete "/barcodes/:id", VariantController, :delete_barcode

    resources "/categories", CategoryController, except: [:new, :edit]
    resources "/brands", BrandController, only: [:index, :create, :update, :delete]
    resources "/units", UnitController, only: [:index, :create]

    post "/option-types/:option_type_id/values", OptionTypeController, :create_value
    get "/option-types", OptionTypeController, :index
    post "/option-types", OptionTypeController, :create
    get "/option-types/:id", OptionTypeController, :show

    post "/modifier-groups/:modifier_group_id/modifiers",
         ModifierGroupController,
         :create_modifier

    get "/modifier-groups", ModifierGroupController, :index
    post "/modifier-groups", ModifierGroupController, :create
    get "/modifier-groups/:id", ModifierGroupController, :show
    patch "/modifier-groups/:id", ModifierGroupController, :update
    delete "/modifier-groups/:id", ModifierGroupController, :delete

    post "/products/:product_id/modifier-groups/:modifier_group_id",
         ModifierGroupController,
         :attach

    delete "/products/:product_id/modifier-groups/:modifier_group_id",
           ModifierGroupController,
           :detach

    # --- Tax ---
    post "/tax-groups/:id/default", TaxController, :set_default_group
    get "/tax-groups", TaxController, :groups
    post "/tax-groups", TaxController, :create_group
    get "/tax-groups/:id", TaxController, :show_group
    patch "/tax-groups/:id", TaxController, :update_group
    delete "/tax-groups/:id", TaxController, :delete_group
    resources "/taxes", TaxController, only: [:index, :create, :update, :delete]

    # --- Pricing ---
    post "/pricing/quote", PricingController, :quote

    put "/price-lists/:price_list_id/prices", PricingController, :put_price
    delete "/price-lists/:price_list_id/prices/:variant_id", PricingController, :delete_price
    get "/price-lists", PricingController, :index_lists
    post "/price-lists", PricingController, :create_list
    get "/price-lists/:id", PricingController, :show_list
    patch "/price-lists/:id", PricingController, :update_list
    delete "/price-lists/:id", PricingController, :delete_list

    get "/promotions", PricingController, :index_rules
    post "/promotions", PricingController, :create_rule
    patch "/promotions/:id", PricingController, :update_rule
    delete "/promotions/:id", PricingController, :delete_rule

    # --- Audit ---
    get "/audit-logs", AuditController, :index
  end

  # ---------------------------------------------------------------------------
  # Development tooling
  # ---------------------------------------------------------------------------

  if Application.compile_env(:backend, :dev_routes) do
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: KaarobarWeb.Telemetry, ecto_repos: [Kaarobar.Repo]
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
