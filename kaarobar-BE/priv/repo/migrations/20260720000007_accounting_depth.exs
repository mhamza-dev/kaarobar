defmodule Kaarobar.Repo.Migrations.AccountingDepth do
  use Ecto.Migration

  def up do
    create table(:ar_invoices, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :nilify_all)
      add :customer_id, references(:customers, type: :binary_id, on_delete: :nothing), null: false
      add :invoice_number, :string, null: false
      add :invoice_date, :date, null: false
      add :due_date, :date
      add :subtotal, :decimal, null: false, default: 0
      add :tax_amount, :decimal, null: false, default: 0
      add :total_amount, :decimal, null: false, default: 0
      add :balance_due, :decimal, null: false, default: 0
      add :status, :string, null: false, default: "open"
      add :notes, :string
      add :journal_entry_id, references(:journal_entries, type: :binary_id, on_delete: :nothing)

      timestamps(type: :utc_datetime)
    end

    create unique_index(:ar_invoices, [:business_id, :invoice_number])
    create index(:ar_invoices, [:business_id, :status, :due_date])
    create index(:ar_invoices, [:customer_id])

    create table(:ar_payments, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :ar_invoice_id, references(:ar_invoices, type: :binary_id, on_delete: :nothing), null: false
      add :amount, :decimal, null: false
      add :method, :string, null: false, default: "cash"
      add :paid_at, :utc_datetime, null: false
      add :reference, :string
      add :journal_entry_id, references(:journal_entries, type: :binary_id, on_delete: :nothing)

      timestamps(type: :utc_datetime)
    end

    create index(:ar_payments, [:ar_invoice_id])
    create index(:ar_payments, [:business_id])

    create table(:ap_bills, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :nilify_all)
      add :supplier_id, references(:suppliers, type: :binary_id, on_delete: :nothing), null: false
      add :bill_number, :string, null: false
      add :bill_date, :date, null: false
      add :due_date, :date
      add :total_amount, :decimal, null: false, default: 0
      add :balance_due, :decimal, null: false, default: 0
      add :status, :string, null: false, default: "open"
      add :notes, :string
      add :source_type, :string
      add :source_id, :binary_id
      add :journal_entry_id, references(:journal_entries, type: :binary_id, on_delete: :nothing)

      timestamps(type: :utc_datetime)
    end

    create unique_index(:ap_bills, [:business_id, :bill_number])
    create index(:ap_bills, [:business_id, :status, :due_date])
    create index(:ap_bills, [:supplier_id])
    create unique_index(:ap_bills, [:source_type, :source_id],
      where: "source_id IS NOT NULL",
      name: :ap_bills_source_unique_index
    )

    create table(:ap_payments, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :ap_bill_id, references(:ap_bills, type: :binary_id, on_delete: :nothing), null: false
      add :amount, :decimal, null: false
      add :method, :string, null: false, default: "cash"
      add :paid_at, :utc_datetime, null: false
      add :reference, :string
      add :journal_entry_id, references(:journal_entries, type: :binary_id, on_delete: :nothing)

      timestamps(type: :utc_datetime)
    end

    create index(:ap_payments, [:ap_bill_id])
    create index(:ap_payments, [:business_id])

    # ACC-FR-010: posted (locked) journals are immutable
    execute("""
    CREATE OR REPLACE FUNCTION kaarobar_forbid_locked_journal_mutation()
    RETURNS trigger AS $$
    BEGIN
      IF OLD.is_locked THEN
        RAISE EXCEPTION 'posted journals are immutable';
      END IF;
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)

    execute("""
    DROP TRIGGER IF EXISTS journal_entries_immutable ON journal_entries;
    """)

    execute("""
    CREATE TRIGGER journal_entries_immutable
    BEFORE UPDATE OR DELETE ON journal_entries
    FOR EACH ROW
    EXECUTE PROCEDURE kaarobar_forbid_locked_journal_mutation();
    """)

    execute("""
    CREATE OR REPLACE FUNCTION kaarobar_forbid_locked_journal_line_mutation()
    RETURNS trigger AS $$
    DECLARE
      locked boolean;
      entry_id uuid;
    BEGIN
      entry_id := COALESCE(OLD.journal_entry_id, NEW.journal_entry_id);
      SELECT is_locked INTO locked FROM journal_entries WHERE id = entry_id;
      IF locked THEN
        RAISE EXCEPTION 'posted journal lines are immutable';
      END IF;
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)

    execute("""
    DROP TRIGGER IF EXISTS journal_lines_immutable ON journal_lines;
    """)

    execute("""
    CREATE TRIGGER journal_lines_immutable
    BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
    FOR EACH ROW
    EXECUTE PROCEDURE kaarobar_forbid_locked_journal_line_mutation();
    """)

    # Lock any existing journal entries from earlier releases
    execute("UPDATE journal_entries SET is_locked = true WHERE is_locked = false;")
  end

  def down do
    execute("DROP TRIGGER IF EXISTS journal_lines_immutable ON journal_lines;")
    execute("DROP FUNCTION IF EXISTS kaarobar_forbid_locked_journal_line_mutation();")
    execute("DROP TRIGGER IF EXISTS journal_entries_immutable ON journal_entries;")
    execute("DROP FUNCTION IF EXISTS kaarobar_forbid_locked_journal_mutation();")

    drop table(:ap_payments)
    drop table(:ap_bills)
    drop table(:ar_payments)
    drop table(:ar_invoices)
  end
end
