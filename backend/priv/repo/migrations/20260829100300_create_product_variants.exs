defmodule Kaarobar.Repo.Migrations.CreateProductVariants do
  use Ecto.Migration

  @moduledoc """
  Variants: the thing that is actually sold, counted and scanned.

  A clothing shop needs "Blue / L" to be a distinct sellable item with its own
  barcode, price and stock level. A grocer selling one kind of rice needs
  exactly one of these and should never have to think about it.

  Both work because **every product has at least one variant**, created
  automatically when the product is. Downstream — stock, sale lines, barcodes,
  price lists — only ever references variants, so there is no "does this have
  options?" branch anywhere in the system.

  ## Options

  `option_types` are the axes (Size, Colour); `option_values` are the points on
  them (S, M, L). A variant is the intersection, recorded in
  `variant_option_values`. Modelling it this way rather than as three fixed
  `option1/2/3` columns means a shop that sizes shoes by width as well as
  length is a data change, not a migration.

  ## Barcodes

  `barcode` is denormalised onto the variant for the scan path, which is the
  hottest read in the product: one indexed lookup, no join, while a customer
  waits. `product_barcodes` holds the rest — the same item from two suppliers
  with two codes, or a weighted label printed by a scale.
  """

  def change do
    # ----------------------------------------------------------- option types
    create table(:option_types, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      # "select" renders a dropdown, "swatch" renders colour chips.
      add :presentation, :string, null: false, default: "select"
      add :position, :integer, null: false, default: 0

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:option_types, [:business_id, :name], where: "deleted_at IS NULL")
    create index(:option_types, [:business_id])

    create constraint(:option_types, :option_types_presentation_check,
             check: "presentation IN ('select','swatch','button')"
           )

    # ---------------------------------------------------------- option values
    create table(:option_values, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :option_type_id, references(:option_types, type: :binary_id, on_delete: :delete_all),
        null: false

      add :value, :string, null: false
      # For colour swatches.
      add :hex_color, :string
      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:option_values, [:option_type_id, :value])

    # --------------------------------------------------------------- variants
    create table(:product_variants, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :product_id, references(:products, type: :binary_id, on_delete: :delete_all),
        null: false

      add :sku, :string
      # Derived from the options: "Blue / L". Null on a default variant, where
      # the product's own name is the whole story.
      add :name, :string

      add :barcode, :string

      add :price, :decimal, precision: 16, scale: 4, null: false
      add :cost, :decimal, precision: 16, scale: 4
      # For showing a strike-through "was" price.
      add :compare_at_price, :decimal, precision: 16, scale: 4

      add :weight_grams, :decimal, precision: 16, scale: 4
      add :image_url, :string

      # Exactly one per product: what the POS adds when nobody picks an option.
      add :is_default, :boolean, null: false, default: false
      add :position, :integer, null: false, default: 0

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:product_variants, [:product_id])
    create index(:product_variants, [:business_id])

    create unique_index(:product_variants, [:business_id, :sku],
             where: "sku IS NOT NULL AND deleted_at IS NULL"
           )

    # The scan path.
    create unique_index(:product_variants, [:business_id, :barcode],
             where: "barcode IS NOT NULL AND deleted_at IS NULL"
           )

    create unique_index(:product_variants, [:product_id],
             where: "is_default AND deleted_at IS NULL",
             name: :product_variants_single_default_index
           )

    create constraint(:product_variants, :product_variants_price_non_negative_check,
             check: "price >= 0"
           )

    create constraint(:product_variants, :product_variants_cost_non_negative_check,
             check: "cost IS NULL OR cost >= 0"
           )

    # --------------------------------------------------- variant × option value
    create table(:variant_option_values, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :variant_id, references(:product_variants, type: :binary_id, on_delete: :delete_all),
        null: false

      add :option_value_id,
          references(:option_values, type: :binary_id, on_delete: :restrict),
          null: false

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create unique_index(:variant_option_values, [:variant_id, :option_value_id])
    create index(:variant_option_values, [:option_value_id])

    # --------------------------------------------------------------- barcodes
    create table(:product_barcodes, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :variant_id, references(:product_variants, type: :binary_id, on_delete: :delete_all),
        null: false

      add :barcode, :string, null: false
      add :kind, :string, null: false, default: "ean13"
      # A scale prints a label encoding the weight or the price; the POS has to
      # know which digits to read back out.
      add :embedded_value, :string

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create unique_index(:product_barcodes, [:business_id, :barcode])
    create index(:product_barcodes, [:variant_id])

    create constraint(:product_barcodes, :product_barcodes_kind_check,
             check: "kind IN ('ean13','ean8','upca','upce','code128','code39','qr','internal')"
           )

    create constraint(:product_barcodes, :product_barcodes_embedded_value_check,
             check: "embedded_value IS NULL OR embedded_value IN ('weight','price','quantity')"
           )
  end
end
