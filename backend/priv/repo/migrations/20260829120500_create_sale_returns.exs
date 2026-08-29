defmodule Kaarobar.Repo.Migrations.CreateSaleReturns do
  use Ecto.Migration

  @moduledoc """
  Returns, and the approval that has to happen before one.

  ## Why a request and an approval are separate records

  Because the cashier who made the mistake should not be the one who approves
  undoing it. `sale:refund_request` and `sale:refund_approve` have been
  separate permissions since the access-control phase; this is the pair of
  tables that makes the separation real rather than nominal.

  A shop where one person does both simply grants themselves both permissions
  and the request auto-approves. A shop with a supervisor gets a queue, and a
  record of who authorised what — which is the first thing anyone looks at when
  the till is short at the end of a week.

  ## Returns restock selectively

  A returned item that is faulty does not go back on the shelf. `restock` is
  per line, and a line not restocked is written off instead — so the stock
  count stays true and the loss is visible rather than absorbed.
  """

  def change do
    create table(:refund_requests, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false
      add :sale_id, references(:sales, type: :binary_id, on_delete: :restrict), null: false

      add :number, :string, null: false
      add :status, :string, null: false, default: "pending"

      add :reason, :string, null: false
      add :requested_amount, :decimal, precision: 16, scale: 4

      add :requested_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :requested_at, :utc_datetime_usec, null: false

      add :reviewed_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :reviewed_at, :utc_datetime_usec
      add :review_note, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:refund_requests, [:business_id, :number])
    create index(:refund_requests, [:sale_id])
    create index(:refund_requests, [:business_id, :status])

    create constraint(:refund_requests, :refund_requests_status_check,
             check: "status IN ('pending','approved','rejected','completed')"
           )

    create table(:refund_request_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :refund_request_id,
          references(:refund_requests, type: :binary_id, on_delete: :delete_all),
          null: false

      add :sale_item_id, references(:sale_items, type: :binary_id, on_delete: :restrict),
        null: false

      add :quantity, :decimal, precision: 16, scale: 4, null: false
      add :restock, :boolean, null: false, default: true
      add :reason, :string

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create unique_index(:refund_request_items, [:refund_request_id, :sale_item_id])

    create constraint(:refund_request_items, :refund_request_items_quantity_check,
             check: "quantity > 0"
           )

    # --------------------------------------------------------------- returns
    create table(:sale_returns, primary_key: false) do
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

      add :sale_id, references(:sales, type: :binary_id, on_delete: :restrict), null: false
      add :customer_id, references(:customers, type: :binary_id, on_delete: :nilify_all)

      add :refund_request_id,
          references(:refund_requests, type: :binary_id, on_delete: :nilify_all)

      add :number, :string, null: false
      add :reason, :string

      add :subtotal, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :total, :decimal, precision: 16, scale: 4, null: false, default: 0
      # What it cost us to take back, so margin reporting stays honest.
      add :cost_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :processed_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :processed_by_label, :string
      add :returned_at, :utc_datetime_usec, null: false

      add :notes, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:sale_returns, [:business_id, :number])
    create index(:sale_returns, [:sale_id])
    create index(:sale_returns, [:branch_id, :returned_at])
    create index(:sale_returns, [:shift_id])
    create index(:sale_returns, [:customer_id])

    create constraint(:sale_returns, :sale_returns_total_check, check: "total >= 0")

    create table(:sale_return_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :sale_return_id,
          references(:sale_returns, type: :binary_id, on_delete: :delete_all),
          null: false

      add :sale_item_id, references(:sale_items, type: :binary_id, on_delete: :restrict),
        null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      add :name_snapshot, :string, null: false
      add :quantity, :decimal, precision: 16, scale: 4, null: false
      add :unit_price, :decimal, precision: 16, scale: 4, null: false
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :line_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :cost_snapshot, :decimal, precision: 16, scale: 4, null: false, default: 0

      # A faulty item does not go back on the shelf. Not restocking writes it
      # off instead, so the count stays true and the loss stays visible.
      add :restock, :boolean, null: false, default: true
      add :batch_id, references(:batches, type: :binary_id, on_delete: :nilify_all)
      add :reason, :string
      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create index(:sale_return_items, [:sale_return_id])
    create index(:sale_return_items, [:sale_item_id])
    create index(:sale_return_items, [:variant_id])

    create constraint(:sale_return_items, :sale_return_items_quantity_check,
             check: "quantity > 0"
           )
  end
end
