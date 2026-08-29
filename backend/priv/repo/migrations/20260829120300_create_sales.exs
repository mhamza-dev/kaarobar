defmodule Kaarobar.Repo.Migrations.CreateSales do
  use Ecto.Migration

  @moduledoc """
  The sale — the financial record a shop is judged on.

  Once written, a sale is never edited. It is voided or refunded, and both
  leave the original intact alongside the reversal. That is not fastidiousness:
  a sale that can be quietly edited after the fact is a sale an auditor cannot
  rely on, and a shop cannot prove anything with.

  ## Everything is snapshotted

  The product name, the unit price, the tax rate, the cost of goods — all
  copied onto the line at the moment of sale rather than joined at read time.
  A receipt reprinted in two years has to show what was actually charged, and
  the product may since have been renamed, repriced, retaxed or deleted.

  `cost_snapshot` is what makes margin reporting honest. Joining to today's
  cost would restate last year's profit every time a supplier changed a price.

  ## Tax lines are stored, not recomputed

  `sale_item_taxes` holds each component that was charged, with the rate that
  applied. When the rate changes next April, every historical invoice still
  shows what the customer actually paid — which is the only version a revenue
  authority is interested in.
  """

  def change do
    create table(:sales, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false
      add :register_id, references(:registers, type: :binary_id, on_delete: :nilify_all)
      add :shift_id, references(:shifts, type: :binary_id, on_delete: :nilify_all)
      add :order_id, references(:orders, type: :binary_id, on_delete: :nilify_all)
      add :customer_id, references(:customers, type: :binary_id, on_delete: :restrict)

      # Gapless within its series. What the customer quotes on the phone.
      add :number, :string, null: false
      add :status, :string, null: false, default: "completed"
      add :channel, :string, null: false, default: "pos"

      add :currency, :string, size: 3, null: false

      add :subtotal, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :discount_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      # A discount applied to the whole sale rather than to a line.
      add :order_discount, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      # Cash rounding, where the smallest coin is larger than the smallest unit.
      add :rounding, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :paid_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :change_due, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :refunded_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      # What it cost us, summed from the line snapshots. Stored so margin
      # reporting never depends on today's prices.
      add :cost_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :prices_include_tax, :boolean, null: false, default: false

      # Vertical requirements, validated against the registry at checkout.
      add :service_mode, :string
      add :served_by_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      add :cashier_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :cashier_label, :string

      add :notes, :text
      # Why a discount beyond the counter's limit was allowed, and who allowed it.
      add :discount_reason, :string
      add :discount_approved_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      add :voided_at, :utc_datetime_usec
      add :voided_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :void_reason, :string

      add :sold_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:sales, [:business_id, :number])
    create index(:sales, [:branch_id, :sold_at])
    create index(:sales, [:business_id, :sold_at])
    create index(:sales, [:shift_id])
    create index(:sales, [:customer_id])
    create index(:sales, [:cashier_id, :sold_at])
    create index(:sales, [:business_id, :status, :sold_at])
    create index(:sales, [:order_id])

    create constraint(:sales, :sales_status_check,
             check:
               "status IN ('completed','voided','partially_refunded','refunded')"
           )

    create constraint(:sales, :sales_channel_check,
             check: "channel IN ('pos','online','phone','wholesale')"
           )

    create constraint(:sales, :sales_totals_non_negative_check,
             check: "subtotal >= 0 AND tax_total >= 0 AND total >= 0"
           )

    create constraint(:sales, :sales_refunded_check,
             check: "refunded_total >= 0 AND refunded_total <= total"
           )

    create constraint(:sales, :sales_void_reason_check,
             check: "voided_at IS NULL OR void_reason IS NOT NULL"
           )

    # --------------------------------------------------------------- sale lines
    create table(:sale_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :sale_id, references(:sales, type: :binary_id, on_delete: :restrict), null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      add :product_id, references(:products, type: :binary_id, on_delete: :restrict)

      # Snapshots. A receipt reprinted in two years must read correctly.
      add :name_snapshot, :string, null: false
      add :sku_snapshot, :string
      add :unit_snapshot, :string

      add :quantity, :decimal, precision: 16, scale: 4, null: false
      add :refunded_quantity, :decimal, precision: 16, scale: 4, null: false, default: 0

      # The shelf price, before anything was taken off.
      add :list_price, :decimal, precision: 16, scale: 4, null: false
      add :unit_price, :decimal, precision: 16, scale: 4, null: false
      add :discount_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :modifier_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :net_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :line_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      # What this line cost us, at the moment it was sold.
      add :cost_snapshot, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :batch_id, references(:batches, type: :binary_id, on_delete: :nilify_all)
      add :serial_id, references(:serial_numbers, type: :binary_id, on_delete: :nilify_all)

      # Which promotions applied, so a receipt can name them and a report can
      # measure what each one cost.
      add :applied_rule_ids, {:array, :binary_id}, null: false, default: []

      add :seat_number, :integer
      add :position, :integer, null: false, default: 0
      add :note, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:sale_items, [:sale_id])
    create index(:sale_items, [:variant_id])
    create index(:sale_items, [:product_id])
    create index(:sale_items, [:batch_id])

    create constraint(:sale_items, :sale_items_quantity_check, check: "quantity > 0")

    create constraint(:sale_items, :sale_items_refunded_check,
             check: "refunded_quantity >= 0 AND refunded_quantity <= quantity"
           )

    create constraint(:sale_items, :sale_items_price_check, check: "unit_price >= 0")

    # ---------------------------------------------------------------- tax lines
    create table(:sale_item_taxes, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :sale_item_id, references(:sale_items, type: :binary_id, on_delete: :delete_all),
        null: false

      # Not a foreign key to `taxes`: the rate may be retired, and this row has
      # to keep meaning what it meant.
      add :tax_id, :binary_id
      add :name_snapshot, :string, null: false
      add :label_snapshot, :string
      add :rate_snapshot, :decimal, precision: 9, scale: 6, null: false
      add :is_compound, :boolean, null: false, default: false

      add :amount, :decimal, precision: 16, scale: 4, null: false
      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:sale_item_taxes, [:sale_item_id])
    create index(:sale_item_taxes, [:tax_id])

    # ----------------------------------------------------------- line modifiers
    create table(:sale_item_modifiers, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :sale_item_id, references(:sale_items, type: :binary_id, on_delete: :delete_all),
        null: false

      add :modifier_id, :binary_id
      add :name_snapshot, :string, null: false
      add :price_delta, :decimal, precision: 16, scale: 4, null: false, default: 0

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:sale_item_modifiers, [:sale_item_id])
  end
end
