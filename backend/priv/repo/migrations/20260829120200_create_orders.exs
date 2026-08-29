defmodule Kaarobar.Repo.Migrations.CreateOrders do
  use Ecto.Migration

  @moduledoc """
  Open tickets: a sale in progress that has not been paid for yet.

  One model serving several shapes of the same idea — a restaurant table's
  running tab, a salon client's visit, a laundry job being built up at the
  counter, a retail sale parked while the customer fetches their wallet. All of
  them are "items chosen, money not yet taken", and all of them need to survive
  the cashier switching to serve someone else.

  ## An order is not a sale

  It moves no stock, takes no payment and has no invoice number. Billing it
  creates a `sale`, which does all three. Keeping them separate is what lets a
  ticket be edited freely — a restaurant order changes half a dozen times
  before it is paid — while a sale, once rung, is a financial record that only
  a void or a refund may alter.

  ## Reservation

  Items on an open ticket are reserved against stock, so the last unit cannot
  be promised to two tables at once. Reserved stock is physically present and
  not for sale; `stock_items.available` is what a till checks.

  The vertical-specific parts — which table, which kitchen station, whether it
  is dine-in — arrive with the vertical modules phase. `service_mode` and
  `served_by_user_id` are here because the catalog already requires them for
  food and salon sales.
  """

  def change do
    create table(:orders, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false
      add :register_id, references(:registers, type: :binary_id, on_delete: :nilify_all)
      add :customer_id, references(:customers, type: :binary_id, on_delete: :nilify_all)

      add :number, :string, null: false
      add :status, :string, null: false, default: "open"
      # Where it came from: the counter, the web, the phone.
      add :channel, :string, null: false, default: "pos"

      # A name a cashier can find it by — "the man in the blue shirt", table 4.
      add :label, :string

      # Required for food. Validated against the vertical registry.
      add :service_mode, :string
      # Required for salon and services: who performed the work.
      add :served_by_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      # Indicative only. The authoritative figures are computed at checkout,
      # because a promotion may have started or ended since the ticket opened.
      add :subtotal, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :discount_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :notes, :text

      add :opened_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :opened_at, :utc_datetime_usec, null: false
      add :billed_at, :utc_datetime_usec
      add :cancelled_at, :utc_datetime_usec
      add :cancel_reason, :string

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:orders, [:business_id, :number])
    create index(:orders, [:branch_id, :status])
    create index(:orders, [:customer_id])
    create index(:orders, [:register_id])

    create constraint(:orders, :orders_status_check,
             check: "status IN ('open','held','billed','cancelled')"
           )

    create constraint(:orders, :orders_channel_check,
             check: "channel IN ('pos','online','phone','wholesale')"
           )

    create constraint(:orders, :orders_service_mode_check,
             check: "service_mode IS NULL OR service_mode IN ('dine_in','takeaway','delivery')"
           )

    # -------------------------------------------------------------- order lines
    create table(:order_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :order_id, references(:orders, type: :binary_id, on_delete: :delete_all), null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      # Snapshotted so a ticket printed an hour ago still reads correctly even
      # if the product has since been renamed.
      add :name_snapshot, :string, null: false

      add :quantity, :decimal, precision: 16, scale: 4, null: false
      # How much of this line has already been paid for. A restaurant table
      # splitting the bill pays for part of a ticket at a time.
      add :billed_quantity, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :unit_price, :decimal, precision: 16, scale: 4, null: false
      add :line_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      # Which seat ordered it, for splitting a restaurant bill by cover.
      add :seat_number, :integer
      add :position, :integer, null: false, default: 0
      add :note, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:order_items, [:order_id])
    create index(:order_items, [:variant_id])

    create constraint(:order_items, :order_items_quantity_check, check: "quantity > 0")

    create constraint(:order_items, :order_items_billed_check,
             check: "billed_quantity >= 0 AND billed_quantity <= quantity"
           )

    # ---------------------------------------------------------- line modifiers
    create table(:order_item_modifiers, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :order_item_id,
          references(:order_items, type: :binary_id, on_delete: :delete_all),
          null: false

      add :modifier_id, references(:modifiers, type: :binary_id, on_delete: :restrict),
        null: false

      add :name_snapshot, :string, null: false
      add :price_delta, :decimal, precision: 16, scale: 4, null: false, default: 0

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:order_item_modifiers, [:order_item_id])
  end
end
