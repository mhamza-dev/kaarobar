defmodule Kaarobar.Repo.Migrations.CreateProductComponents do
  use Ecto.Migration

  @moduledoc """
  What a sellable thing is made of, or bundled from.

  Two arrangements, one table, distinguished by `kind`:

    * **`bundle`** — a meal deal, a shampoo-and-cut package. Selling the parent
      sells the children: each component's stock falls, and the parent has none
      of its own.
    * **`recipe`** — a burger consumes a bun and a patty; a hair colour consumes
      dye. The parent is a menu item the customer orders by name, and the
      components are ingredients the customer never sees.

  They share a table because the mechanics are identical — "selling one of this
  consumes this much of that" — and splitting them would mean the checkout path
  walks two trees instead of one. `kind` exists because they differ in the two
  places that matter: a bundle may reprice its components, and a recipe wastes
  a percentage of every ingredient it touches.

  `wastage_percent` is not an accounting nicety. A kitchen that trims 8% off
  every onion and does not record it shows a stock count that drifts further
  from reality every week, and eventually nobody trusts the number.
  """

  def change do
    create table(:product_components, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      # The variant being sold — the bundle, or the dish.
      add :parent_variant_id,
          references(:product_variants, type: :binary_id, on_delete: :delete_all),
          null: false

      # The variant consumed — the bundled item, or the ingredient. Restricted:
      # deleting an ingredient that a recipe still names would silently change
      # what the kitchen is costing.
      add :component_variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      add :kind, :string, null: false, default: "bundle"

      add :quantity, :decimal, precision: 16, scale: 4, null: false
      # The unit the quantity is expressed in — 150 grams of a mince stocked in
      # kilograms.
      add :unit_id, references(:units, type: :binary_id, on_delete: :restrict)

      # Recipes only: trim, spill, evaporation.
      add :wastage_percent, :decimal, precision: 7, scale: 4, null: false, default: 0

      # Bundles only. "included" charges the bundle price and nothing more;
      # "add_price" charges the component's own price on top.
      add :price_mode, :string, null: false, default: "included"
      add :price_override, :decimal, precision: 16, scale: 4

      # A bundle line the customer may swap or drop.
      add :is_optional, :boolean, null: false, default: false
      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:product_components, [:parent_variant_id, :component_variant_id, :kind])
    create index(:product_components, [:parent_variant_id])
    create index(:product_components, [:component_variant_id])
    create index(:product_components, [:business_id])

    create constraint(:product_components, :product_components_kind_check,
             check: "kind IN ('bundle','recipe')"
           )

    create constraint(:product_components, :product_components_quantity_check,
             check: "quantity > 0"
           )

    create constraint(:product_components, :product_components_wastage_check,
             check: "wastage_percent >= 0 AND wastage_percent < 100"
           )

    create constraint(:product_components, :product_components_price_mode_check,
             check: "price_mode IN ('included','add_price','override')"
           )

    create constraint(:product_components, :product_components_override_check,
             check: "price_mode <> 'override' OR price_override IS NOT NULL"
           )

    # A thing cannot be made of itself. Deeper cycles are caught in the
    # application, where a readable error can be returned.
    create constraint(:product_components, :product_components_no_self_reference_check,
             check: "parent_variant_id <> component_variant_id"
           )
  end
end
