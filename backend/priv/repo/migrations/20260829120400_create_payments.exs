defmodule Kaarobar.Repo.Migrations.CreatePayments do
  use Ecto.Migration

  @moduledoc """
  How a sale was paid for — often in more than one way.

  A sale has many payments because customers split them: two thousand on a
  card, the rest in cash; a voucher plus the difference; half now and half on
  account. Modelling payment as a column on the sale makes the common case
  unrepresentable, and shops work around it by ringing two sales — which
  destroys the basket analysis and doubles the transaction count.

  ## Credit is a tender, not a payment

  Paying "on account" takes no money. It moves the debt to the customer ledger
  and the sale is settled from the shop's point of view. Treating it as a
  tender keeps the arithmetic uniform: every sale's tenders sum to its total,
  whatever mix of real and deferred money that is.

  ## Refunds attach to the payment they reverse

  Money goes back the way it came — a card refund to the card, cash to the
  drawer — because that is what the customer expects and what reconciles
  against the card terminal's own settlement. `payment_refunds` records which
  tender each portion came back through.
  """

  def change do
    create table(:payments, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :sale_id, references(:sales, type: :binary_id, on_delete: :restrict), null: false
      add :shift_id, references(:shifts, type: :binary_id, on_delete: :nilify_all)

      add :method, :string, null: false
      add :amount, :decimal, precision: 16, scale: 4, null: false
      # Cash handed over may exceed the amount due; the difference is change.
      add :tendered_amount, :decimal, precision: 16, scale: 4
      add :refunded_amount, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :currency, :string, size: 3, null: false

      # Filled in by the gateway integrations phase. Present now so a card
      # payment taken on an external terminal can still record its slip number.
      add :reference, :string
      add :card_last_four, :string
      add :card_scheme, :string
      add :gateway_transaction_id, :string
      add :status, :string, null: false, default: "captured"

      add :occurred_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:payments, [:sale_id])
    create index(:payments, [:shift_id, :method])
    create index(:payments, [:business_id, :occurred_at])

    create constraint(:payments, :payments_method_check,
             check:
               "method IN ('cash','card','wallet','bank_transfer','cheque'," <>
                 "'credit','gift_card','loyalty','store_credit','other')"
           )

    create constraint(:payments, :payments_status_check,
             check: "status IN ('pending','captured','failed','voided')"
           )

    create constraint(:payments, :payments_amount_check, check: "amount > 0")

    create constraint(:payments, :payments_refunded_check,
             check: "refunded_amount >= 0 AND refunded_amount <= amount"
           )

    # --------------------------------------------------------------- refunds
    create table(:payment_refunds, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :payment_id, references(:payments, type: :binary_id, on_delete: :restrict), null: false
      add :sale_return_id, :binary_id
      add :shift_id, references(:shifts, type: :binary_id, on_delete: :nilify_all)

      add :method, :string, null: false
      add :amount, :decimal, precision: 16, scale: 4, null: false
      add :reference, :string

      add :actor_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :occurred_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:payment_refunds, [:payment_id])
    create index(:payment_refunds, [:sale_return_id])
    create index(:payment_refunds, [:shift_id])

    create constraint(:payment_refunds, :payment_refunds_amount_check, check: "amount > 0")
  end
end
