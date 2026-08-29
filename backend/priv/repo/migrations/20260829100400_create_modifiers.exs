defmodule Kaarobar.Repo.Migrations.CreateModifiers do
  use Ecto.Migration

  @moduledoc """
  Modifiers: the choices made at the counter rather than in the catalog.

  "No onions", "extra shot", "large", "with beard trim". They differ from
  variants in a way that matters:

    * A **variant** is a separate thing with its own stock and barcode. A large
      t-shirt is not a medium one.
    * A **modifier** is a choice made on the way past the till. Extra cheese
      does not have its own shelf, and a burger with and without it is the same
      burger for stock purposes.

  Modelling "extra cheese" as a variant would multiply a menu of twenty items
  into hundreds of near-identical rows, each needing its own stock level.

  Groups are reusable across products: one "Spice level" group attaches to every
  curry on the menu, and changing it changes all of them.
  """

  def change do
    create table(:modifier_groups, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      add :description, :string

      # "single" is a radio group, "multiple" a checkbox list.
      add :selection, :string, null: false, default: "single"
      add :min_select, :integer, null: false, default: 0
      add :max_select, :integer

      add :position, :integer, null: false, default: 0
      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:modifier_groups, [:business_id])
    create unique_index(:modifier_groups, [:business_id, :name], where: "deleted_at IS NULL")

    create constraint(:modifier_groups, :modifier_groups_selection_check,
             check: "selection IN ('single','multiple')"
           )

    create constraint(:modifier_groups, :modifier_groups_min_check, check: "min_select >= 0")

    create constraint(:modifier_groups, :modifier_groups_max_check,
             check: "max_select IS NULL OR max_select >= min_select"
           )

    # A single-select group cannot ask for two answers.
    create constraint(:modifier_groups, :modifier_groups_single_max_check,
             check: "selection <> 'single' OR max_select IS NULL OR max_select = 1"
           )

    # -------------------------------------------------------------- modifiers
    create table(:modifiers, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :modifier_group_id,
          references(:modifier_groups, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false

      # Added to the line price. Negative is legitimate — "no cheese, 20 off".
      add :price_delta, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :cost_delta, :decimal, precision: 16, scale: 4, null: false, default: 0

      # When set, choosing this modifier consumes stock of a real variant, so a
      # kitchen that adds an egg to every second order still runs its egg count
      # down.
      add :consumes_variant_id,
          references(:product_variants, type: :binary_id, on_delete: :nilify_all)

      add :consumes_quantity, :decimal, precision: 16, scale: 4

      add :is_default, :boolean, null: false, default: false
      add :position, :integer, null: false, default: 0
      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:modifiers, [:modifier_group_id])
    create index(:modifiers, [:business_id])

    create unique_index(:modifiers, [:modifier_group_id, :name], where: "deleted_at IS NULL")

    create constraint(:modifiers, :modifiers_consumption_check,
             check:
               "(consumes_variant_id IS NULL AND consumes_quantity IS NULL) OR " <>
                 "(consumes_variant_id IS NOT NULL AND consumes_quantity > 0)"
           )

    # ----------------------------------------------------- product attachment
    create table(:product_modifier_groups, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :product_id, references(:products, type: :binary_id, on_delete: :delete_all),
        null: false

      add :modifier_group_id,
          references(:modifier_groups, type: :binary_id, on_delete: :delete_all),
          null: false

      # A group may be optional on one product and required on another — sauce
      # is a choice on a burger and mandatory on a plate of fries.
      add :is_required, :boolean, null: false, default: false
      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create unique_index(:product_modifier_groups, [:product_id, :modifier_group_id])
    create index(:product_modifier_groups, [:modifier_group_id])
  end
end
