defmodule Kaarobar.Repo.Migrations.CreateStock do
  use Ecto.Migration

  @moduledoc """
  The stock ledger, and the projections read from it.

  ## stock_moves is the truth

  Every change to a stock level is a row here: a purchase, a sale, a transfer,
  a count correction, a spillage. The table is append-only — a trigger refuses
  UPDATE — because the question an owner actually asks is not how much do I
  have, but how did it get to that, and who did it.

  `balance_after` snapshots the running total on each row. It is redundant with
  summing the column, and that is exactly the point: the ledger verifies itself
  line by line, so a discrepancy is visible at the row where it began rather
  than as a total that is simply wrong. Keeping it correct is why every write
  takes a row lock on the `stock_items` row first.

  ## stock_items is a projection

  `on_hand` is maintained inside the same transaction as the move that changed
  it, and never written independently. Anything that sets it directly is a bug:
  the ledger and the projection would disagree, and only one of them can be
  shown to an auditor.

  `reserved` holds stock promised but not yet gone — an open restaurant ticket,
  an unpaid online order. Available is `on_hand - reserved`, which is the
  number a cashier should actually be stopped by.

  ## Batches and serials

  A batch is a received lot with an expiry: recalls happen by lot number, and
  expired stock is illegal to sell in the regulated verticals. A serial is one
  physical unit tracked individually — a phone, a machine.
  """

  def change do
    # ------------------------------------------------------------- stock items
    create table(:stock_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      add :on_hand, :decimal, precision: 16, scale: 4, null: false, default: 0
      # Promised but not yet gone: an open ticket, an unpaid online order.
      add :reserved, :decimal, precision: 16, scale: 4, null: false, default: 0
      # On a purchase order that has been sent but not yet received.
      add :incoming, :decimal, precision: 16, scale: 4, null: false, default: 0

      # Maintained by the costing engine. Meaningless under FIFO, where the
      # cost lives in the layers instead.
      add :average_cost, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :reorder_point, :decimal, precision: 16, scale: 4
      add :reorder_quantity, :decimal, precision: 16, scale: 4
      add :max_stock, :decimal, precision: 16, scale: 4

      add :bin_location, :string

      add :last_counted_at, :utc_datetime_usec
      add :last_movement_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    # One row per variant per branch. The whole locking strategy rests on this
    # being unique.
    create unique_index(:stock_items, [:branch_id, :variant_id])
    create index(:stock_items, [:business_id])
    create index(:stock_items, [:variant_id])

    # The low-stock query, which runs on a schedule and on every dashboard.
    create index(:stock_items, [:business_id, :reorder_point],
             where: "reorder_point IS NOT NULL"
           )

    create constraint(:stock_items, :stock_items_reserved_non_negative_check,
             check: "reserved >= 0"
           )

    create constraint(:stock_items, :stock_items_incoming_non_negative_check,
             check: "incoming >= 0"
           )

    # ----------------------------------------------------------------- batches
    create table(:batches, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      add :batch_number, :string, null: false
      add :manufactured_on, :date
      add :expires_on, :date

      add :supplier_id, :binary_id

      add :received_quantity, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :remaining_quantity, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :unit_cost, :decimal, precision: 16, scale: 4

      add :status, :string, null: false, default: "active"
      add :note, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:batches, [:business_id, :variant_id, :batch_number])
    create index(:batches, [:variant_id])
    # Drives the near-expiry sweep and first-expiry-first-out picking.
    create index(:batches, [:business_id, :expires_on], where: "expires_on IS NOT NULL")

    create constraint(:batches, :batches_status_check,
             check: "status IN ('active','depleted','expired','quarantined','recalled')"
           )

    create constraint(:batches, :batches_remaining_non_negative_check,
             check: "remaining_quantity >= 0"
           )

    create constraint(:batches, :batches_dates_check,
             check:
               "expires_on IS NULL OR manufactured_on IS NULL OR expires_on >= manufactured_on"
           )

    # ---------------------------------------------------------- serial numbers
    create table(:serial_numbers, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict)
      add :batch_id, references(:batches, type: :binary_id, on_delete: :nilify_all)

      add :serial, :string, null: false
      add :status, :string, null: false, default: "in_stock"

      add :received_at, :utc_datetime_usec
      add :sold_at, :utc_datetime_usec
      # Which sale it left on, for a warranty lookup years later.
      add :sale_reference_id, :binary_id

      add :note, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:serial_numbers, [:business_id, :serial])
    create index(:serial_numbers, [:variant_id, :status])
    create index(:serial_numbers, [:branch_id])

    create constraint(:serial_numbers, :serial_numbers_status_check,
             check: "status IN ('in_stock','reserved','sold','returned','scrapped','in_transit')"
           )

    # ------------------------------------------------------------ stock moves
    create table(:stock_moves, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      add :kind, :string, null: false

      # Signed: negative leaves, positive arrives. One column rather than a
      # direction flag, so summing the ledger is the balance.
      add :quantity, :decimal, precision: 16, scale: 4, null: false
      add :unit_cost, :decimal, precision: 16, scale: 4
      add :total_cost, :decimal, precision: 16, scale: 4

      # The running total after this row. Redundant on purpose: it makes the
      # ledger self-verifying, so a discrepancy shows at the row it began.
      add :balance_after, :decimal, precision: 16, scale: 4, null: false

      add :batch_id, references(:batches, type: :binary_id, on_delete: :nilify_all)
      add :serial_id, references(:serial_numbers, type: :binary_id, on_delete: :nilify_all)

      # What caused it — a sale, a receipt, a transfer. Deliberately not a
      # foreign key: one column cannot reference nine tables, and a move has to
      # outlive whatever it describes.
      add :reference_type, :string
      add :reference_id, :binary_id

      add :reason, :string
      add :note, :text

      add :actor_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :actor_label, :string

      # When it happened in the shop, which is not always when it was recorded.
      add :occurred_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    # The ledger for one line of stock, in order — the most common read.
    create index(:stock_moves, [:branch_id, :variant_id, :occurred_at])
    create index(:stock_moves, [:business_id, :occurred_at])
    create index(:stock_moves, [:reference_type, :reference_id])
    create index(:stock_moves, [:batch_id])
    create index(:stock_moves, [:variant_id])
    create index(:stock_moves, [:business_id, :kind, :occurred_at])

    create constraint(:stock_moves, :stock_moves_kind_check,
             check:
               "kind IN ('opening','purchase','purchase_return','sale','sale_return'," <>
                 "'adjustment','transfer_out','transfer_in','wastage','production_in'," <>
                 "'production_out','count')"
           )

    # A move of nothing is not a move; it is a row nobody can explain.
    create constraint(:stock_moves, :stock_moves_quantity_non_zero_check, check: "quantity <> 0")

    execute """
            CREATE OR REPLACE FUNCTION stock_moves_reject_change()
            RETURNS trigger AS $$
            BEGIN
              RAISE EXCEPTION 'stock_moves is append-only: correct stock with a new move';
            END;
            $$ LANGUAGE plpgsql;
            """,
            "DROP FUNCTION IF EXISTS stock_moves_reject_change()"

    execute """
            CREATE TRIGGER stock_moves_no_update
            BEFORE UPDATE ON stock_moves
            FOR EACH ROW EXECUTE FUNCTION stock_moves_reject_change();
            """,
            "DROP TRIGGER IF EXISTS stock_moves_no_update ON stock_moves"

    # ------------------------------------------------------------ cost layers
    create table(:cost_layers, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      add :batch_id, references(:batches, type: :binary_id, on_delete: :nilify_all)

      add :quantity, :decimal, precision: 16, scale: 4, null: false
      add :remaining_quantity, :decimal, precision: 16, scale: 4, null: false
      add :unit_cost, :decimal, precision: 16, scale: 4, null: false

      add :source_move_id, :binary_id
      add :received_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec)
    end

    # FIFO consumption walks this index: oldest layer with stock left, first.
    create index(:cost_layers, [:branch_id, :variant_id, :received_at],
             where: "remaining_quantity > 0"
           )

    create index(:cost_layers, [:business_id])

    create constraint(:cost_layers, :cost_layers_remaining_check,
             check: "remaining_quantity >= 0 AND remaining_quantity <= quantity"
           )

    create constraint(:cost_layers, :cost_layers_cost_check, check: "unit_cost >= 0")
  end
end
