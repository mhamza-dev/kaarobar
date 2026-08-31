defmodule Kaarobar.Repo.Migrations.CreateBilling do
  use Ecto.Migration

  @moduledoc """
  What each organization pays Kaarobar, and what that entitles them to.

  Entirely separate from the money a shop takes over its own counter. Those
  live in `payments` and belong to the tenant; these belong to us. Sharing a
  table between the two would mean one bad query showing a shopkeeper our
  revenue, or putting their customers' card charges in our books.

  ## Plans are platform-owned, so they carry no tenant

  `subscription_plans` and `plan_features` have no `organization_id`. They are
  our catalogue, the same for everyone, and a per-tenant copy would drift the
  moment a plan changed — leaving two shops on "Standard" with different
  features and no way to tell which was right.

  ## Features are rows, not columns

  Adding a feature to a plan must not be a migration. Every entitlement — a
  module a plan unlocks, a limit it imposes — is a row keyed by string, so the
  answer to "what does this plan include?" is a query and pricing changes are
  data.

  ## Past due does not mean cut off

  A failed card is not a reason to close somebody's shop. The subscription
  carries a `grace_until`, and access ends at that date rather than at the
  first decline — which is what the dunning schedule on `platform_invoices` is
  counting down to.
  """

  def change do
    # ------------------------------------------------------------------ plans
    create table(:subscription_plans, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :code, :string, null: false
      add :name, :string, null: false
      add :description, :text

      add :interval, :string, null: false, default: "month"
      add :currency, :string, null: false, default: "PKR"
      add :amount, :decimal, precision: 16, scale: 4, null: false, default: 0

      # Nothing is charged until it ends, and the subscription is `trialing`
      # throughout. A trial expressed as a discounted invoice would show up in
      # revenue as a sale that never happened.
      add :trial_days, :integer, null: false, default: 0

      # Shown on the pricing page. A plan can be live and unlisted — which is
      # how an old price is honoured for the shops already on it without
      # offering it to anybody new.
      add :is_public, :boolean, null: false, default: true
      add :is_active, :boolean, null: false, default: true
      add :position, :integer, null: false, default: 0

      # The gateway's own id for this price, so a subscription can be created
      # there without a mapping table.
      add :external_price_id, :string

      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:subscription_plans, [:code], where: "deleted_at IS NULL")
    create index(:subscription_plans, [:is_public, :is_active])

    create constraint(:subscription_plans, :subscription_plans_interval_check,
             check: "interval IN ('month','year')"
           )

    create constraint(:subscription_plans, :subscription_plans_amount_check,
             check: "amount >= 0"
           )

    # --------------------------------------------------------------- features
    create table(:plan_features, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :plan_id,
          references(:subscription_plans, type: :binary_id, on_delete: :delete_all),
          null: false

      # A module key from `Kaarobar.Verticals`, or a limit key like
      # "max_branches". Deliberately a string: adding a feature is data.
      add :key, :string, null: false
      add :is_enabled, :boolean, null: false, default: true
      # NULL means unlimited, which is different from zero. A plan with no
      # stated branch limit should not be read as a plan allowing no branches.
      add :limit_value, :integer

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:plan_features, [:plan_id, :key])

    create constraint(:plan_features, :plan_features_limit_check,
             check: "limit_value IS NULL OR limit_value >= 0"
           )

    # ---------------------------------------------------------- subscriptions
    create table(:subscriptions, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :plan_id,
          references(:subscription_plans, type: :binary_id, on_delete: :restrict),
          null: false

      add :status, :string, null: false, default: "trialing"
      add :provider, :string, null: false, default: "manual"

      add :currency, :string, null: false, default: "PKR"

      add :current_period_start, :utc_datetime_usec
      add :current_period_end, :utc_datetime_usec
      add :trial_ends_at, :utc_datetime_usec

      # When a past-due subscription actually loses access. Access ends here,
      # not at the first failed charge: a card that expires on a Sunday must
      # not close a shop on the Sunday.
      add :grace_until, :utc_datetime_usec

      # Asked for by the customer, honoured at the end of the period they have
      # already paid for. Cancelling immediately would be taking their money
      # and withdrawing the service in the same act.
      add :cancel_at_period_end, :boolean, null: false, default: false
      add :canceled_at, :utc_datetime_usec
      add :ended_at, :utc_datetime_usec

      add :external_customer_id, :string
      add :external_subscription_id, :string

      timestamps(type: :utc_datetime_usec)
    end

    # One live subscription per organization. Two would make "what may this org
    # do?" a question with two answers.
    create unique_index(:subscriptions, [:organization_id],
             where: "status NOT IN ('canceled','expired')",
             name: :subscriptions_active_organization_index
           )

    create index(:subscriptions, [:status, :current_period_end])
    create unique_index(:subscriptions, [:external_subscription_id],
             where: "external_subscription_id IS NOT NULL"
           )

    create constraint(:subscriptions, :subscriptions_status_check,
             check: "status IN ('trialing','active','past_due','paused','canceled','expired')"
           )

    # ------------------------------------------------------- what is paid for
    create table(:subscription_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :subscription_id,
          references(:subscriptions, type: :binary_id, on_delete: :delete_all),
          null: false

      # What is being counted: seats, branches, businesses, or a named add-on.
      add :kind, :string, null: false
      add :quantity, :integer, null: false, default: 1
      add :unit_amount, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :external_item_id, :string

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:subscription_items, [:subscription_id, :kind])

    create constraint(:subscription_items, :subscription_items_quantity_check,
             check: "quantity >= 0"
           )

    # ------------------------------------------------------ platform invoices
    create table(:platform_invoices, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :subscription_id,
          references(:subscriptions, type: :binary_id, on_delete: :nilify_all)

      add :number, :string, null: false
      add :status, :string, null: false, default: "open"
      add :currency, :string, null: false, default: "PKR"

      add :subtotal, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :amount_paid, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :period_start, :utc_datetime_usec
      add :period_end, :utc_datetime_usec
      add :due_at, :utc_datetime_usec
      add :paid_at, :utc_datetime_usec
      add :voided_at, :utc_datetime_usec

      # Dunning. How many times we have tried, how far along the escalation we
      # are, and when to try next — on the invoice rather than in a separate
      # table, because there is exactly one dunning run per unpaid invoice and
      # a second table would only be a place for the two to disagree.
      add :attempts, :integer, null: false, default: 0
      add :dunning_stage, :integer, null: false, default: 0
      add :next_attempt_at, :utc_datetime_usec
      add :last_error, :text

      add :external_invoice_id, :string

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:platform_invoices, [:number])
    create index(:platform_invoices, [:organization_id, :status])

    create index(:platform_invoices, [:status, :next_attempt_at],
             where: "status = 'open'",
             name: :platform_invoices_dunning_index
           )

    create constraint(:platform_invoices, :platform_invoices_status_check,
             check: "status IN ('draft','open','paid','void','uncollectible')"
           )

    create constraint(:platform_invoices, :platform_invoices_paid_check,
             check: "status <> 'paid' OR paid_at IS NOT NULL"
           )

    create table(:platform_invoice_lines, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :invoice_id,
          references(:platform_invoices, type: :binary_id, on_delete: :delete_all),
          null: false

      add :description, :string, null: false
      add :quantity, :integer, null: false, default: 1
      add :unit_amount, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :amount, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create index(:platform_invoice_lines, [:invoice_id])

    # Our own invoice numbers, in one global series. Unlike a shop's sales
    # numbering this does not have to be gapless per tenant — we are the issuer
    # and there is one of us — so a Postgres sequence is both sufficient and
    # cheaper than taking a lock on a counter row.
    execute "CREATE SEQUENCE IF NOT EXISTS platform_invoice_number_seq",
            "DROP SEQUENCE IF EXISTS platform_invoice_number_seq"
  end
end
