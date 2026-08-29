defmodule Kaarobar.Repo.Migrations.CreateStockOperations do
  use Ecto.Migration

  @moduledoc """
  Transfers between branches, stock counts, and returns to suppliers.

  ## Transfers have three states because vans exist

  Stock that has left one branch and not yet arrived at another is neither
  branch's. Modelling a transfer as one instantaneous move makes it impossible
  to answer where those goods are, and a shop that transfers weekly always has
  some in that state.

  So: dispatching writes `transfer_out` and moves the goods into
  `in_transit`; receiving writes `transfer_in` at the destination. What arrives
  may be less than what left — that discrepancy is recorded rather than
  averaged away, because it is the only signal that something is going missing
  between two shops.

  ## Counts are proposed, then approved

  A count line records what was expected and what was found. Nothing changes
  until someone approves it, because a stock count is exactly when a typo
  becomes a permanent, unexplained correction. Approval writes one `count` move
  per line, and only for lines that actually differ.
  """

  def change do
    # -------------------------------------------------------------- transfers
    create table(:stock_transfers, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :source_branch_id, references(:branches, type: :binary_id, on_delete: :restrict),
        null: false

      add :destination_branch_id,
          references(:branches, type: :binary_id, on_delete: :restrict),
          null: false

      add :number, :string, null: false
      add :status, :string, null: false, default: "draft"

      add :dispatched_at, :utc_datetime_usec
      add :received_at, :utc_datetime_usec
      add :cancelled_at, :utc_datetime_usec

      add :notes, :text

      add :created_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :dispatched_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :received_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:stock_transfers, [:business_id, :number])
    create index(:stock_transfers, [:source_branch_id, :status])
    create index(:stock_transfers, [:destination_branch_id, :status])

    create constraint(:stock_transfers, :stock_transfers_status_check,
             check: "status IN ('draft','dispatched','received','cancelled')"
           )

    # Transferring to the same branch is a mistake, not a no-op worth storing.
    create constraint(:stock_transfers, :stock_transfers_distinct_branches_check,
             check: "source_branch_id <> destination_branch_id"
           )

    create table(:stock_transfer_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :stock_transfer_id,
          references(:stock_transfers, type: :binary_id, on_delete: :delete_all),
          null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      add :batch_id, references(:batches, type: :binary_id, on_delete: :nilify_all)

      add :quantity, :decimal, precision: 16, scale: 4, null: false
      # What actually arrived. Less than `quantity` is a discrepancy worth
      # investigating, and the gap is what makes it visible.
      add :received_quantity, :decimal, precision: 16, scale: 4

      # Carried across so the destination values the goods at what they cost,
      # not at whatever its own average happens to be.
      add :unit_cost, :decimal, precision: 16, scale: 4

      add :position, :integer, null: false, default: 0
      add :note, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:stock_transfer_items, [:stock_transfer_id])
    create index(:stock_transfer_items, [:variant_id])

    create constraint(:stock_transfer_items, :stock_transfer_items_quantity_check,
             check: "quantity > 0"
           )

    create constraint(:stock_transfer_items, :stock_transfer_items_received_check,
             check: "received_quantity IS NULL OR received_quantity >= 0"
           )

    # ----------------------------------------------------------------- counts
    create table(:stock_counts, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :number, :string, null: false
      add :status, :string, null: false, default: "draft"
      # "full" stops the shop; "cycle" counts a slice of it while trading.
      add :kind, :string, null: false, default: "cycle"

      # What was counted, when it is a slice rather than everything.
      add :category_id, references(:categories, type: :binary_id, on_delete: :nilify_all)

      add :started_at, :utc_datetime_usec
      add :counted_at, :utc_datetime_usec
      add :approved_at, :utc_datetime_usec
      add :cancelled_at, :utc_datetime_usec

      # Summary of the variance, so an approver sees the size of what they are
      # about to accept before opening the lines.
      add :variance_quantity, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :variance_value, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :line_count, :integer, null: false, default: 0

      add :notes, :text

      add :created_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :approved_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:stock_counts, [:business_id, :number])
    create index(:stock_counts, [:branch_id, :status])

    create constraint(:stock_counts, :stock_counts_status_check,
             check: "status IN ('draft','counting','awaiting_approval','approved','cancelled')"
           )

    create constraint(:stock_counts, :stock_counts_kind_check,
             check: "kind IN ('full','cycle','spot')"
           )

    create table(:stock_count_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :stock_count_id,
          references(:stock_counts, type: :binary_id, on_delete: :delete_all),
          null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      add :batch_id, references(:batches, type: :binary_id, on_delete: :nilify_all)

      # Snapshotted when the line was created, so the variance is against what
      # the system believed at the moment of counting rather than at approval.
      add :expected_quantity, :decimal, precision: 16, scale: 4, null: false
      add :counted_quantity, :decimal, precision: 16, scale: 4
      add :variance, :decimal, precision: 16, scale: 4
      add :unit_cost, :decimal, precision: 16, scale: 4
      add :variance_value, :decimal, precision: 16, scale: 4

      add :counted_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :counted_at, :utc_datetime_usec
      add :reason, :string
      add :note, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:stock_count_items, [:stock_count_id, :variant_id, :batch_id],
             where: "batch_id IS NOT NULL",
             name: :stock_count_items_batch_unique_index
           )

    create unique_index(:stock_count_items, [:stock_count_id, :variant_id],
             where: "batch_id IS NULL",
             name: :stock_count_items_variant_unique_index
           )

    create index(:stock_count_items, [:variant_id])

    create constraint(:stock_count_items, :stock_count_items_counted_check,
             check: "counted_quantity IS NULL OR counted_quantity >= 0"
           )

    # --------------------------------------------------------------- returns
    create table(:purchase_returns, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :supplier_id, references(:suppliers, type: :binary_id, on_delete: :restrict),
        null: false

      add :goods_receipt_id,
          references(:goods_receipts, type: :binary_id, on_delete: :nilify_all)

      add :number, :string, null: false
      add :status, :string, null: false, default: "draft"
      add :reason, :string

      add :returned_on, :date, null: false
      add :subtotal, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :notes, :text
      add :posted_at, :utc_datetime_usec

      add :created_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:purchase_returns, [:business_id, :number])
    create index(:purchase_returns, [:supplier_id])
    create index(:purchase_returns, [:branch_id, :status])

    create constraint(:purchase_returns, :purchase_returns_status_check,
             check: "status IN ('draft','posted','cancelled')"
           )

    create table(:purchase_return_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :purchase_return_id,
          references(:purchase_returns, type: :binary_id, on_delete: :delete_all),
          null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      add :batch_id, references(:batches, type: :binary_id, on_delete: :nilify_all)

      add :quantity, :decimal, precision: 16, scale: 4, null: false
      add :unit_cost, :decimal, precision: 16, scale: 4, null: false
      add :line_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :position, :integer, null: false, default: 0
      add :note, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:purchase_return_items, [:purchase_return_id])
    create index(:purchase_return_items, [:variant_id])

    create constraint(:purchase_return_items, :purchase_return_items_quantity_check,
             check: "quantity > 0"
           )
  end
end
