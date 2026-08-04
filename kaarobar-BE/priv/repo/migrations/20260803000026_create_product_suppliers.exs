defmodule Kaarobar.Repo.Migrations.CreateProductSuppliers do
  use Ecto.Migration

  def change do
    create table(:product_suppliers, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :product_id, references(:products, type: :binary_id, on_delete: :delete_all),
        null: false

      add :supplier_id, references(:suppliers, type: :binary_id, on_delete: :delete_all),
        null: false

      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all),
        null: false

      add :owner_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :is_primary, :boolean, default: false, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:product_suppliers, [:product_id, :supplier_id])
    create index(:product_suppliers, [:business_id])
    create index(:product_suppliers, [:supplier_id])
    create index(:product_suppliers, [:owner_id])
  end
end
