defmodule Kaarobar.Repo.Migrations.CreateSupplierBills do
  use Ecto.Migration

  @moduledoc """
  What the shop has been invoiced, what it has paid, and how the two match up.

  ## Bills are separate from receipts

  A supplier invoices on their schedule, not the shop's. One invoice may cover
  three deliveries; one delivery may be invoiced twice by mistake. Treating the
  goods receipt as the invoice makes both of those unrepresentable, and the
  shop finds out when it pays for something twice.

  ## Payments are allocated, not just recorded

  A shop pays 50,000 against four outstanding bills. Which ones it clears
  changes what is overdue, what is within terms, and what a supplier will chase.
  `supplier_payment_allocations` records the answer explicitly rather than
  leaving it to be inferred from dates — because the inference is wrong as soon
  as a part-payment is involved, which is most of the time.

  An unallocated payment is legitimate: money on account, applied later.
  """

  def change do
    create table(:supplier_bills, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :supplier_id, references(:suppliers, type: :binary_id, on_delete: :restrict),
        null: false

      add :goods_receipt_id,
          references(:goods_receipts, type: :binary_id, on_delete: :nilify_all)

      add :purchase_order_id,
          references(:purchase_orders, type: :binary_id, on_delete: :nilify_all)

      # Ours, for filing. Theirs, for talking to them about it.
      add :number, :string, null: false
      add :supplier_invoice_number, :string

      add :status, :string, null: false, default: "draft"

      add :issued_on, :date, null: false
      add :due_on, :date

      add :currency, :string, size: 3, null: false
      add :exchange_rate, :decimal, precision: 16, scale: 8, null: false, default: 1

      add :subtotal, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :discount_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :shipping_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :total, :decimal, precision: 16, scale: 4, null: false, default: 0
      # The sum of allocations against this bill.
      add :paid_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :notes, :text
      add :posted_at, :utc_datetime_usec
      add :cancelled_at, :utc_datetime_usec

      add :created_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:supplier_bills, [:business_id, :number])
    create index(:supplier_bills, [:supplier_id, :status])
    create index(:supplier_bills, [:business_id, :due_on])

    # The same supplier invoice entered twice is the single most common way a
    # shop pays for something it already paid for.
    create unique_index(:supplier_bills, [:supplier_id, :supplier_invoice_number],
             where: "supplier_invoice_number IS NOT NULL AND cancelled_at IS NULL",
             name: :supplier_bills_unique_supplier_invoice_index
           )

    create constraint(:supplier_bills, :supplier_bills_status_check,
             check: "status IN ('draft','posted','partially_paid','paid','cancelled')"
           )

    create constraint(:supplier_bills, :supplier_bills_paid_check,
             check: "paid_total >= 0"
           )

    create constraint(:supplier_bills, :supplier_bills_due_check,
             check: "due_on IS NULL OR due_on >= issued_on"
           )

    # ------------------------------------------------------------- bill lines
    create table(:supplier_bill_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :supplier_bill_id,
          references(:supplier_bills, type: :binary_id, on_delete: :delete_all),
          null: false

      # Nullable: a bill line may be freight or a fee rather than a product.
      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict)

      add :description, :string, null: false
      add :quantity, :decimal, precision: 16, scale: 4, null: false, default: 1
      add :unit_cost, :decimal, precision: 16, scale: 4, null: false
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :line_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create index(:supplier_bill_items, [:supplier_bill_id])
    create index(:supplier_bill_items, [:variant_id])

    # -------------------------------------------------------------- payments
    create table(:supplier_payments, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :nilify_all)

      add :supplier_id, references(:suppliers, type: :binary_id, on_delete: :restrict),
        null: false

      add :number, :string, null: false
      add :method, :string, null: false, default: "cash"

      add :amount, :decimal, precision: 16, scale: 4, null: false
      # Paid but not yet matched to a bill: money on account.
      add :unallocated_amount, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :currency, :string, size: 3, null: false
      add :exchange_rate, :decimal, precision: 16, scale: 8, null: false, default: 1

      add :paid_on, :date, null: false
      add :reference, :string
      add :notes, :text

      add :created_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:supplier_payments, [:business_id, :number])
    create index(:supplier_payments, [:supplier_id, :paid_on])

    create constraint(:supplier_payments, :supplier_payments_amount_check,
             check: "amount > 0"
           )

    create constraint(:supplier_payments, :supplier_payments_unallocated_check,
             check: "unallocated_amount >= 0 AND unallocated_amount <= amount"
           )

    create constraint(:supplier_payments, :supplier_payments_method_check,
             check: "method IN ('cash','bank_transfer','cheque','card','wallet','other')"
           )

    # ------------------------------------------------------------ allocations
    create table(:supplier_payment_allocations, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :supplier_payment_id,
          references(:supplier_payments, type: :binary_id, on_delete: :delete_all),
          null: false

      add :supplier_bill_id,
          references(:supplier_bills, type: :binary_id, on_delete: :restrict),
          null: false

      add :amount, :decimal, precision: 16, scale: 4, null: false

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    # Named explicitly — the derived name is 71 characters, past the 63 that
    # Postgres keeps. See the note on product_components.
    create unique_index(:supplier_payment_allocations, [:supplier_payment_id, :supplier_bill_id],
             name: :supplier_payment_allocations_payment_bill_index
           )
    create index(:supplier_payment_allocations, [:supplier_bill_id])

    create constraint(:supplier_payment_allocations, :supplier_payment_allocations_amount_check,
             check: "amount > 0"
           )
  end
end
