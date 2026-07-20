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
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :pos_roles]

    get "/products", ProductController, :index
    post "/products", ProductController, :create
    get "/sales", SaleController, :index
    get "/sales/:id", SaleController, :show
    post "/sales", SaleController, :create
    get "/tills/current", TillController, :current
    post "/tills/open", TillController, :open
    post "/tills/:id/close", TillController, :close
    post "/returns", ReturnController, :create
    get "/fbr/sales/:sale_id", FbrController, :status
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :pos_approve_roles]

    post "/returns/:id/approve", ReturnController, :approve
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :inventory_roles]

    get "/inventory", InventoryController, :index
    post "/inventory/prices", InventoryController, :set_price
    post "/inventory/adjust", InventoryController, :adjust
    post "/inventory/transfers", InventoryController, :transfer
    post "/inventory/transfers/:id/confirm", InventoryController, :confirm_transfer
    post "/inventory/purchase-orders", InventoryController, :create_po
    post "/inventory/grn", InventoryController, :receive_grn
    get "/suppliers", SupplierController, :index
    post "/suppliers", SupplierController, :create
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :accounting_roles]

    post "/journals", JournalController, :create
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :reports_roles]

    get "/reports/dashboard", ReportController, :dashboard
    get "/reports/trial-balance", ReportController, :trial_balance
    get "/reports/profit-and-loss", ReportController, :profit_and_loss
    get "/reports/balance-sheet", ReportController, :balance_sheet
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :hr_roles]

    get "/employees", EmployeeController, :index
    post "/employees", EmployeeController, :create
    post "/leave/:id/approve", LeaveController, :approve
    post "/payroll", PayrollController, :create
    post "/payroll/:id/submit", PayrollController, :submit
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :payroll_approve_roles]

    post "/payroll/:id/approve", PayrollController, :approve
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated, :employee_self_roles]

    post "/attendance/clock-in", AttendanceController, :clock_in
    post "/attendance/:id/clock-out", AttendanceController, :clock_out
    post "/leave", LeaveController, :create
  end
end
