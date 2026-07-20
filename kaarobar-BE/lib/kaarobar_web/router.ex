defmodule KaarobarWeb.Router do
  use KaarobarWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :authenticated do
    plug KaarobarWeb.Auth.Pipeline
    plug KaarobarWeb.Plugs.TenantScope
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through :api

    get "/health", HealthController, :index
    post "/auth/register", AuthController, :register
    post "/auth/login", AuthController, :login
    post "/billing/webhook", BillingController, :webhook
  end

  scope "/api/v1", KaarobarWeb.V1 do
    pipe_through [:api, :authenticated]

    get "/auth/me", AuthController, :me

    get "/businesses", BusinessController, :index
    post "/businesses", BusinessController, :create
    get "/businesses/:id", BusinessController, :show
    get "/businesses/:business_id/branches", BranchController, :index
    post "/businesses/:business_id/branches", BranchController, :create

    get "/products", ProductController, :index
    post "/products", ProductController, :create

    post "/sales", SaleController, :create
    post "/tills/open", TillController, :open
    post "/tills/:id/close", TillController, :close
    post "/returns", ReturnController, :create
    post "/returns/:id/approve", ReturnController, :approve

    post "/inventory/adjust", InventoryController, :adjust
    post "/inventory/transfers", InventoryController, :transfer
    post "/inventory/transfers/:id/confirm", InventoryController, :confirm_transfer
    post "/inventory/purchase-orders", InventoryController, :create_po
    post "/inventory/grn", InventoryController, :receive_grn

    post "/journals", JournalController, :create
    get "/reports/dashboard", ReportController, :dashboard
    get "/reports/trial-balance", ReportController, :trial_balance
    get "/reports/profit-and-loss", ReportController, :profit_and_loss
    get "/reports/balance-sheet", ReportController, :balance_sheet

    get "/employees", EmployeeController, :index
    post "/employees", EmployeeController, :create
    post "/attendance/clock-in", AttendanceController, :clock_in
    post "/attendance/:id/clock-out", AttendanceController, :clock_out
    post "/leave", LeaveController, :create
    post "/leave/:id/approve", LeaveController, :approve
    post "/payroll", PayrollController, :create
    post "/payroll/:id/submit", PayrollController, :submit
    post "/payroll/:id/approve", PayrollController, :approve

    get "/billing/subscription", BillingController, :show
    get "/fbr/sales/:sale_id", FbrController, :status
  end
end
