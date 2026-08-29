defmodule Kaarobar.Repo.Migrations.CreatePurchaseOrders do
  use Ecto.Migration

  @moduledoc """
  Purchase orders, and the goods receipts that book them in.

  ## Why receipts are separate from orders

  Because deliveries are. A supplier sends eighty of the hundred you ordered,
  the rest a fortnight later, and two arrive broken. Recording that as an edit
  to the order loses the history of what actually turned up and when — which is
  the only evidence a shop has when a supplier disputes an invoice.

  So a purchase order records intent, a goods receipt records reality, and
  `received_quantity` on the order line is the sum of what the receipts say.
  A partially-received order stays open; nothing is silently closed.

  ## Receiving is the only thing that touches stock

  The order itself moves nothing. It increments `incoming` on the stock item so
  the shop can see what is on its way, and that is all. Stock moves when goods
  arrive, priced at what was actually paid rather than what was quoted.
  """

  def change do
    create table(:purchase_orders, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      # Where the goods are going, which is not always where the order is raised.
      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :supplier_id, references(:suppliers, type: :binary_id, on_delete: :restrict),
        null: false

      add :number, :string, null: false
      add :status, :string, null: false, default: "draft"

      add :ordered_on, :date
      add :expected_on, :date

      add :currency, :string, size: 3, null: false
      # Locked at approval, so a later rate change does not silently restate
      # what the order cost.
      add :exchange_rate, :decimal, precision: 16, scale: 8, null: false, default: 1

      add :subtotal, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :discount_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :shipping_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :reference, :string
      add :notes, :text

      add :created_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :approved_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :approved_at, :utc_datetime_usec
      add :cancelled_at, :utc_datetime_usec
      add :closed_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:purchase_orders, [:business_id, :number])
    create index(:purchase_orders, [:business_id, :status])
    create index(:purchase_orders, [:supplier_id])
    create index(:purchase_orders, [:branch_id])

    create constraint(:purchase_orders, :purchase_orders_status_check,
             check:
               "status IN ('draft','awaiting_approval','approved','sent'," <>
                 "'partially_received','received','cancelled','closed')"
           )

    create constraint(:purchase_orders, :purchase_orders_dates_check,
             check: "expected_on IS NULL OR ordered_on IS NULL OR expected_on >= ordered_on"
           )

    create constraint(:purchase_orders, :purchase_orders_rate_check,
             check: "exchange_rate > 0"
           )

    # ------------------------------------------------------------- order lines
    create table(:purchase_order_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :purchase_order_id,
          references(:purchase_orders, type: :binary_id, on_delete: :delete_all),
          null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      # What the product was called when the order was raised. A supplier
      # querying an order from last year should see what was on the paper.
      add :description, :string
      add :supplier_sku, :string

      add :ordered_quantity, :decimal, precision: 16, scale: 4, null: false
      # The sum of the receipts against this line, maintained as they arrive.
      add :received_quantity, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :cancelled_quantity, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :unit_id, references(:units, type: :binary_id, on_delete: :restrict)
      add :unit_cost, :decimal, precision: 16, scale: 4, null: false
      add :discount_percent, :decimal, precision: 7, scale: 4, null: false, default: 0
      add :tax_group_id, references(:tax_groups, type: :binary_id, on_delete: :nilify_all)
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :line_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :position, :integer, null: false, default: 0
      add :note, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:purchase_order_items, [:purchase_order_id])
    create index(:purchase_order_items, [:variant_id])

    create constraint(:purchase_order_items, :purchase_order_items_quantity_check,
             check: "ordered_quantity > 0"
           )

    create constraint(:purchase_order_items, :purchase_order_items_received_check,
             check: "received_quantity >= 0"
           )

    # Receiving more than was ordered is a delivery error worth catching, not
    # something to absorb silently into stock.
    create constraint(:purchase_order_items, :purchase_order_items_not_over_received_check,
             check: "received_quantity <= ordered_quantity"
           )

    create constraint(:purchase_order_items, :purchase_order_items_cost_check,
             check: "unit_cost >= 0"
           )

    create constraint(:purchase_order_items, :purchase_order_items_discount_check,
             check: "discount_percent >= 0 AND discount_percent <= 100"
           )

    # --------------------------------------------------------- goods receipts
    create table(:goods_receipts, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      # Nullable: goods do turn up without an order behind them.
      add :purchase_order_id,
          references(:purchase_orders, type: :binary_id, on_delete: :restrict)

      add :supplier_id, references(:suppliers, type: :binary_id, on_delete: :restrict),
        null: false

      add :number, :string, null: false
      add :status, :string, null: false, default: "draft"

      add :received_on, :date, null: false
      # The supplier's own delivery-note number, which is what a dispute cites.
      add :supplier_reference, :string

      add :subtotal, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :shipping_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :notes, :text

      add :received_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :posted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:goods_receipts, [:business_id, :number])
    create index(:goods_receipts, [:purchase_order_id])
    create index(:goods_receipts, [:supplier_id])
    create index(:goods_receipts, [:business_id, :received_on])

    create constraint(:goods_receipts, :goods_receipts_status_check,
             check: "status IN ('draft','posted','cancelled')"
           )

    # ----------------------------------------------------- goods receipt lines
    create table(:goods_receipt_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :goods_receipt_id,
          references(:goods_receipts, type: :binary_id, on_delete: :delete_all),
          null: false

      add :purchase_order_item_id,
          references(:purchase_order_items, type: :binary_id, on_delete: :nilify_all)

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      add :quantity, :decimal, precision: 16, scale: 4, null: false
      # Arrived broken. Booked in and immediately written off, so the count and
      # the invoice both reflect what happened.
      add :rejected_quantity, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :unit_cost, :decimal, precision: 16, scale: 4, null: false
      add :line_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      # Created on receipt for a batch-tracked product.
      add :batch_id, references(:batches, type: :binary_id, on_delete: :nilify_all)
      add :batch_number, :string
      add :manufactured_on, :date
      add :expires_on, :date

      add :serials, {:array, :string}, null: false, default: []

      add :position, :integer, null: false, default: 0
      add :note, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:goods_receipt_items, [:goods_receipt_id])
    create index(:goods_receipt_items, [:purchase_order_item_id])
    create index(:goods_receipt_items, [:variant_id])

    create constraint(:goods_receipt_items, :goods_receipt_items_quantity_check,
             check: "quantity > 0"
           )

    create constraint(:goods_receipt_items, :goods_receipt_items_rejected_check,
             check: "rejected_quantity >= 0 AND rejected_quantity <= quantity"
           )

    create constraint(:goods_receipt_items, :goods_receipt_items_cost_check,
             check: "unit_cost >= 0"
           )
  end
end
