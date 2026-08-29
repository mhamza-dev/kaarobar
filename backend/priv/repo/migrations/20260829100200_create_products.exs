defmodule Kaarobar.Repo.Migrations.CreateProducts do
  use Ecto.Migration

  @moduledoc """
  The catalog. One table for a haircut, a burger, a pair of jeans and a drum of
  pesticide.

  What makes that possible is that `products` holds only what every sellable
  thing has — a name, a kind, a tax group, a unit — and the vertical-specific
  parts are nullable columns switched on by `Kaarobar.Verticals`:

    * `service_duration_minutes` — a salon's appointment book needs it, a
      grocer's has no meaning for it
    * `kitchen_station` — which screen a restaurant order prints to
    * `hazard_class`, `registration_number`, `requires_prescription` — the
      regulated verticals, where these appear on the invoice by law

  ## Stock lives on variants, not products

  `products` never carries a stock level. Even a product with no options has
  one default variant, and that variant is what stock, barcodes and sale lines
  reference. Without that, "does this product have variants?" becomes a
  branch in every stock query, and the shop that starts selling one t-shirt in
  three sizes has to migrate its history.

  ## The three tracking flags

  `tracks_stock`, `tracks_batch` and `tracks_serial` are independent because
  real goods combine them differently: rice tracks stock and nothing else, a
  pesticide tracks stock and batch, a phone tracks stock and serial, a haircut
  tracks none of them.
  """

  def change do
    create table(:products, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :category_id, references(:categories, type: :binary_id, on_delete: :nilify_all)
      add :brand_id, references(:brands, type: :binary_id, on_delete: :nilify_all)
      add :unit_id, references(:units, type: :binary_id, on_delete: :restrict)
      add :tax_group_id, references(:tax_groups, type: :binary_id, on_delete: :nilify_all)

      add :name, :string, null: false
      add :slug, :citext, null: false
      add :description, :text
      add :short_description, :string

      add :kind, :string, null: false, default: "item"

      add :tracks_stock, :boolean, null: false, default: true
      add :tracks_batch, :boolean, null: false, default: false
      add :tracks_serial, :boolean, null: false, default: false
      # Sold by weight on a scale rather than by the piece.
      add :is_weighted, :boolean, null: false, default: false

      # --- Vertical-specific, all nullable -------------------------------
      add :service_duration_minutes, :integer
      add :kitchen_station, :string
      add :hazard_class, :string
      add :registration_number, :string
      add :requires_prescription, :boolean, null: false, default: false
      # Rentals: how long one hire period lasts.
      add :rental_period_minutes, :integer
      # Memberships: how long the entitlement runs.
      add :membership_days, :integer

      add :attributes, :map, null: false, default: %{}
      add :image_url, :string
      add :images, {:array, :string}, null: false, default: []

      add :sort_order, :integer, null: false, default: 0
      add :is_active, :boolean, null: false, default: true
      add :is_featured, :boolean, null: false, default: false
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:products, [:business_id, :slug], where: "deleted_at IS NULL")
    create index(:products, [:business_id])
    create index(:products, [:business_id, :category_id])
    create index(:products, [:business_id, :kind])
    create index(:products, [:business_id, :is_active])
    create index(:products, [:brand_id])

    # Catalog search: a cashier typing three letters into the POS.
    execute """
            CREATE INDEX products_name_trgm_index
            ON products USING gin (name gin_trgm_ops)
            """,
            "DROP INDEX IF EXISTS products_name_trgm_index"

    create constraint(:products, :products_kind_check,
             check:
               "kind IN ('item','service','bundle','deal','rental','membership','gift_card','fee')"
           )

    # A service has no stock level to track, and pretending otherwise produces
    # low-stock alerts for haircuts.
    create constraint(:products, :products_stockable_kind_check,
             check: "NOT tracks_stock OR kind IN ('item','rental')"
           )

    create constraint(:products, :products_batch_requires_stock_check,
             check: "NOT tracks_batch OR tracks_stock"
           )

    create constraint(:products, :products_serial_requires_stock_check,
             check: "NOT tracks_serial OR tracks_stock"
           )

    create constraint(:products, :products_service_duration_check,
             check: "service_duration_minutes IS NULL OR service_duration_minutes > 0"
           )
  end
end
