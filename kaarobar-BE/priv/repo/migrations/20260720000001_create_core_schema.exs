defmodule Kaarobar.Repo.Migrations.CreateCoreSchema do
  use Ecto.Migration

  def change do
    # Users table
    create table(:users, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :email, :string, null: false
      add :password_hash, :string, null: false
      add :name, :string, null: false
      add :phone, :string
      add :status, :string, default: "active", null: false
      add :is_platform_admin, :boolean, default: false, null: false
      add :totp_secret, :string
      add :confirmed_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create unique_index(:users, [:email])

    # Businesses table
    create table(:businesses, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :name, :string, null: false
      add :industry, :string
      add :tax_jurisdiction, :string, default: "PK", null: false
      add :subscription_plan, :string, default: "trial", null: false
      add :fbr_tier1, :boolean, default: false, null: false
      add :is_active, :boolean, default: true, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:businesses, [:owner_id])

    # Branches table
    create table(:branches, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :name, :string, null: false
      add :address, :map
      add :timezone, :string, default: "Asia/Karachi"
      add :is_active, :boolean, default: true, null: false
      add :refund_auto_approve_limit, :decimal, precision: 15, scale: 2, default: 0
      add :discount_auto_approve_limit, :decimal, precision: 15, scale: 2, default: 0

      timestamps(type: :utc_datetime)
    end

    create index(:branches, [:business_id, :owner_id])
    create index(:branches, [:owner_id])

    # Memberships table
    create table(:memberships, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all)
      add :roles, {:array, :string}, default: [], null: false
      add :status, :string, default: "active", null: false

      timestamps(type: :utc_datetime)
    end

    create index(:memberships, [:user_id, :business_id])
    create index(:memberships, [:owner_id, :business_id])
    create unique_index(:memberships, [:user_id, :business_id, :branch_id])

    # Audit logs table
    create table(:audit_logs, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :user_id, references(:users, type: :binary_id, on_delete: :nothing)
      add :action, :string, null: false
      add :entity_type, :string, null: false
      add :entity_id, :binary_id
      add :metadata, :map
      add :ip_address, :string

      add :inserted_at, :utc_datetime, null: false
    end

    create index(:audit_logs, [:owner_id, :inserted_at])
    create index(:audit_logs, [:entity_type, :entity_id])

    # Chart of accounts table
    create table(:chart_of_accounts, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :code, :string, null: false
      add :name, :string, null: false
      add :type, :string, null: false
      add :parent_account_id, references(:chart_of_accounts, type: :binary_id, on_delete: :nothing)

      timestamps(type: :utc_datetime)
    end

    create index(:chart_of_accounts, [:business_id, :owner_id])
    create unique_index(:chart_of_accounts, [:business_id, :code])

    # Products table
    create table(:products, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :sku, :string, null: false
      add :name, :string, null: false
      add :category, :string
      add :tax_rate, :decimal, precision: 5, scale: 2, default: 0
      add :is_active, :boolean, default: true, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:products, [:business_id, :owner_id])
    create unique_index(:products, [:business_id, :sku])

    # Product branch prices table
    create table(:product_branch_prices, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :product_id, references(:products, type: :binary_id, on_delete: :delete_all), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :price, :decimal, precision: 15, scale: 2, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:product_branch_prices, [:product_id, :branch_id, :owner_id, :business_id])
    create unique_index(:product_branch_prices, [:product_id, :branch_id])

    # Inventory records table
    create table(:inventory_records, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all), null: false
      add :product_id, references(:products, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :quantity_on_hand, :decimal, precision: 15, scale: 4, default: 0, null: false
      add :avg_cost, :decimal, precision: 15, scale: 2, default: 0, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:inventory_records, [:branch_id, :product_id])
    create index(:inventory_records, [:owner_id, :business_id])

    # Suppliers table
    create table(:suppliers, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :name, :string, null: false
      add :contact, :map
      add :payment_terms, :string

      timestamps(type: :utc_datetime)
    end

    create index(:suppliers, [:business_id, :owner_id])

    # Purchase orders table
    create table(:purchase_orders, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :supplier_id, references(:suppliers, type: :binary_id, on_delete: :nothing), null: false
      add :status, :string, default: "draft", null: false
      add :expected_delivery_date, :date
      add :notes, :text

      timestamps(type: :utc_datetime)
    end

    create index(:purchase_orders, [:business_id, :branch_id, :owner_id])

    # Purchase order items table
    create table(:purchase_order_items, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :purchase_order_id, references(:purchase_orders, type: :binary_id, on_delete: :delete_all), null: false
      add :product_id, references(:products, type: :binary_id, on_delete: :nothing), null: false
      add :quantity, :decimal, precision: 15, scale: 4, null: false
      add :unit_cost, :decimal, precision: 15, scale: 2, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:purchase_order_items, [:purchase_order_id])

    # Goods receipts table
    create table(:goods_receipts, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :purchase_order_id, references(:purchase_orders, type: :binary_id, on_delete: :nothing), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :received_by_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :status, :string, default: "pending", null: false
      add :notes, :text

      timestamps(type: :utc_datetime)
    end

    create index(:goods_receipts, [:branch_id, :owner_id, :business_id])

    # Goods receipt items table
    create table(:goods_receipt_items, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :goods_receipt_id, references(:goods_receipts, type: :binary_id, on_delete: :delete_all), null: false
      add :product_id, references(:products, type: :binary_id, on_delete: :nothing), null: false
      add :quantity_received, :decimal, precision: 15, scale: 4, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:goods_receipt_items, [:goods_receipt_id])

    # Stock transfers table
    create table(:stock_transfers, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :from_branch_id, references(:branches, type: :binary_id, on_delete: :nothing), null: false
      add :to_branch_id, references(:branches, type: :binary_id, on_delete: :nothing), null: false
      add :status, :string, default: "pending", null: false
      add :notes, :text

      timestamps(type: :utc_datetime)
    end

    create index(:stock_transfers, [:business_id, :owner_id])

    # Stock transfer items table
    create table(:stock_transfer_items, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :stock_transfer_id, references(:stock_transfers, type: :binary_id, on_delete: :delete_all), null: false
      add :product_id, references(:products, type: :binary_id, on_delete: :nothing), null: false
      add :quantity, :decimal, precision: 15, scale: 4, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:stock_transfer_items, [:stock_transfer_id])

    # Stock adjustments table
    create table(:stock_adjustments, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all), null: false
      add :product_id, references(:products, type: :binary_id, on_delete: :nothing), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :quantity_delta, :decimal, precision: 15, scale: 4, null: false
      add :reason_code, :string, null: false
      add :notes, :text
      add :adjusted_by_id, references(:users, type: :binary_id, on_delete: :nothing), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:stock_adjustments, [:branch_id, :owner_id, :business_id])

    # Customers table
    create table(:customers, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :name, :string, null: false
      add :phone, :string
      add :email, :string
      add :loyalty_points, :integer, default: 0

      timestamps(type: :utc_datetime)
    end

    create index(:customers, [:business_id, :owner_id])

    # Tills table
    create table(:tills, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :cashier_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :opened_at, :utc_datetime, null: false
      add :closed_at, :utc_datetime
      add :opening_cash, :decimal, precision: 15, scale: 2, default: 0
      add :closing_cash, :decimal, precision: 15, scale: 2
      add :expected_cash, :decimal, precision: 15, scale: 2
      add :status, :string, default: "open", null: false

      timestamps(type: :utc_datetime)
    end

    create index(:tills, [:branch_id, :owner_id, :business_id])

    # Sales table
    create table(:sales, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :cashier_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :customer_id, references(:customers, type: :binary_id, on_delete: :nothing)
      add :till_id, references(:tills, type: :binary_id, on_delete: :nothing)
      add :invoice_number, :string, null: false
      add :client_txn_id, :binary_id, null: false
      add :status, :string, default: "Completed", null: false
      add :subtotal, :decimal, precision: 15, scale: 2, null: false
      add :tax_amount, :decimal, precision: 15, scale: 2, default: 0
      add :discount_amount, :decimal, precision: 15, scale: 2, default: 0
      add :total_amount, :decimal, precision: 15, scale: 2, null: false
      add :fbr_invoice_no, :string
      add :notes, :text

      timestamps(type: :utc_datetime)
    end

    create unique_index(:sales, [:client_txn_id])
    create index(:sales, [:branch_id, :owner_id, :business_id])
    create index(:sales, [:invoice_number])

    # Sale items table
    create table(:sale_items, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :sale_id, references(:sales, type: :binary_id, on_delete: :delete_all), null: false
      add :product_id, references(:products, type: :binary_id, on_delete: :nothing)
      add :sku, :string, null: false
      add :name, :string, null: false
      add :quantity, :decimal, precision: 15, scale: 4, null: false
      add :unit_price, :decimal, precision: 15, scale: 2, null: false
      add :discount, :decimal, precision: 15, scale: 2, default: 0
      add :tax_rate, :decimal, precision: 5, scale: 2, default: 0
      add :line_total, :decimal, precision: 15, scale: 2, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:sale_items, [:sale_id])

    # Sale payments table
    create table(:sale_payments, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :sale_id, references(:sales, type: :binary_id, on_delete: :delete_all), null: false
      add :method, :string, null: false
      add :amount, :decimal, precision: 15, scale: 2, null: false
      add :reference, :string

      timestamps(type: :utc_datetime)
    end

    create index(:sale_payments, [:sale_id])

    # Sale returns table
    create table(:sale_returns, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :sale_id, references(:sales, type: :binary_id, on_delete: :nothing), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all), null: false
      add :requested_by_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :approved_by_id, references(:users, type: :binary_id, on_delete: :nothing)
      add :status, :string, default: "PendingApproval", null: false
      add :refund_amount, :decimal, precision: 15, scale: 2, null: false
      add :reason, :text

      timestamps(type: :utc_datetime)
    end

    create index(:sale_returns, [:sale_id, :owner_id, :business_id, :branch_id])

    # Sale return items table
    create table(:sale_return_items, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :sale_return_id, references(:sale_returns, type: :binary_id, on_delete: :delete_all), null: false
      add :sale_item_id, references(:sale_items, type: :binary_id, on_delete: :nothing), null: false
      add :product_id, references(:products, type: :binary_id, on_delete: :nothing)
      add :quantity, :decimal, precision: 15, scale: 4, null: false
      add :amount, :decimal, precision: 15, scale: 2, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:sale_return_items, [:sale_return_id])

    # Journal entries table
    create table(:journal_entries, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all)
      add :date, :date, null: false
      add :source_type, :string
      add :source_id, :binary_id
      add :description, :text
      add :posted_by_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :is_locked, :boolean, default: false, null: false
      add :reversed_entry_id, references(:journal_entries, type: :binary_id, on_delete: :nothing)

      timestamps(type: :utc_datetime)
    end

    create index(:journal_entries, [:business_id, :owner_id])
    create index(:journal_entries, [:source_type, :source_id])

    # Journal lines table
    create table(:journal_lines, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :journal_entry_id, references(:journal_entries, type: :binary_id, on_delete: :delete_all), null: false
      add :account_id, references(:chart_of_accounts, type: :binary_id, on_delete: :nothing), null: false
      add :debit, :decimal, precision: 15, scale: 2, default: 0
      add :credit, :decimal, precision: 15, scale: 2, default: 0
      add :memo, :string

      timestamps(type: :utc_datetime)
    end

    create index(:journal_lines, [:journal_entry_id])
    create index(:journal_lines, [:account_id])

    # Employees table
    create table(:employees, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all), null: false
      add :employee_code, :string, null: false
      add :name, :string, null: false
      add :position, :string
      add :join_date, :date, null: false
      add :basic_salary, :decimal, precision: 15, scale: 2, default: 0
      add :allowances, :map
      add :status, :string, default: "active", null: false

      timestamps(type: :utc_datetime)
    end

    create index(:employees, [:business_id, :owner_id])
    create unique_index(:employees, [:business_id, :employee_code])

    # Attendance records table
    create table(:attendance_records, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :employee_id, references(:employees, type: :binary_id, on_delete: :delete_all), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :date, :date, null: false
      add :clock_in, :utc_datetime
      add :clock_out, :utc_datetime
      add :source, :string, default: "pos", null: false

      timestamps(type: :utc_datetime)
    end

    create index(:attendance_records, [:employee_id, :branch_id, :owner_id, :business_id])
    create unique_index(:attendance_records, [:employee_id, :date])

    # Leave requests table
    create table(:leave_requests, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :employee_id, references(:employees, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :type, :string, null: false
      add :start_date, :date, null: false
      add :end_date, :date, null: false
      add :status, :string, default: "Pending", null: false
      add :reason, :text
      add :approved_by_id, references(:users, type: :binary_id, on_delete: :nothing)

      timestamps(type: :utc_datetime)
    end

    create index(:leave_requests, [:employee_id, :owner_id, :business_id])

    # Payroll runs table
    create table(:payroll_runs, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :period_start, :date, null: false
      add :period_end, :date, null: false
      add :status, :string, default: "Draft", null: false
      add :approved_by_id, references(:users, type: :binary_id, on_delete: :nothing)
      add :journal_entry_id, references(:journal_entries, type: :binary_id, on_delete: :nothing)

      timestamps(type: :utc_datetime)
    end

    create index(:payroll_runs, [:business_id, :owner_id])

    # Payslips table
    create table(:payslips, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :payroll_run_id, references(:payroll_runs, type: :binary_id, on_delete: :delete_all), null: false
      add :employee_id, references(:employees, type: :binary_id, on_delete: :delete_all), null: false
      add :gross_pay, :decimal, precision: 15, scale: 2, null: false
      add :deductions, :map
      add :net_pay, :decimal, precision: 15, scale: 2, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:payslips, [:payroll_run_id])
    create index(:payslips, [:employee_id])

    # Subscriptions table
    create table(:subscriptions, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :owner_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :plan, :string, default: "trial", null: false
      add :status, :string, default: "active", null: false
      add :lemon_squeezy_id, :string
      add :trial_ends_at, :utc_datetime
      add :current_period_end, :utc_datetime
      add :max_businesses, :integer, default: 1
      add :max_branches, :integer, default: 1
      add :max_users, :integer, default: 3

      timestamps(type: :utc_datetime)
    end

    create unique_index(:subscriptions, [:owner_id])

    # Notifications table
    create table(:notifications, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :channel, :string, null: false
      add :type, :string, null: false
      add :payload, :map
      add :status, :string, default: "pending", null: false
      add :sent_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:notifications, [:user_id, :owner_id])
    create index(:notifications, [:status])
  end
end
