defmodule Kaarobar.Repo.Migrations.CreatePaymentsGateway do
  use Ecto.Migration

  @moduledoc """
  Taking money through somebody else's rails: Stripe, JazzCash, Easypaisa.

  ## The webhook is the truth, not the redirect

  A customer closing the tab after paying does not mean the payment failed, and
  a customer landing on the success page does not mean it succeeded. The
  browser redirect is a hint; the gateway's signed callback is the fact. So an
  intent stays pending until a webhook says otherwise, and `webhook_events` is
  a first-class table rather than a log line.

  ## Webhooks arrive more than once

  Every gateway retries, and several deliver out of order. `webhook_events` is
  unique on `(provider, external_id)`, so a replay is a no-op rather than a
  second capture — which is the difference between a duplicate row and taking
  a customer's money twice.

  Events are stored before they are acted on. A handler that crashes must not
  lose the event, because the gateway may not send it again.

  ## Credentials are encrypted at rest

  A payment secret sitting in a database dump is someone else's money. They go
  through `Kaarobar.Encrypted.Map`, so a backup, a replica or a stray log line
  yields ciphertext.

  ## An intent is what we asked for; a transaction is what happened

  One intent may have several attempts — a declined card retried, a 3-D Secure
  challenge, a customer who tries a second card. Collapsing them loses the
  history a chargeback dispute is argued with.
  """

  def change do
    create table(:payment_providers, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :provider, :string, null: false
      add :display_name, :string, null: false
      add :mode, :string, null: false, default: "test"

      # Encrypted at rest: a payment secret in a database dump is somebody
      # else's money.
      add :credentials, :binary
      # Safe to read: the publishable key, the merchant id, the return URL.
      add :public_config, :map, null: false, default: %{}

      # Used to verify that a callback really came from the gateway. Encrypted
      # for the same reason as the credentials: anyone holding it can forge a
      # "payment succeeded" event.
      add :webhook_secret, :binary
      add :webhook_url, :string

      add :is_active, :boolean, null: false, default: true
      add :is_default, :boolean, null: false, default: false
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:payment_providers, [:business_id, :provider],
             where: "deleted_at IS NULL"
           )

    create unique_index(:payment_providers, [:business_id],
             where: "is_default AND deleted_at IS NULL",
             name: :payment_providers_single_default_index
           )

    create constraint(:payment_providers, :payment_providers_provider_check,
             check: "provider IN ('stripe','jazzcash','easypaisa','manual')"
           )

    create constraint(:payment_providers, :payment_providers_mode_check,
             check: "mode IN ('test','live')"
           )

    # --------------------------------------------------------------- intents
    create table(:payment_intents, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :nilify_all)

      add :payment_provider_id,
          references(:payment_providers, type: :binary_id, on_delete: :restrict),
          null: false

      # What the money is for. Nullable because an intent is usually created
      # before the sale exists — the sale is written once the money is known to
      # have arrived.
      add :sale_id, references(:sales, type: :binary_id, on_delete: :nilify_all)
      add :order_id, references(:orders, type: :binary_id, on_delete: :nilify_all)
      add :customer_id, references(:customers, type: :binary_id, on_delete: :nilify_all)

      add :reference, :string, null: false
      add :status, :string, null: false, default: "pending"

      add :amount, :decimal, precision: 16, scale: 4, null: false
      add :currency, :string, size: 3, null: false
      add :captured_amount, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :refunded_amount, :decimal, precision: 16, scale: 4, null: false, default: 0

      # The gateway's own id for this intent.
      add :external_id, :string
      # Where to send the customer to pay.
      add :checkout_url, :text
      add :expires_at, :utc_datetime_usec

      add :failure_code, :string
      add :failure_message, :string

      add :metadata, :map, null: false, default: %{}

      add :created_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :authorized_at, :utc_datetime_usec
      add :captured_at, :utc_datetime_usec
      add :failed_at, :utc_datetime_usec
      add :cancelled_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:payment_intents, [:business_id, :reference])

    create unique_index(:payment_intents, [:payment_provider_id, :external_id],
             where: "external_id IS NOT NULL",
             name: :payment_intents_provider_external_index
           )

    create index(:payment_intents, [:business_id, :status, :inserted_at])
    create index(:payment_intents, [:sale_id])

    create constraint(:payment_intents, :payment_intents_status_check,
             check:
               "status IN ('pending','processing','requires_action','authorized'," <>
                 "'captured','partially_refunded','refunded','failed','cancelled','expired')"
           )

    create constraint(:payment_intents, :payment_intents_amount_check,
             check:
               "amount > 0 AND captured_amount >= 0 AND refunded_amount >= 0 AND " <>
                 "refunded_amount <= captured_amount"
           )

    # ---------------------------------------------------------- transactions
    #
    # One row per thing the gateway actually did. An intent may have several:
    # a declined card retried, a 3-D Secure challenge, a second card. Collapsing
    # them loses the history a chargeback is argued with.
    create table(:gateway_transactions, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :payment_intent_id,
          references(:payment_intents, type: :binary_id, on_delete: :restrict),
          null: false

      add :kind, :string, null: false
      add :status, :string, null: false
      add :amount, :decimal, precision: 16, scale: 4, null: false
      add :currency, :string, size: 3, null: false

      add :external_id, :string
      add :provider_status, :string
      add :failure_code, :string
      add :failure_message, :string

      # What the gateway charged us to move the money. Recorded because the
      # figure that reconciles against the bank is net of it, and a shop that
      # only tracks gross can never make the two agree.
      add :fee_amount, :decimal, precision: 16, scale: 4
      add :net_amount, :decimal, precision: 16, scale: 4

      add :card_last_four, :string
      add :card_scheme, :string
      add :wallet_msisdn, :string

      # The gateway's payload, kept whole. When a dispute turns on what the
      # provider actually said, a parsed subset is not enough.
      add :raw_response, :map

      add :occurred_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:gateway_transactions, [:payment_intent_id, :occurred_at])
    create index(:gateway_transactions, [:external_id])

    create constraint(:gateway_transactions, :gateway_transactions_kind_check,
             check: "kind IN ('authorize','capture','sale','refund','void','chargeback','payout')"
           )

    create constraint(:gateway_transactions, :gateway_transactions_status_check,
             check: "status IN ('pending','succeeded','failed')"
           )

    # -------------------------------------------------------- webhook events
    create table(:webhook_events, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :nilify_all)

      add :business_id, references(:businesses, type: :binary_id, on_delete: :nilify_all)

      add :provider, :string, null: false
      # The gateway's own event id. Unique per provider, which is what makes a
      # replay a no-op instead of a second capture.
      add :external_id, :string, null: false
      add :event_type, :string, null: false

      add :status, :string, null: false, default: "received"
      add :signature_verified, :boolean, null: false, default: false

      # Stored before it is acted on: a handler that crashes must not lose the
      # event, because the gateway may not send it again.
      add :payload, :map, null: false

      add :payment_intent_id,
          references(:payment_intents, type: :binary_id, on_delete: :nilify_all)

      add :attempts, :integer, null: false, default: 0
      add :last_error, :text
      add :processed_at, :utc_datetime_usec
      add :received_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec)
    end

    # The idempotency guard. Every gateway retries; several deliver out of
    # order. Without this, a replayed "payment succeeded" takes the money twice.
    create unique_index(:webhook_events, [:provider, :external_id])
    create index(:webhook_events, [:status, :received_at])
    create index(:webhook_events, [:payment_intent_id])

    create constraint(:webhook_events, :webhook_events_status_check,
             check: "status IN ('received','processed','failed','ignored')"
           )

    # ------------------------------------------------------------ settlements
    #
    # What the gateway actually paid into the bank, against what it says it
    # collected. The two differ by fees, refunds, chargebacks and timing, and a
    # shop that cannot reconcile them cannot tell a fee from a theft.
    create table(:settlements, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :payment_provider_id,
          references(:payment_providers, type: :binary_id, on_delete: :restrict),
          null: false

      add :external_id, :string, null: false
      add :status, :string, null: false, default: "pending"

      add :gross_amount, :decimal, precision: 16, scale: 4, null: false
      add :fee_amount, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :refund_amount, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :net_amount, :decimal, precision: 16, scale: 4, null: false
      add :currency, :string, size: 3, null: false

      add :transaction_count, :integer, null: false, default: 0
      add :period_start, :date
      add :period_end, :date
      add :paid_out_at, :utc_datetime_usec

      # Set once the shop has matched it against the bank.
      add :reconciled_at, :utc_datetime_usec
      add :reconciled_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :variance, :decimal, precision: 16, scale: 4
      add :notes, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:settlements, [:payment_provider_id, :external_id])
    create index(:settlements, [:business_id, :period_end])

    create constraint(:settlements, :settlements_status_check,
             check: "status IN ('pending','paid','reconciled','disputed')"
           )
  end
end
