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
    # After LoadScope, because it reads the entitlements LoadScope resolves.
    # Only ever refuses an organization whose subscription has actually
    # expired — a failed payment keeps working through its grace period.
    plug KaarobarWeb.Plugs.RequireSubscription
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

    # Gateway callbacks. Unauthenticated because a gateway has no bearer token
    # and never will — the signature over the raw body is the credential, and
    # `KaarobarWeb.CacheBodyReader` is what keeps those bytes intact.
    post "/webhooks/:provider", PaymentController, :webhook
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

    # --- Inventory ---
    get "/stock", InventoryController, :index
    get "/stock/valuation", InventoryController, :valuation
    get "/stock/reconcile", InventoryController, :reconcile
    get "/stock/reorder", InventoryController, :reorder
    get "/stock/moves", InventoryController, :moves
    post "/stock/adjust", InventoryController, :adjust
    post "/stock/write-off", InventoryController, :write_off
    post "/stock/opening", InventoryController, :opening
    get "/stock/:branch_id/:variant_id", InventoryController, :show
    put "/stock/:branch_id/:variant_id", InventoryController, :update_settings
    get "/stock/:branch_id/:variant_id/ledger", InventoryController, :ledger

    get "/batches/expiring", InventoryController, :expiring
    get "/batches", InventoryController, :batches
    post "/batches", InventoryController, :create_batch
    put "/batches/:id/status", InventoryController, :set_batch_status

    get "/serials", InventoryController, :serials

    # --- Transfers and counts ---
    post "/stock-transfers/:id/dispatch", StockOperationsController, :dispatch_transfer
    post "/stock-transfers/:id/receive", StockOperationsController, :receive_transfer
    post "/stock-transfers/:id/cancel", StockOperationsController, :cancel_transfer
    get "/stock-transfers", StockOperationsController, :index_transfers
    post "/stock-transfers", StockOperationsController, :create_transfer
    get "/stock-transfers/:id", StockOperationsController, :show_transfer

    put "/stock-counts/:id/items/:item_id", StockOperationsController, :record_count
    post "/stock-counts/:id/submit", StockOperationsController, :submit_count
    post "/stock-counts/:id/approve", StockOperationsController, :approve_count
    post "/stock-counts/:id/cancel", StockOperationsController, :cancel_count
    get "/stock-counts", StockOperationsController, :index_counts
    post "/stock-counts", StockOperationsController, :create_count
    get "/stock-counts/:id", StockOperationsController, :show_count

    # --- Purchasing ---
    get "/suppliers/:id/ledger", PurchasingController, :supplier_ledger
    get "/suppliers/:id/products", PurchasingController, :supplier_products
    put "/suppliers/:id/products", PurchasingController, :put_supplier_product
    get "/suppliers", PurchasingController, :index_suppliers
    post "/suppliers", PurchasingController, :create_supplier
    get "/suppliers/:id", PurchasingController, :show_supplier
    patch "/suppliers/:id", PurchasingController, :update_supplier
    delete "/suppliers/:id", PurchasingController, :archive_supplier

    post "/purchase-orders/:id/approve", PurchasingController, :approve_order
    post "/purchase-orders/:id/cancel", PurchasingController, :cancel_order
    post "/purchase-orders/:id/close", PurchasingController, :close_order
    get "/purchase-orders", PurchasingController, :index_orders
    post "/purchase-orders", PurchasingController, :create_order
    get "/purchase-orders/:id", PurchasingController, :show_order
    patch "/purchase-orders/:id", PurchasingController, :update_order

    post "/goods-receipts/:id/post", PurchasingController, :post_receipt
    get "/goods-receipts", PurchasingController, :index_receipts
    post "/goods-receipts", PurchasingController, :create_receipt
    get "/goods-receipts/:id", PurchasingController, :show_receipt

    get "/supplier-bills/ageing", PurchasingController, :ageing
    post "/supplier-bills/:id/post", PurchasingController, :post_bill
    get "/supplier-bills", PurchasingController, :index_bills
    post "/supplier-bills", PurchasingController, :create_bill
    get "/supplier-bills/:id", PurchasingController, :show_bill

    post "/supplier-payments", PurchasingController, :record_payment

    post "/purchase-returns/:id/post", PurchasingController, :post_return
    get "/purchase-returns", PurchasingController, :index_returns
    post "/purchase-returns", PurchasingController, :create_return
    get "/purchase-returns/:id", PurchasingController, :show_return

    # --- Registers, shifts and the drawer ---
    # Shift routes are declared before "/registers/:id" so the literal segments
    # are never read as a register id.
    get "/shifts/:id/x-report", RegisterController, :x_report
    get "/shifts/:id/reconcile", RegisterController, :reconcile
    get "/shifts/:id/cash-movements", RegisterController, :cash_movements
    post "/shifts/:id/cash-movements", RegisterController, :cash_movement
    post "/shifts/:id/close", RegisterController, :close_shift
    get "/shifts", RegisterController, :index_shifts
    get "/shifts/:id", RegisterController, :show_shift

    get "/registers/:id/shift", RegisterController, :current_shift
    post "/registers/:id/shift", RegisterController, :open_shift
    get "/registers", RegisterController, :index
    post "/registers", RegisterController, :create
    get "/registers/:id", RegisterController, :show
    patch "/registers/:id", RegisterController, :update
    delete "/registers/:id", RegisterController, :delete

    # --- Selling ---
    # "quote", "returns", "refund-requests" and "by-number" all precede the
    # "/sales/:id" route so none of them is mistaken for a sale id.
    post "/sales/quote", SalesController, :preview
    get "/sales/returns", SalesController, :returns
    get "/sales/by-number/:number", SalesController, :by_number

    get "/refund-requests", SalesController, :index_refund_requests
    get "/refund-requests/:id", SalesController, :show_refund_request
    post "/refund-requests/:id/approve", SalesController, :approve_refund
    post "/refund-requests/:id/reject", SalesController, :reject_refund
    post "/sales/:sale_id/refund-requests", SalesController, :create_refund_request

    post "/sales/:id/void", SalesController, :void
    post "/sales/:id/refund", SalesController, :refund
    get "/sales", SalesController, :index
    post "/sales", SalesController, :create
    get "/sales/:id", SalesController, :show

    # --- Open tickets ---
    post "/orders/:id/items", OrderController, :add_items
    delete "/orders/:id/items/:item_id", OrderController, :remove_item
    post "/orders/:id/hold", OrderController, :hold
    post "/orders/:id/resume", OrderController, :resume
    post "/orders/:id/cancel", OrderController, :cancel
    get "/orders", OrderController, :index
    post "/orders", OrderController, :create
    get "/orders/:id", OrderController, :show

    # --- Customers and credit ---
    get "/customers/ageing", CustomerController, :ageing
    get "/customers/lookup/:phone", CustomerController, :lookup
    get "/customers/:id/ledger", CustomerController, :ledger
    get "/customers/:id/payments", CustomerController, :payments
    post "/customers/:id/payments", CustomerController, :record_payment
    get "/customers", CustomerController, :index
    post "/customers", CustomerController, :create
    get "/customers/:id", CustomerController, :show
    patch "/customers/:id", CustomerController, :update
    delete "/customers/:id", CustomerController, :delete

    # Attached to a customer record: part of who they are, not what they owe.
    get "/customers/:customer_id/addresses", CustomerController, :addresses
    post "/customers/:customer_id/addresses", CustomerController, :add_address
    patch "/customer-addresses/:id", CustomerController, :update_address
    delete "/customer-addresses/:id", CustomerController, :delete_address

    get "/customers/:customer_id/contacts", CustomerController, :contacts
    post "/customers/:customer_id/contacts", CustomerController, :add_contact
    patch "/customer-contacts/:id", CustomerController, :update_contact
    delete "/customer-contacts/:id", CustomerController, :delete_contact

    get "/customers/:customer_id/notes", CustomerController, :notes
    post "/customers/:customer_id/notes", CustomerController, :add_note
    delete "/customer-notes/:id", CustomerController, :delete_note

    # Groups: what a class of customer is charged and allowed.
    get "/customer-groups", CustomerGroupController, :index
    post "/customer-groups", CustomerGroupController, :create
    get "/customer-groups/:id", CustomerGroupController, :show
    patch "/customer-groups/:id", CustomerGroupController, :update
    delete "/customer-groups/:id", CustomerGroupController, :delete

    # Credit: which invoices are unpaid, and what settled them.
    get "/credit/invoices", CreditController, :invoices
    get "/credit/overdue", CreditController, :overdue
    get "/credit/ageing", CreditController, :ageing
    get "/credit/ageing/by-customer", CreditController, :by_customer
    get "/credit/statement/:customer_id", CreditController, :statement
    get "/credit/sales/:sale_id/allocations", CreditController, :allocations
    post "/credit/payments/:payment_id/allocate", CreditController, :allocate

    # Follow-ups: what somebody has to do next, by when.
    get "/follow-ups", FollowUpController, :index
    get "/follow-ups/:id", FollowUpController, :show
    post "/customers/:customer_id/follow-ups", FollowUpController, :create
    patch "/follow-ups/:id", FollowUpController, :update
    post "/follow-ups/:id/complete", FollowUpController, :complete
    post "/follow-ups/:id/cancel", FollowUpController, :cancel

    # Loyalty.
    get "/loyalty/program", LoyaltyController, :program
    post "/loyalty/program", LoyaltyController, :create_program
    patch "/loyalty/program", LoyaltyController, :update_program
    post "/loyalty/expire", LoyaltyController, :expire
    get "/loyalty/customers/:customer_id", LoyaltyController, :account
    get "/loyalty/customers/:customer_id/transactions", LoyaltyController, :transactions
    post "/loyalty/customers/:customer_id/redeem", LoyaltyController, :redeem
    post "/loyalty/customers/:customer_id/adjust", LoyaltyController, :adjust

    # Gift cards. The code is only ever returned by the issuing call.
    post "/gift-cards", PrepaidController, :issue_gift_card
    get "/gift-cards/:code", PrepaidController, :show_gift_card
    get "/gift-cards/:code/history", PrepaidController, :gift_card_history
    post "/gift-cards/:code/activate", PrepaidController, :activate_gift_card
    post "/gift-cards/:code/redeem", PrepaidController, :redeem_gift_card
    post "/gift-cards/:code/top-up", PrepaidController, :top_up_gift_card

    # Store credit.
    get "/customers/:customer_id/store-credit", PrepaidController, :list_store_credit
    post "/customers/:customer_id/store-credit", PrepaidController, :issue_store_credit
    get "/store-credit/:id/history", PrepaidController, :store_credit_history
    post "/store-credit/:id/redeem", PrepaidController, :redeem_store_credit

    # --- Food service -------------------------------------------------------
    # The floor. `floor-plan` is the screen a restaurant leaves open.
    get "/dining/floor-plan", DiningController, :floor_plan
    get "/dining/floors", DiningController, :floors
    post "/dining/floors", DiningController, :create_floor
    patch "/dining/floors/:id", DiningController, :update_floor
    delete "/dining/floors/:id", DiningController, :delete_floor

    get "/dining/tables", DiningController, :tables
    post "/dining/tables", DiningController, :create_table
    patch "/dining/tables/:id", DiningController, :update_table
    delete "/dining/tables/:id", DiningController, :delete_table

    get "/dining/sessions", DiningController, :sessions
    post "/dining/sessions", DiningController, :seat
    get "/dining/sessions/:id", DiningController, :show_session
    patch "/dining/sessions/:id", DiningController, :update_session
    post "/dining/sessions/:id/transfer", DiningController, :transfer
    post "/dining/sessions/:id/merge", DiningController, :merge
    post "/dining/sessions/:id/bill", DiningController, :mark_billed
    post "/dining/sessions/:id/close", DiningController, :close_session

    # The kitchen display. `board` is polled all service.
    get "/kitchen/board", KitchenController, :board
    get "/kitchen/stations", KitchenController, :stations
    post "/kitchen/stations", KitchenController, :create_station
    patch "/kitchen/stations/:id", KitchenController, :update_station
    delete "/kitchen/stations/:id", KitchenController, :delete_station

    post "/kitchen/fire", KitchenController, :fire
    get "/kitchen/tickets/:id", KitchenController, :show_ticket
    post "/kitchen/tickets/:id/start", KitchenController, :start
    post "/kitchen/tickets/:id/ready", KitchenController, :ready
    post "/kitchen/tickets/:id/bump", KitchenController, :bump
    post "/kitchen/tickets/:id/recall", KitchenController, :recall
    post "/kitchen/tickets/:id/items/:item_id", KitchenController, :set_item_status

    # Deliveries.
    get "/deliveries", DeliveryController, :index
    post "/deliveries", DeliveryController, :create
    get "/deliveries/riders", DeliveryController, :rider_board
    get "/deliveries/:id", DeliveryController, :show
    post "/deliveries/:id/assign", DeliveryController, :assign
    post "/deliveries/:id/pick-up", DeliveryController, :pick_up
    post "/deliveries/:id/deliver", DeliveryController, :deliver
    post "/deliveries/:id/fail", DeliveryController, :fail
    post "/deliveries/:id/cancel", DeliveryController, :cancel

    # --- Salon, spa, clinic -------------------------------------------------
    get "/scheduling/resources", SchedulingController, :resources
    post "/scheduling/resources", SchedulingController, :create_resource
    patch "/scheduling/resources/:id", SchedulingController, :update_resource
    delete "/scheduling/resources/:id", SchedulingController, :delete_resource
    get "/scheduling/availability", SchedulingController, :availability
    get "/scheduling/diary", SchedulingController, :diary

    get "/appointments", SchedulingController, :index
    post "/appointments", SchedulingController, :book
    get "/appointments/:id", SchedulingController, :show
    post "/appointments/:id/advance", SchedulingController, :advance
    post "/appointments/:id/reschedule", SchedulingController, :reschedule
    post "/appointments/:id/cancel", SchedulingController, :cancel
    post "/appointments/:id/no-show", SchedulingController, :no_show

    get "/queue", SchedulingController, :queue
    post "/queue", SchedulingController, :join_queue
    post "/queue/:id/call", SchedulingController, :call_from_queue
    post "/queue/:id/seat", SchedulingController, :seat_from_queue
    post "/queue/:id/leave", SchedulingController, :leave_queue

    # --- Laundry, ironing, repair -------------------------------------------
    get "/service-jobs", ServiceJobController, :index
    post "/service-jobs", ServiceJobController, :create
    get "/service-jobs/overdue", ServiceJobController, :overdue
    get "/service-jobs/by-tag/:tag", ServiceJobController, :show_by_tag
    get "/service-jobs/:id", ServiceJobController, :show
    patch "/service-jobs/:id", ServiceJobController, :update
    get "/service-jobs/:id/history", ServiceJobController, :history
    post "/service-jobs/:id/start", ServiceJobController, :start
    post "/service-jobs/:id/ready", ServiceJobController, :ready
    post "/service-jobs/:id/deliver", ServiceJobController, :deliver
    post "/service-jobs/:id/hold", ServiceJobController, :hold
    post "/service-jobs/:id/cancel", ServiceJobController, :cancel
    post "/service-jobs/:id/notes", ServiceJobController, :add_note
    post "/service-jobs/:id/items/:item_id/move", ServiceJobController, :move_item
    post "/service-jobs/:id/items/:item_id/incident", ServiceJobController, :report_incident

    # --- Commissions --------------------------------------------------------
    get "/commissions/rules", CommissionController, :rules
    post "/commissions/rules", CommissionController, :create_rule
    patch "/commissions/rules/:id", CommissionController, :update_rule
    delete "/commissions/rules/:id", CommissionController, :delete_rule
    get "/commissions/summary", CommissionController, :summary
    get "/commissions/statement/:user_id", CommissionController, :statement
    post "/commissions/approve", CommissionController, :approve
    post "/commissions/pay", CommissionController, :pay

    # --- Hire ---------------------------------------------------------------
    get "/rentals/units", RentalController, :units
    post "/rentals/units", RentalController, :create_unit
    patch "/rentals/units/:id", RentalController, :update_unit
    delete "/rentals/units/:id", RentalController, :delete_unit
    get "/rentals/available", RentalController, :available

    get "/rentals", RentalController, :index
    post "/rentals", RentalController, :book
    get "/rentals/overdue", RentalController, :overdue
    get "/rentals/:id", RentalController, :show
    post "/rentals/:id/issue", RentalController, :issue
    post "/rentals/:id/return", RentalController, :take_back
    post "/rentals/:id/cancel", RentalController, :cancel

    # --- Professional services ----------------------------------------------
    get "/quotes", QuoteController, :index
    post "/quotes", QuoteController, :create
    get "/quotes/win-rate", QuoteController, :win_rate
    get "/quotes/:id", QuoteController, :show
    put "/quotes/:id/lines", QuoteController, :set_lines
    post "/quotes/:id/send", QuoteController, :send_quote
    post "/quotes/:id/accept", QuoteController, :accept
    post "/quotes/:id/decline", QuoteController, :decline

    get "/time-entries", QuoteController, :time
    post "/time-entries", QuoteController, :log_time
    get "/time-entries/unbilled", QuoteController, :unbilled
    get "/time-entries/utilisation", QuoteController, :utilisation
    patch "/time-entries/:id", QuoteController, :update_time
    delete "/time-entries/:id", QuoteController, :delete_time

    # --- The regulated register (read-only; checkout writes it) --------------
    get "/regulated/register", RegulatedController, :index
    get "/regulated/register/batch/:batch_id", RegulatedController, :batch
    get "/regulated/products", RegulatedController, :products

    # --- Gateway payments ---------------------------------------------------
    get "/payments/providers", PaymentController, :providers
    post "/payments/providers", PaymentController, :configure
    patch "/payments/providers/:id", PaymentController, :update_provider
    delete "/payments/providers/:id", PaymentController, :delete_provider

    get "/payments", PaymentController, :index
    post "/payments", PaymentController, :charge
    get "/payments/settlements", PaymentController, :settlements
    post "/payments/settlements/:id/reconcile", PaymentController, :reconcile
    get "/payments/:id", PaymentController, :show
    post "/payments/:id/capture", PaymentController, :capture
    post "/payments/:id/refund", PaymentController, :refund
    post "/payments/:id/sync", PaymentController, :sync

    # --- Printable documents ---------------------------------------------------
    # Sends HTML or raw ESC/POS bytes rather than the JSON envelope: a receipt
    # is a document, not a resource.
    get "/sales/:sale_id/receipt", DocumentController, :receipt
    get "/customers/:customer_id/statement", DocumentController, :statement

    # --- Reports --------------------------------------------------------------
    # Every one takes `from`/`to` and defaults to the last thirty days. Read
    # from the nightly rollups for closed days and live for today.
    get "/reports/summary", ReportController, :summary
    get "/reports/daily", ReportController, :daily
    get "/reports/top-products", ReportController, :top_products
    get "/reports/by-category", ReportController, :by_category
    get "/reports/by-branch", ReportController, :by_branch
    get "/reports/by-tender", ReportController, :by_tender
    get "/reports/by-cashier", ReportController, :by_cashier
    get "/reports/by-hour", ReportController, :by_hour
    get "/reports/profit", ReportController, :profit
    get "/reports/tax", ReportController, :tax
    get "/reports/receivables", ReportController, :receivables
    get "/reports/payables", ReportController, :payables
    # The X report reads the shift's running totals; the Z report recomputes
    # them from the sales, which is the only honest answer to "are you sure?".
    get "/reports/shifts/:shift_id/x", ReportController, :x_report
    get "/reports/shifts/:shift_id/z", ReportController, :z_report
    post "/reports/rebuild", ReportController, :rebuild
    # Sends a CSV file rather than the JSON envelope.
    get "/reports/:report/export.csv", ReportController, :export

    # --- Expenses and bank accounts -------------------------------------------
    # The literal segments come first so "categories" is never read as an id.
    get "/expenses/categories", ExpenseController, :categories
    post "/expenses/categories", ExpenseController, :create_category
    patch "/expenses/categories/:id", ExpenseController, :update_category
    delete "/expenses/categories/:id", ExpenseController, :delete_category

    get "/expenses/by-category", ExpenseController, :by_category
    get "/expenses", ExpenseController, :index
    post "/expenses", ExpenseController, :create
    get "/expenses/:id", ExpenseController, :show
    post "/expenses/:id/approve", ExpenseController, :approve
    post "/expenses/:id/reject", ExpenseController, :reject
    delete "/expenses/:id", ExpenseController, :delete

    get "/bank-accounts", ExpenseController, :bank_accounts
    post "/bank-accounts", ExpenseController, :create_bank_account
    patch "/bank-accounts/:id", ExpenseController, :update_bank_account
    delete "/bank-accounts/:id", ExpenseController, :delete_bank_account

    # --- Platform billing ----------------------------------------------------
    # Reachable even when the subscription has lapsed: see
    # `KaarobarWeb.Plugs.RequireSubscription`, which exempts this controller.
    # An organization that cannot reach the screen where it pays cannot become
    # a paying customer again.
    get "/billing/plans", BillingController, :plans
    get "/billing/subscription", BillingController, :show
    post "/billing/subscription", BillingController, :subscribe
    put "/billing/subscription/plan", BillingController, :change_plan
    put "/billing/subscription/quantity", BillingController, :set_quantity
    delete "/billing/subscription", BillingController, :cancel
    post "/billing/subscription/resume", BillingController, :resume
    get "/billing/invoices", BillingController, :invoices
    get "/billing/invoices/:id", BillingController, :invoice

    # --- Fiscal compliance ---------------------------------------------------
    # The literal segments come before "/fiscal/submissions/:id" so neither
    # "status" nor "retry" is ever read as a submission id.
    get "/fiscal/config", FiscalController, :config
    put "/fiscal/config", FiscalController, :configure
    delete "/fiscal/config", FiscalController, :disable

    get "/fiscal/status", FiscalController, :status
    post "/fiscal/retry", FiscalController, :retry_all
    get "/fiscal/submissions", FiscalController, :index
    get "/fiscal/submissions/:id", FiscalController, :show
    post "/fiscal/submissions/:id/retry", FiscalController, :retry

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
