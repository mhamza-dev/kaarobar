defmodule Kaarobar.Repo.Migrations.PerfTenantCompoundIndexes do
  use Ecto.Migration

  def change do
    create_if_not_exists index(:sales, [:owner_id, :business_id, :branch_id, :inserted_at],
             name: :sales_owner_business_branch_inserted_at_idx
           )

    create_if_not_exists index(:sales, [:business_id, :status, :inserted_at],
             name: :sales_business_status_inserted_at_idx
           )

    create_if_not_exists index(:journal_entries, [:business_id, :owner_id, :date],
             name: :journal_entries_business_owner_date_idx
           )

    create_if_not_exists index(:journal_entries, [:business_id, :branch_id, :date],
             name: :journal_entries_business_branch_date_idx
           )

    create_if_not_exists index(:ar_invoices, [:owner_id, :business_id, :status, :due_date],
             name: :ar_invoices_owner_business_status_due_idx
           )

    create_if_not_exists index(:ar_invoices, [:business_id, :owner_id, :customer_id],
             name: :ar_invoices_business_owner_customer_idx
           )

    create_if_not_exists index(:ap_bills, [:owner_id, :business_id, :status, :due_date],
             name: :ap_bills_owner_business_status_due_idx
           )

    create_if_not_exists index(:inventory_records, [:owner_id, :business_id, :branch_id],
             name: :inventory_records_owner_business_branch_idx
           )

    create_if_not_exists index(:products, [:business_id, :owner_id, :is_active],
             name: :products_business_owner_active_idx
           )

    create_if_not_exists index(:sale_returns, [:owner_id, :business_id, :branch_id, :status],
             name: :sale_returns_owner_business_branch_status_idx
           )
  end
end
