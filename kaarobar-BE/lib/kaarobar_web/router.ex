defmodule KaarobarWeb.Router do
  use KaarobarWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :authenticated do
    plug KaarobarWeb.Auth.Pipeline
    plug KaarobarWeb.Plugs.TenantScope
  end

  pipeline :pos_roles do
    plug KaarobarWeb.Plugs.Authorize, bundle: :pos
  end

  pipeline :pos_approve_roles do
    plug KaarobarWeb.Plugs.Authorize, bundle: :pos_approve
  end

  pipeline :inventory_roles do
    plug KaarobarWeb.Plugs.Authorize, bundle: :inventory
  end

  pipeline :accounting_roles do
    plug KaarobarWeb.Plugs.Authorize, bundle: :accounting
  end

  pipeline :customer_roles do
    plug KaarobarWeb.Plugs.Authorize, bundle: :customers
  end

  pipeline :marketing_roles do
    plug KaarobarWeb.Plugs.Authorize, bundle: :marketing
  end

  pipeline :hr_roles do
    plug KaarobarWeb.Plugs.Authorize, bundle: :hr
  end

  pipeline :leave_approve_roles do
    plug KaarobarWeb.Plugs.Authorize, bundle: :leave_approve
  end

  pipeline :payroll_approve_roles do
    plug KaarobarWeb.Plugs.Authorize, bundle: :payroll_approve
  end

  pipeline :reports_roles do
    plug KaarobarWeb.Plugs.Authorize, bundle: :reports
  end

  pipeline :employee_self_roles do
    plug KaarobarWeb.Plugs.Authorize, bundle: :employee_self
  end

  pipeline :customer_portal do
    plug KaarobarWeb.Plugs.CustomerPortalAuth
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through :api

    get "/health", HealthController, :index
    post "/auth/register", AuthController, :register
    post "/auth/login", AuthController, :login
    post "/auth/mfa/verify", AuthController, :verify_mfa
    post "/billing/webhook", BillingController, :webhook

    # Customer Portal auth (CUS-FR) — unauthenticated
    post "/portal/auth/register", PortalAuthController, :register
    post "/portal/auth/login", PortalAuthController, :login
    post "/portal/auth/verify-email", PortalAuthController, :verify_email
    post "/portal/auth/request-reset", PortalAuthController, :request_reset
    post "/portal/auth/reset-password", PortalAuthController, :reset_password
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :customer_portal]

    post "/portal/auth/logout", PortalAuthController, :logout
    get "/portal/me", PortalController, :me
    patch "/portal/me", PortalController, :update_profile
    post "/portal/me/profile-pic", PortalController, :upload_profile_pic
    delete "/portal/me/profile-pic", PortalController, :delete_profile_pic
    get "/portal/orders", PortalController, :orders
    get "/portal/orders/:id", PortalController, :show_order
    get "/portal/loyalty", PortalController, :loyalty
    get "/portal/ar", PortalController, :ar
    post "/portal/ar/pay", PortalController, :pay_ar
    get "/portal/bookings", PortalController, :bookings
    post "/portal/sessions/revoke", PortalController, :revoke_sessions
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated]

    get "/auth/me", AuthController, :me
    patch "/auth/me", AuthController, :update_me
    post "/auth/me/profile-pic", AuthController, :upload_profile_pic
    delete "/auth/me/profile-pic", AuthController, :delete_profile_pic
    post "/auth/mfa/setup", AuthController, :mfa_setup
    post "/auth/mfa/confirm", AuthController, :mfa_confirm

    get "/businesses", BusinessController, :index
    post "/businesses", BusinessController, :create
    get "/businesses/:id", BusinessController, :show
    patch "/businesses/:id", BusinessController, :update
    post "/businesses/:id/deactivate", BusinessController, :deactivate

    get "/businesses/:business_id/branches", BranchController, :index
    post "/businesses/:business_id/branches", BranchController, :create
    get "/businesses/:business_id/branches/:id", BranchController, :show
    patch "/businesses/:business_id/branches/:id", BranchController, :update
    post "/businesses/:business_id/branches/:id/deactivate", BranchController, :deactivate

    get "/businesses/:business_id/memberships", MembershipController, :index
    post "/businesses/:business_id/memberships", MembershipController, :create
    get "/businesses/:business_id/role-settings", RoleSettingsController, :show
    put "/businesses/:business_id/role-settings", RoleSettingsController, :update
    patch "/memberships/:id", MembershipController, :update
    post "/memberships/:id/deactivate", MembershipController, :deactivate

    get "/audit-logs", AuditController, :index

    get "/billing/subscription", BillingController, :show
    get "/notifications", NotificationController, :index
    get "/notifications/unread-count", NotificationController, :unread_count
    post "/notifications/read-all", NotificationController, :mark_all_read
    post "/notifications/:id/read", NotificationController, :mark_read
    get "/notification-preferences", NotificationController, :get_preferences
    put "/notification-preferences", NotificationController, :update_preferences
    post "/device-tokens", NotificationController, :register_device
    delete "/device-tokens/:id", NotificationController, :revoke_device
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :pos_roles]

    get "/products", ProductController, :index
    post "/products", ProductController, :create
    get "/products/by-barcode/:code", ProductController, :by_barcode
    get "/products/:id", ProductController, :show
    patch "/products/:id", ProductController, :update
    post "/products/:id/variants", ProductController, :create_variant
    post "/products/:id/images", ProductController, :upload_image
    delete "/products/:id/images/:image_id", ProductController, :delete_image
    get "/products/:id/batches", ProductController, :list_batches
    post "/products/:id/batches", ProductController, :create_batch

    get "/categories", CategoryController, :index
    post "/categories", CategoryController, :create
    get "/modifier-groups", ModifierGroupController, :index
    post "/modifier-groups", ModifierGroupController, :create
    post "/products/:product_id/modifier-groups", ModifierGroupController, :attach

    get "/sales", SaleController, :index
    get "/sales/:id", SaleController, :show
    post "/sales", SaleController, :create
    get "/tills", TillController, :index
    get "/tills/current", TillController, :current
    get "/tills/:id", TillController, :show
    post "/tills/open", TillController, :open
    post "/tills/:id/close", TillController, :close
    get "/returns", ReturnController, :index
    get "/returns/pending", ReturnController, :pending
    get "/returns/:id", ReturnController, :show
    post "/returns", ReturnController, :create
    get "/fbr/sales/:sale_id", FbrController, :status

    get "/sync/catalog", SyncController, :catalog
    get "/sync/inventory", SyncController, :inventory
    post "/sync/sales", SyncController, :push_sales
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :pos_approve_roles]

    post "/returns/:id/approve", ReturnController, :approve
    post "/returns/:id/reject", ReturnController, :reject
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :inventory_roles]

    get "/inventory", InventoryController, :index
    post "/inventory/prices", InventoryController, :set_price
    get "/inventory/adjustments", InventoryController, :list_adjustments
    post "/inventory/adjust", InventoryController, :adjust
    get "/inventory/transfers", InventoryController, :list_transfers
    post "/inventory/transfers", InventoryController, :transfer
    post "/inventory/transfers/:id/confirm", InventoryController, :confirm_transfer
    get "/inventory/purchase-orders", InventoryController, :list_pos
    get "/inventory/purchase-orders/:id", InventoryController, :show_po
    post "/inventory/purchase-orders", InventoryController, :create_po
    patch "/inventory/purchase-orders/:id", InventoryController, :update_po_status
    get "/inventory/grn", InventoryController, :list_grn
    post "/inventory/grn", InventoryController, :receive_grn
    get "/suppliers", SupplierController, :index
    post "/suppliers", SupplierController, :create
    get "/suppliers/:id", SupplierController, :show
    patch "/suppliers/:id", SupplierController, :update
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :accounting_roles]

    get "/accounts", AccountController, :index
    post "/accounts", AccountController, :create
    patch "/accounts/:id", AccountController, :update

    get "/journals", JournalController, :index
    get "/journals/:id", JournalController, :show
    post "/journals", JournalController, :create
    post "/journals/:id/reverse", JournalController, :reverse

    get "/ar/invoices", ArApController, :list_ar
    get "/ar/invoices/:id", ArApController, :show_ar
    post "/ar/invoices", ArApController, :create_ar
    post "/ar/invoices/:id/pay", ArApController, :pay_ar
    get "/ar/aging", ArApController, :ar_aging
    get "/ap/bills", ArApController, :list_ap
    get "/ap/bills/:id", ArApController, :show_ap
    post "/ap/bills", ArApController, :create_ap
    post "/ap/bills/:id/pay", ArApController, :pay_ap
    get "/ap/aging", ArApController, :ap_aging
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :customer_roles]

    get "/customers", ArApController, :list_customers
    post "/customers", ArApController, :create_customer
    get "/customers/:id", ArApController, :show_customer
    patch "/customers/:id", ArApController, :update_customer
    post "/customers/:id/profile-pic", ArApController, :upload_customer_profile_pic
    delete "/customers/:id/profile-pic", ArApController, :delete_customer_profile_pic
    post "/customers/:id/loyalty", ArApController, :adjust_loyalty
    post "/customers/:id/portal-invite", ArApController, :invite_portal
    get "/customers/:id/ledger", ArApController, :customer_ledger
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :marketing_roles]

    get "/crm/campaigns", CrmController, :index
    post "/crm/campaigns", CrmController, :create
    post "/crm/campaigns/preview", CrmController, :preview
    get "/crm/campaigns/:id", CrmController, :show
    post "/crm/campaigns/:id/send", CrmController, :send

    get "/crm/segments", CrmController, :list_segments
    post "/crm/segments", CrmController, :create_segment
    patch "/crm/segments/:id", CrmController, :update_segment
    delete "/crm/segments/:id", CrmController, :delete_segment

    get "/crm/coupons", CrmController, :list_coupons
    post "/crm/coupons", CrmController, :create_coupon
    patch "/crm/coupons/:id", CrmController, :update_coupon
    post "/crm/coupons/validate", CrmController, :validate_coupon

    get "/crm/loyalty-tiers", CrmController, :list_tiers
    post "/crm/loyalty-tiers", CrmController, :create_tier
    patch "/crm/loyalty-tiers/:id", CrmController, :update_tier
    delete "/crm/loyalty-tiers/:id", CrmController, :delete_tier
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :reports_roles]

    get "/reports/dashboard", ReportController, :dashboard
    get "/reports/branch", ReportController, :branch
    get "/reports/sales-by-day", ReportController, :sales_by_day
    get "/reports/low-stock", ReportController, :low_stock
    get "/reports/trial-balance", ReportController, :trial_balance
    get "/reports/general-ledger", ReportController, :general_ledger
    get "/reports/profit-and-loss", ReportController, :profit_and_loss
    get "/reports/balance-sheet", ReportController, :balance_sheet
    get "/reports/consolidated", ReportController, :consolidated
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :hr_roles]

    get "/employees", EmployeeController, :index
    get "/employees/:id", EmployeeController, :show
    post "/employees", EmployeeController, :create
    patch "/employees/:id", EmployeeController, :update
    post "/employees/:id/profile-pic", EmployeeController, :upload_profile_pic
    delete "/employees/:id/profile-pic", EmployeeController, :delete_profile_pic

    get "/attendance", AttendanceController, :index

    get "/payroll", PayrollController, :index
    get "/payroll/:id", PayrollController, :show
    post "/payroll", PayrollController, :create
    post "/payroll/:id/submit", PayrollController, :submit
    post "/payroll/:id/recalculate", PayrollController, :recalculate
    post "/payroll/:id/reject", PayrollController, :reject
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :leave_approve_roles]

    get "/leave", LeaveController, :index
    post "/leave/:id/approve", LeaveController, :approve
    post "/leave/:id/reject", LeaveController, :reject
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :payroll_approve_roles]

    post "/payroll/:id/approve", PayrollController, :approve
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :employee_self_roles]

    get "/ess/me", EssController, :me
    post "/ess/me/profile-pic", EssController, :upload_profile_pic
    delete "/ess/me/profile-pic", EssController, :delete_profile_pic
    post "/attendance/clock-in", AttendanceController, :clock_in
    post "/attendance/:id/clock-out", AttendanceController, :clock_out
    post "/leave", LeaveController, :create
  end

  # Compile-time gate: only compiled into the router when :dev_routes is true (config/dev.exs).
  if Application.compile_env(:kaarobar, :dev_routes, false) do
    scope "/dev", KaarobarWeb do
      pipe_through :browser

      get "/creds", DevCredsController, :index
    end
  end
end

