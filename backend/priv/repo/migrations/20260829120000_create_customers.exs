defmodule Kaarobar.Repo.Migrations.CreateCustomers do
  use Ecto.Migration

  @moduledoc """
  Customers, and what they owe.

  Deliberately minimal here. The full CRM — groups, loyalty, gift cards, store
  credit, addresses — belongs to the customers phase. What is needed *now* is
  the part checkout cannot work without: a shop selling on credit has to know
  who owes what, and a "pay later" tender that does not post to a ledger is a
  debt nobody is tracking.

  ## The ledger mirrors the stock one

  `customer_ledger_entries` is append-only with a snapshotted `balance_after`,
  and `customers.balance` is a projection maintained in the same transaction —
  the same shape as `stock_moves`/`stock_items` and
  `supplier_ledger_entries`/`suppliers.balance`. Three ledgers, one pattern:
  when a statement does not add up, it shows the row where it stopped adding up.

  `credit_limit` is enforced at checkout rather than advisory. Refusing a
  credit sale at the counter is awkward; discovering six months of unpayable
  debt is worse, and the shopkeeper set the limit for a reason.
  """

  def change do
    create table(:customers, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      add :code, :string
      add :phone, :string
      add :email, :string

      add :address_line1, :string
      add :address_line2, :string
      add :city, :string
      add :postal_code, :string
      add :country_code, :string, size: 2

      add :tax_number, :string
      add :date_of_birth, :date
      add :notes, :text

      # What they owe right now. A projection of the ledger.
      add :balance, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :credit_limit, :decimal, precision: 16, scale: 4
      # Whether this customer may buy on credit at all.
      add :credit_allowed, :boolean, null: false, default: false

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:customers, [:business_id])
    create index(:customers, [:business_id, :name])

    create unique_index(:customers, [:business_id, :phone],
             where: "phone IS NOT NULL AND deleted_at IS NULL"
           )

    create unique_index(:customers, [:business_id, :code],
             where: "code IS NOT NULL AND deleted_at IS NULL"
           )

    create constraint(:customers, :customers_credit_limit_check,
             check: "credit_limit IS NULL OR credit_limit >= 0"
           )

    # ------------------------------------------------------- customer ledger
    create table(:customer_ledger_entries, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :nilify_all)

      add :customer_id, references(:customers, type: :binary_id, on_delete: :restrict),
        null: false

      add :kind, :string, null: false

      # Signed: positive increases what the customer owes, negative reduces it.
      add :amount, :decimal, precision: 16, scale: 4, null: false
      add :balance_after, :decimal, precision: 16, scale: 4, null: false

      add :reference_type, :string
      add :reference_id, :binary_id

      add :note, :text
      add :occurred_at, :utc_datetime_usec, null: false

      add :actor_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :actor_label, :string

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:customer_ledger_entries, [:customer_id, :occurred_at])
    create index(:customer_ledger_entries, [:business_id, :occurred_at])
    create index(:customer_ledger_entries, [:reference_type, :reference_id])

    create constraint(:customer_ledger_entries, :customer_ledger_kind_check,
             check: "kind IN ('opening','sale','payment','refund','credit_note','adjustment')"
           )

    create constraint(:customer_ledger_entries, :customer_ledger_amount_check,
             check: "amount <> 0"
           )

    execute """
            CREATE OR REPLACE FUNCTION customer_ledger_reject_change()
            RETURNS trigger AS $$
            BEGIN
              RAISE EXCEPTION 'customer_ledger_entries is append-only';
            END;
            $$ LANGUAGE plpgsql;
            """,
            "DROP FUNCTION IF EXISTS customer_ledger_reject_change()"

    execute """
            CREATE TRIGGER customer_ledger_no_update
            BEFORE UPDATE ON customer_ledger_entries
            FOR EACH ROW EXECUTE FUNCTION customer_ledger_reject_change();
            """,
            "DROP TRIGGER IF EXISTS customer_ledger_no_update ON customer_ledger_entries"

    # ------------------------------------------------------ customer payments
    create table(:customer_payments, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :nilify_all)

      add :customer_id, references(:customers, type: :binary_id, on_delete: :restrict),
        null: false

      add :number, :string, null: false
      add :method, :string, null: false, default: "cash"
      add :amount, :decimal, precision: 16, scale: 4, null: false

      add :paid_on, :date, null: false
      add :reference, :string
      add :notes, :text

      add :created_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      # Set when the money was taken at a till, so it lands in that shift.
      add :shift_id, :binary_id

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:customer_payments, [:business_id, :number])
    create index(:customer_payments, [:customer_id, :paid_on])
    create index(:customer_payments, [:shift_id])

    create constraint(:customer_payments, :customer_payments_amount_check,
             check: "amount > 0"
           )

    create constraint(:customer_payments, :customer_payments_method_check,
             check: "method IN ('cash','card','bank_transfer','wallet','cheque','other')"
           )
  end
end
