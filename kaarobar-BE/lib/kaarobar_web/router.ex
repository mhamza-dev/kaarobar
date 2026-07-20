defmodule KaarobarWeb.Router do
  use KaarobarWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
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

  pipeline :hr_roles do
    plug KaarobarWeb.Plugs.Authorize, bundle: :hr
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

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through :api

    get "/health", HealthController, :index
    post "/auth/register", AuthController, :register
    post "/auth/login", AuthController, :login
    post "/auth/mfa/verify", AuthController, :verify_mfa
    post "/billing/webhook", BillingController, :webhook
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated]

    get "/auth/me", AuthController, :me
    patch "/auth/me", AuthController, :update_me
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
    patch "/memberships/:id", MembershipController, :update
    post "/memberships/:id/deactivate", MembershipController, :deactivate

    get "/audit-logs", AuditController, :index

    get "/billing/subscription", BillingController, :show
    get "/notifications", NotificationController, :index
    post "/notifications/:id/read", NotificationController, :mark_read
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

    get "/customers", ArApController, :list_customers
    post "/customers", ArApController, :create_customer
    get "/ar/invoices", ArApController, :list_ar
    post "/ar/invoices", ArApController, :create_ar
    post "/ar/invoices/:id/pay", ArApController, :pay_ar
    get "/ar/aging", ArApController, :ar_aging
    get "/ap/bills", ArApController, :list_ap
    post "/ap/bills", ArApController, :create_ap
    post "/ap/bills/:id/pay", ArApController, :pay_ap
    get "/ap/aging", ArApController, :ap_aging
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

    get "/attendance", AttendanceController, :index
    get "/leave", LeaveController, :index
    post "/leave/:id/approve", LeaveController, :approve
    post "/leave/:id/reject", LeaveController, :reject

    get "/payroll", PayrollController, :index
    get "/payroll/:id", PayrollController, :show
    post "/payroll", PayrollController, :create
    post "/payroll/:id/submit", PayrollController, :submit
    post "/payroll/:id/reject", PayrollController, :reject
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :payroll_approve_roles]

    post "/payroll/:id/approve", PayrollController, :approve
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :employee_self_roles]

    get "/ess/me", EssController, :me
    post "/attendance/clock-in", AttendanceController, :clock_in
    post "/attendance/:id/clock-out", AttendanceController, :clock_out
    post "/leave", LeaveController, :create
  end
end
