defmodule Kaarobar.Repo.Migrations.CustomerKhataAndLowStockNotify do
  use Ecto.Migration

  def change do
    alter table(:customers) do
      add :khata_enabled, :boolean, default: false, null: false
    end

    alter table(:sales) do
      add :ar_invoice_id, references(:ar_invoices, type: :binary_id, on_delete: :nilify_all)
    end

    create index(:sales, [:ar_invoice_id])
    create index(:sales, [:customer_id])

    alter table(:ar_invoices) do
      add :sale_id, references(:sales, type: :binary_id, on_delete: :nilify_all)
    end

    create index(:ar_invoices, [:sale_id])

    alter table(:inventory_records) do
      add :low_stock_notified_at, :utc_datetime
    end
  end
end
