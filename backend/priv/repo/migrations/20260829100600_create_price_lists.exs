defmodule Kaarobar.Repo.Migrations.CreatePriceLists do
  use Ecto.Migration

  @moduledoc """
  Price lists: the same item at a different price for a different audience.

  The variant's own `price` is the shelf price and always exists. A price list
  overrides it for a reason the shop can name:

    * a **branch** in a more expensive part of town
    * a **customer group** — trade, wholesale, staff
    * a **channel** — online orders priced differently from the counter
    * a **season** — effective-dated, so next month's prices can be loaded now
      and take effect on their own

  `min_quantity` gives quantity breaks: 100 each, or 85 each from a dozen.
  Resolution takes the highest `min_quantity` the line qualifies for.

  Lists are ordered by `priority`, and the first match wins. Deliberately not
  cumulative: a trade customer buying at a branch on a promotion should get one
  explicable price, not three discounts multiplied together.
  """

  def change do
    create table(:price_lists, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      add :code, :string
      add :currency, :string, size: 3, null: false

      add :kind, :string, null: false, default: "custom"

      # Set when the list applies to one branch only.
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all)
      # Set when it applies to one sales channel: pos, online, phone, wholesale.
      add :channel, :string

      # Lower wins. Lets a branch list beat an organization-wide one.
      add :priority, :integer, null: false, default: 100

      add :starts_at, :utc_datetime_usec
      add :ends_at, :utc_datetime_usec

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:price_lists, [:business_id])
    create index(:price_lists, [:branch_id])

    create unique_index(:price_lists, [:business_id, :code],
             where: "code IS NOT NULL AND deleted_at IS NULL"
           )

    create constraint(:price_lists, :price_lists_kind_check,
             check: "kind IN ('base','branch','customer_group','channel','promotion','custom')"
           )

    create constraint(:price_lists, :price_lists_window_check,
             check: "ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at"
           )

    # ---------------------------------------------------------------- items
    create table(:price_list_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :price_list_id, references(:price_lists, type: :binary_id, on_delete: :delete_all),
        null: false

      add :variant_id, references(:product_variants, type: :binary_id, on_delete: :delete_all),
        null: false

      add :price, :decimal, precision: 16, scale: 4, null: false
      # Quantity breaks: this price applies from this quantity upward.
      add :min_quantity, :decimal, precision: 16, scale: 4, null: false, default: 1

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:price_list_items, [:price_list_id, :variant_id, :min_quantity])
    create index(:price_list_items, [:variant_id])

    create constraint(:price_list_items, :price_list_items_price_check, check: "price >= 0")

    create constraint(:price_list_items, :price_list_items_min_quantity_check,
             check: "min_quantity > 0"
           )
  end
end
