defmodule Kaarobar.Repo.Migrations.CreateCustomerPaymentAllocations do
  use Ecto.Migration

  @moduledoc """
  Which invoice a payment actually paid.

  ## Why this cannot be inferred

  The tempting shortcut is to skip this table and apply payments oldest-first
  when a report needs them. That inference is wrong the first time a customer
  part-pays, disputes a line, or hands over a round number against four
  invoices — which is to say, almost immediately. And it is wrong silently: the
  balance still adds up, so nobody notices until a customer insists they paid
  for a particular delivery and the shop cannot say whether they did.

  Recording the allocation makes "is invoice 1043 paid?" answerable, which is
  the question that actually gets asked, and it is what lets an ageing report
  put money in the right bucket instead of assuming the oldest debt went first.

  ## Outstanding is derived, never stored

  A sale's unpaid credit is what was charged to the account, less what has been
  allocated against it, less any credit note. Storing a running figure on the
  sale would mean two places to keep in step, and sales are meant to be
  immutable once rung. Deriving it costs a join and can never drift.

  ## Unallocated money is normal

  A customer paying 5,000 against 4,200 of invoices leaves 800 on account.
  Allocations do not have to cover a payment, and the leftover shows in their
  balance as credit — which is exactly what it is.
  """

  def change do
    create table(:customer_payment_allocations, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :customer_payment_id,
          references(:customer_payments, type: :binary_id, on_delete: :restrict),
          null: false

      # The invoice being settled. A customer says "1043", not "ledger entry 7",
      # so the allocation is against the document they can name.
      add :sale_id, references(:sales, type: :binary_id, on_delete: :restrict), null: false

      add :amount, :decimal, precision: 16, scale: 4, null: false
      add :note, :string

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    # One row per payment/invoice pair: two partial allocations from the same
    # payment to the same invoice is a client that retried, not a real event.
    create unique_index(:customer_payment_allocations, [:customer_payment_id, :sale_id],
             name: :customer_payment_allocations_payment_sale_index
           )

    create index(:customer_payment_allocations, [:sale_id])
    create index(:customer_payment_allocations, [:business_id])

    create constraint(:customer_payment_allocations, :customer_payment_allocations_amount_check,
             check: "amount > 0"
           )

    # `credit_total` is what this sale put on the account — the sum of its
    # `credit` tenders, frozen at checkout.
    #
    # It is a snapshot of the payments rows rather than a second source of
    # truth: summing tenders on every ageing query would make the report scan
    # the whole payments table, and the figure can never change after the sale
    # is rung. Nothing else about settlement is stored here — how much is left
    # comes from the allocations.
    alter table(:sales) do
      add :credit_total, :decimal, precision: 16, scale: 4, null: false, default: 0
    end

    # The ageing query: unsettled credit sales for a business, oldest first.
    create index(:sales, [:business_id, :customer_id, :sold_at],
             where: "credit_total > 0",
             name: :sales_credit_outstanding_index
           )

    create constraint(:sales, :sales_credit_total_check, check: "credit_total >= 0")
  end
end
