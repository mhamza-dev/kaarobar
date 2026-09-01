defmodule Kaarobar.Repo.Migrations.CreateReporting do
  use Ecto.Migration

  @moduledoc """
  What the shop made, what it spent, and the pre-computed answers behind both.

  ## Why rollups exist at all

  A dashboard asking "how did this month go?" against raw `sales` and
  `sale_items` reads every line the shop has ever sold. That is fine for a
  fortnight-old business and unusable for a three-year-old one, and the shop
  that most needs the answer is the one with the most rows.

  So each closed day is folded into one row per branch and one row per product,
  and the dashboard reads those. The raw tables stay authoritative — a rollup
  is a cache with a rebuild button, never a source of truth. Every figure in it
  can be recomputed from the ledger it summarises, which is what makes it safe
  to throw away and rebuild when a sale is voided a week late.

  ## Today is never rolled up

  Only days that have finished, in the business's own timezone. A partial day
  cached at four in the afternoon is a number that goes stale as the shop keeps
  trading, and a dashboard showing this morning's takings as final is worse
  than one that takes a moment to add them up live.

  ## Expenses are the other half of a P&L

  Revenue without costs is not profit, and a shopkeeper asking "did I make
  money this month?" means rent, wages, electricity and stock. Expenses are
  kept as ordinary dated rows against a category, with an optional bank
  account, because that is the shape every accountant already knows.
  """

  def change do
    # ------------------------------------------------------------- categories
    create table(:expense_categories, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      add :code, :string
      # Whether this spend belongs above or below the gross-profit line. Rent is
      # an operating cost; a stock purchase is cost of sales and would be
      # double-counted against margin if it sat with the electricity bill.
      add :kind, :string, null: false, default: "operating"

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:expense_categories, [:business_id, :name],
             where: "deleted_at IS NULL"
           )

    create constraint(:expense_categories, :expense_categories_kind_check,
             check: "kind IN ('operating','cost_of_sales','payroll','tax','other')"
           )

    # ---------------------------------------------------------- bank accounts
    create table(:bank_accounts, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      add :bank_name, :string
      # Stored as given. Not encrypted: an account number is printed on every
      # cheque the shop writes, and treating it as a secret would imply a
      # protection it has never had.
      add :account_number, :string
      add :iban, :string
      add :currency, :string, size: 3, null: false

      # A projection of the movements against it, maintained under a row lock
      # the same way stock and customer balances are.
      add :balance, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :opening_balance, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:bank_accounts, [:business_id, :name], where: "deleted_at IS NULL")

    # ----------------------------------------------------------------expenses
    create table(:expenses, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :nilify_all)

      add :expense_category_id,
          references(:expense_categories, type: :binary_id, on_delete: :restrict),
          null: false

      add :bank_account_id,
          references(:bank_accounts, type: :binary_id, on_delete: :nilify_all)

      add :number, :string, null: false
      add :description, :string, null: false
      add :amount, :decimal, precision: 16, scale: 4, null: false
      add :tax_amount, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :currency, :string, size: 3, null: false

      add :method, :string, null: false, default: "cash"
      add :reference, :string
      # The date it belongs to for reporting, which is not always the date it
      # was typed in. A bill paid on the 2nd for last month's electricity is
      # last month's cost.
      add :spent_on, :date, null: false

      add :status, :string, null: false, default: "recorded"
      add :approved_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :approved_at, :utc_datetime_usec

      add :supplier_id, references(:suppliers, type: :binary_id, on_delete: :nilify_all)
      add :recorded_by_id, references(:users, type: :binary_id, on_delete: :restrict)
      add :notes, :text
      add :attachment_path, :string

      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:expenses, [:business_id, :number])
    create index(:expenses, [:business_id, :spent_on])
    create index(:expenses, [:expense_category_id, :spent_on])
    create index(:expenses, [:business_id, :status], where: "status = 'pending'")

    create constraint(:expenses, :expenses_amount_check, check: "amount > 0")

    create constraint(:expenses, :expenses_status_check,
             check: "status IN ('pending','recorded','approved','rejected')"
           )

    create constraint(:expenses, :expenses_method_check,
             check: "method IN ('cash','card','bank','cheque','wallet','other')"
           )

    create constraint(:expenses, :expenses_approved_check,
             check: "status <> 'approved' OR approved_at IS NOT NULL"
           )

    # -------------------------------------------------------- daily rollups
    create table(:daily_sales_rollups, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :branch_id,
          references(:branches, type: :binary_id, on_delete: :delete_all),
          null: false

      add :day, :date, null: false

      add :sale_count, :integer, null: false, default: 0
      add :item_count, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :customer_count, :integer, null: false, default: 0

      add :gross_sales, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :discount_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :net_sales, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :refund_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      # From the per-line cost snapshots, so a margin computed today for a day
      # last year uses last year's costs.
      add :cost_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      # Tender split as a map rather than a column each: a business can add a
      # wallet next year, and a schema change per payment method is a schema
      # change per business decision.
      add :tender_totals, :map, null: false, default: fragment("'{}'::jsonb")

      add :voided_count, :integer, null: false, default: 0
      # When this row was last computed. A rollup older than the sale it
      # summarises is a rollup to rebuild.
      add :computed_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:daily_sales_rollups, [:branch_id, :day])
    create index(:daily_sales_rollups, [:business_id, :day])

    create table(:product_daily_rollups, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :branch_id,
          references(:branches, type: :binary_id, on_delete: :delete_all),
          null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :delete_all),
          null: false

      add :product_id, references(:products, type: :binary_id, on_delete: :delete_all)
      add :category_id, references(:categories, type: :binary_id, on_delete: :nilify_all)

      add :day, :date, null: false

      add :quantity, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :refunded_quantity, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :net_sales, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :discount_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :cost_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :computed_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:product_daily_rollups, [:branch_id, :variant_id, :day],
             name: :product_daily_rollups_branch_variant_day_index
           )

    create index(:product_daily_rollups, [:business_id, :day])
    create index(:product_daily_rollups, [:category_id, :day])
  end
end
