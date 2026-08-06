defmodule Kaarobar.Repo.Migrations.SalonResourceBooking do
  use Ecto.Migration

  def change do
    create table(:bookable_resources, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false

      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all),
        null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :nothing), null: false

      add :name, :string, null: false
      add :kind, :string, null: false
      add :capacity, :integer, null: false, default: 1
      add :is_active, :boolean, null: false, default: true
      add :notes, :string

      timestamps(type: :utc_datetime)
    end

    create index(:bookable_resources, [:owner_id, :business_id])
    create index(:bookable_resources, [:business_id, :branch_id, :kind])
    create index(:bookable_resources, [:branch_id, :is_active])

    create table(:product_resources, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :product_id, references(:products, type: :binary_id, on_delete: :delete_all), null: false

      add :bookable_resource_id,
          references(:bookable_resources, type: :binary_id, on_delete: :nilify_all)

      add :resource_kind, :string

      timestamps(type: :utc_datetime)
    end

    create index(:product_resources, [:product_id])
    create index(:product_resources, [:bookable_resource_id])
    create index(:product_resources, [:resource_kind])

    create table(:appointment_resources, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :appointment_id, references(:appointments, type: :binary_id, on_delete: :delete_all),
        null: false

      add :bookable_resource_id,
          references(:bookable_resources, type: :binary_id, on_delete: :nothing),
          null: false

      timestamps(type: :utc_datetime)
    end

    create index(:appointment_resources, [:appointment_id])
    create unique_index(:appointment_resources, [:appointment_id, :bookable_resource_id])
    create index(:appointment_resources, [:bookable_resource_id])

    alter table(:products) do
      add :buffer_before_minutes, :integer, null: false, default: 0
      add :buffer_after_minutes, :integer, null: false, default: 0
      add :deposit_amount, :decimal
      add :no_show_fee_amount, :decimal
    end

    create table(:service_packages, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false

      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all),
        null: false

      add :product_id, references(:products, type: :binary_id, on_delete: :nothing), null: false

      add :name, :string, null: false
      add :session_count, :integer, null: false
      add :price, :decimal, null: false
      add :is_active, :boolean, null: false, default: true

      timestamps(type: :utc_datetime)
    end

    create index(:service_packages, [:owner_id, :business_id])
    create index(:service_packages, [:business_id, :product_id])

    create table(:customer_package_purchases, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false

      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all),
        null: false

      add :customer_id, references(:customers, type: :binary_id, on_delete: :nothing), null: false

      add :package_id, references(:service_packages, type: :binary_id, on_delete: :nothing),
        null: false

      add :sale_id, references(:sales, type: :binary_id, on_delete: :nilify_all)

      add :remaining_sessions, :integer, null: false
      add :used_sessions, :integer, null: false, default: 0
      add :status, :string, null: false, default: "active"

      timestamps(type: :utc_datetime)
    end

    create index(:customer_package_purchases, [:owner_id, :business_id])
    create index(:customer_package_purchases, [:customer_id, :status])
    create index(:customer_package_purchases, [:package_id])

    alter table(:appointments) do
      add :buffer_before_minutes, :integer, null: false, default: 0
      add :buffer_after_minutes, :integer, null: false, default: 0
      add :deposit_amount, :decimal
      add :deposit_status, :string, null: false, default: "none"
      add :deposit_sale_id, references(:sales, type: :binary_id, on_delete: :nilify_all)
      add :package_purchase_id,
          references(:customer_package_purchases, type: :binary_id, on_delete: :nilify_all)

      add :package_session_index, :integer
    end

    create index(:appointments, [:deposit_status])
    create index(:appointments, [:package_purchase_id])
  end
end
