defmodule Kaarobar.Repo.Migrations.MultiIndustryCatalog do
  use Ecto.Migration

  def change do
    create table(:product_categories, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :name, :string, null: false
      add :slug, :string, null: false
      add :sort_order, :integer, null: false, default: 0
      add :is_active, :boolean, null: false, default: true

      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all),
        null: false

      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:product_categories, [:business_id])
    create unique_index(:product_categories, [:business_id, :slug])

    alter table(:products) do
      add :barcode, :string
      add :brand, :string
      add :unit, :string, default: "pcs"
      add :description, :text
      add :product_kind, :string, null: false, default: "goods"
      add :track_inventory, :boolean, null: false, default: true
      add :duration_minutes, :integer
      add :attributes, :map, default: %{}

      add :category_id,
          references(:product_categories, type: :binary_id, on_delete: :nilify_all)
    end

    create unique_index(:products, [:business_id, :barcode],
             where: "barcode IS NOT NULL AND barcode <> ''"
           )

    create index(:products, [:category_id])
    create index(:products, [:product_kind])

    create table(:product_variants, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :name, :string, null: false
      add :sku, :string
      add :barcode, :string
      add :price_override, :decimal
      add :is_active, :boolean, null: false, default: true
      add :sort_order, :integer, null: false, default: 0

      add :product_id, references(:products, type: :binary_id, on_delete: :delete_all), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all),
        null: false

      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:product_variants, [:product_id])
    create unique_index(:product_variants, [:business_id, :barcode],
             where: "barcode IS NOT NULL AND barcode <> ''"
           )

    create table(:modifier_groups, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :name, :string, null: false
      add :min_select, :integer, null: false, default: 0
      add :max_select, :integer, null: false, default: 1
      add :required, :boolean, null: false, default: false
      add :is_active, :boolean, null: false, default: true

      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all),
        null: false

      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:modifier_groups, [:business_id])

    create table(:modifiers, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :name, :string, null: false
      add :price_delta, :decimal, null: false, default: 0
      add :is_active, :boolean, null: false, default: true
      add :sort_order, :integer, null: false, default: 0

      add :modifier_group_id,
          references(:modifier_groups, type: :binary_id, on_delete: :delete_all),
          null: false

      timestamps(type: :utc_datetime)
    end

    create index(:modifiers, [:modifier_group_id])

    create table(:product_modifier_groups, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :product_id, references(:products, type: :binary_id, on_delete: :delete_all), null: false

      add :modifier_group_id,
          references(:modifier_groups, type: :binary_id, on_delete: :delete_all),
          null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:product_modifier_groups, [:product_id, :modifier_group_id])

    create table(:product_batches, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :lot_number, :string, null: false
      add :expires_on, :date
      add :quantity_on_hand, :decimal, null: false, default: 0
      add :cost, :decimal, null: false, default: 0

      add :product_id, references(:products, type: :binary_id, on_delete: :delete_all), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all),
        null: false

      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:product_batches, [:product_id, :branch_id])
    create index(:product_batches, [:expires_on])
    create unique_index(:product_batches, [:branch_id, :product_id, :lot_number])

    create table(:product_images, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :storage_key, :string, null: false
      add :content_type, :string
      add :byte_size, :integer
      add :is_primary, :boolean, null: false, default: false
      add :sort_order, :integer, null: false, default: 0

      add :product_id, references(:products, type: :binary_id, on_delete: :delete_all), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all),
        null: false

      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:product_images, [:product_id])

    alter table(:sale_items) do
      add :product_variant_id,
          references(:product_variants, type: :binary_id, on_delete: :nilify_all)

      add :modifiers, :map, default: %{}
      add :notes, :string
    end

    create index(:sale_items, [:product_variant_id])
  end
end
