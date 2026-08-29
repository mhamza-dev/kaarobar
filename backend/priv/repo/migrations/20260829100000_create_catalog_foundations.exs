defmodule Kaarobar.Repo.Migrations.CreateCatalogFoundations do
  use Ecto.Migration

  @moduledoc """
  Units, categories and brands — the scaffolding a catalog hangs from.

  ## Units

  A grocer sells rice by the kilo and eggs by the dozen; a pesticide dealer
  sells by the litre and orders by the drum. Both need the same arithmetic, so
  units carry a `dimension` and a `factor_to_base` (grams for weight,
  millilitres for volume, millimetres for length, one for count). Converting
  within a dimension is then a ratio, with no lookup table.

  Cross-dimension packs — "one box is twelve pieces" — cannot be derived and so
  live in `unit_conversions`.

  `precision` is how many decimals the unit is *sold* in. Eggs are whole; rice
  is not. Storing it here means the POS can round a weighed quantity correctly
  without hard-coding a rule per product.

  ## Categories

  Nested through a materialised `path` rather than a recursive query. A
  category tree is read on every catalog screen and written almost never, so
  the cost belongs on the write.
  """

  def change do
    # ------------------------------------------------------------------ units
    create table(:units, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :code, :string, null: false
      add :name, :string, null: false
      add :dimension, :string, null: false

      # Relative to the dimension's base: grams, millilitres, millimetres, or 1
      # for a plain count.
      add :factor_to_base, :decimal, precision: 20, scale: 8, null: false, default: 1

      # Decimals this unit is sold in. 0 for pieces, 3 for kilograms.
      add :precision, :integer, null: false, default: 0

      add :is_base, :boolean, null: false, default: false
      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:units, [:business_id, :code], where: "deleted_at IS NULL")
    create index(:units, [:business_id])

    create constraint(:units, :units_dimension_check,
             check: "dimension IN ('count','weight','volume','length','time')"
           )

    create constraint(:units, :units_factor_positive_check, check: "factor_to_base > 0")

    create constraint(:units, :units_precision_range_check,
             check: "precision >= 0 AND precision <= 6"
           )

    # ------------------------------------------------------- unit conversions
    create table(:unit_conversions, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :from_unit_id, references(:units, type: :binary_id, on_delete: :delete_all),
        null: false

      add :to_unit_id, references(:units, type: :binary_id, on_delete: :delete_all), null: false

      # One `from` equals this many `to`. One box = 12 pieces.
      add :factor, :decimal, precision: 20, scale: 8, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:unit_conversions, [:from_unit_id, :to_unit_id])
    create index(:unit_conversions, [:business_id])

    create constraint(:unit_conversions, :unit_conversions_factor_positive_check,
             check: "factor > 0"
           )

    create constraint(:unit_conversions, :unit_conversions_distinct_check,
             check: "from_unit_id <> to_unit_id"
           )

    # ------------------------------------------------------------- categories
    create table(:categories, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :parent_id, references(:categories, type: :binary_id, on_delete: :restrict)

      add :name, :string, null: false
      add :slug, :citext, null: false
      add :description, :text
      add :image_url, :string

      # "/<root id>/<child id>/" — a LIKE prefix match returns a whole subtree
      # in one indexed scan.
      add :path, :string, null: false, default: "/"
      add :depth, :integer, null: false, default: 0
      add :sort_order, :integer, null: false, default: 0

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:categories, [:business_id, :slug], where: "deleted_at IS NULL")
    create index(:categories, [:business_id])
    create index(:categories, [:parent_id])
    create index(:categories, [:business_id, :path])

    create constraint(:categories, :categories_depth_check,
             check: "depth >= 0 AND depth <= 5"
           )

    create constraint(:categories, :categories_not_own_parent_check, check: "id <> parent_id")

    # ----------------------------------------------------------------- brands
    create table(:brands, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      add :slug, :citext, null: false
      add :logo_url, :string

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:brands, [:business_id, :slug], where: "deleted_at IS NULL")
    create index(:brands, [:business_id])
  end
end
