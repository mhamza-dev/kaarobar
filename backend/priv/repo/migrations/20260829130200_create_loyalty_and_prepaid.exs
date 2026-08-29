defmodule Kaarobar.Repo.Migrations.CreateLoyaltyAndPrepaid do
  use Ecto.Migration

  @moduledoc """
  Three kinds of value a customer holds before they spend it: points, store
  credit, and gift cards.

  ## One pattern, three times

  Each is a balance with an append-only transaction log behind it, and the
  balance is a projection maintained in the same transaction as the entry that
  moves it — the same shape as `stock_items`/`stock_moves`,
  `suppliers.balance`/`supplier_ledger_entries` and
  `customers.balance`/`customer_ledger_entries`.

  That is five ledgers now sharing one design. It is worth the repetition: a
  shopkeeper who disputes any of these numbers gets the same answer in the same
  form — the list of movements, each with the balance that followed it, and the
  row where it stopped adding up.

  ## What separates them

  **Points** are earned, not bought, and are worth nothing outside the shop.
  They expire, because an unbounded points liability grows quietly for years
  and is then redeemed all at once.

  **Store credit** is money the shop already took and owes back — usually from
  a return where the customer did not want cash. It belongs to a named
  customer and does not expire, because refusing to honour it is refusing a
  refund.

  **A gift card is a bearer instrument.** Whoever holds the code may spend it,
  which is why it has a code rather than an owner, why the code is stored
  hashed alongside a display suffix, and why it is the only one of the three
  that can be sold. `customer_id` on it is who it was bought *for*, not a
  restriction on who may use it.
  """

  def change do
    # ------------------------------------------------------------ loyalty
    create table(:loyalty_programs, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      add :points_label, :string, null: false, default: "points"

      # Points earned per unit of currency spent, and what one point is worth
      # when redeemed. Two rates, not one: shops routinely earn at 1 and redeem
      # at 0.01, and collapsing them hides the margin the programme costs.
      add :earn_rate, :decimal, precision: 12, scale: 6, null: false, default: 1
      add :redeem_rate, :decimal, precision: 12, scale: 6, null: false, default: 0.01

      add :min_points_to_redeem, :integer, null: false, default: 0
      # Cap redemption at a share of the bill, so points cannot pay for a whole
      # basket and leave the shop with the stock gone and no cash.
      add :max_redeem_percent, :decimal, precision: 9, scale: 6

      # Null means points never expire. A number means the liability has an end.
      add :points_expire_after_days, :integer

      # Earning on a discounted line is a choice, not an oversight.
      add :earn_on_discounted, :boolean, null: false, default: true
      add :earn_on_tax, :boolean, null: false, default: false

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    # One live programme per business: two would make "how many points do I
    # have" a question with two answers.
    create unique_index(:loyalty_programs, [:business_id],
             where: "is_active AND deleted_at IS NULL",
             name: :loyalty_programs_single_active_index
           )

    create constraint(:loyalty_programs, :loyalty_programs_rates_check,
             check: "earn_rate >= 0 AND redeem_rate >= 0"
           )

    create constraint(:loyalty_programs, :loyalty_programs_max_redeem_check,
             check:
               "max_redeem_percent IS NULL OR " <>
                 "(max_redeem_percent > 0 AND max_redeem_percent <= 1)"
           )

    create table(:loyalty_accounts, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :loyalty_program_id,
          references(:loyalty_programs, type: :binary_id, on_delete: :restrict),
          null: false

      add :customer_id, references(:customers, type: :binary_id, on_delete: :delete_all),
        null: false

      # Projections of loyalty_transactions.
      add :points_balance, :integer, null: false, default: 0
      add :lifetime_earned, :integer, null: false, default: 0
      add :lifetime_redeemed, :integer, null: false, default: 0

      add :tier, :string
      add :enrolled_at, :utc_datetime_usec, null: false
      add :last_activity_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:loyalty_accounts, [:loyalty_program_id, :customer_id],
             name: :loyalty_accounts_program_customer_index
           )

    create index(:loyalty_accounts, [:customer_id])

    create constraint(:loyalty_accounts, :loyalty_accounts_balance_check,
             check: "points_balance >= 0"
           )

    create table(:loyalty_transactions, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :loyalty_account_id,
          references(:loyalty_accounts, type: :binary_id, on_delete: :restrict),
          null: false

      add :kind, :string, null: false
      # Signed: positive earns, negative spends.
      add :points, :integer, null: false
      add :balance_after, :integer, null: false

      # What the points were worth in money, for the redemption that used them.
      add :value_amount, :decimal, precision: 16, scale: 4

      add :reference_type, :string
      add :reference_id, :binary_id
      add :note, :text

      # Only earnings expire, and only when the programme says they do.
      add :expires_on, :date
      add :occurred_at, :utc_datetime_usec, null: false

      add :actor_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:loyalty_transactions, [:loyalty_account_id, :occurred_at])
    create index(:loyalty_transactions, [:reference_type, :reference_id])
    # The nightly expiry sweep.
    create index(:loyalty_transactions, [:expires_on], where: "expires_on IS NOT NULL")

    create constraint(:loyalty_transactions, :loyalty_transactions_kind_check,
             check: "kind IN ('earn','redeem','expire','adjustment','reversal')"
           )

    create constraint(:loyalty_transactions, :loyalty_transactions_points_check,
             check: "points <> 0"
           )

    execute """
            CREATE OR REPLACE FUNCTION loyalty_transactions_reject_change()
            RETURNS trigger AS $$
            BEGIN
              RAISE EXCEPTION 'loyalty_transactions is append-only';
            END;
            $$ LANGUAGE plpgsql;
            """,
            "DROP FUNCTION IF EXISTS loyalty_transactions_reject_change()"

    execute """
            CREATE TRIGGER loyalty_transactions_no_update
            BEFORE UPDATE ON loyalty_transactions
            FOR EACH ROW EXECUTE FUNCTION loyalty_transactions_reject_change();
            """,
            "DROP TRIGGER IF EXISTS loyalty_transactions_no_update ON loyalty_transactions"

    # ------------------------------------------------------- store credit
    create table(:store_credits, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :customer_id, references(:customers, type: :binary_id, on_delete: :restrict),
        null: false

      add :number, :string, null: false
      add :currency, :string, size: 3, null: false

      add :issued_amount, :decimal, precision: 16, scale: 4, null: false
      # Projection of store_credit_transactions.
      add :balance, :decimal, precision: 16, scale: 4, null: false

      add :reason, :string
      # Usually the return that created it.
      add :reference_type, :string
      add :reference_id, :binary_id

      add :issued_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :issued_at, :utc_datetime_usec, null: false
      # Store credit is money already taken. It does not expire by default.
      add :expires_on, :date
      add :voided_at, :utc_datetime_usec
      add :void_reason, :string

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:store_credits, [:business_id, :number])
    create index(:store_credits, [:customer_id], where: "balance > 0")

    create constraint(:store_credits, :store_credits_amounts_check,
             check: "issued_amount > 0 AND balance >= 0 AND balance <= issued_amount"
           )

    create table(:store_credit_transactions, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :store_credit_id,
          references(:store_credits, type: :binary_id, on_delete: :restrict),
          null: false

      add :kind, :string, null: false
      # Signed: positive issues or restores, negative spends.
      add :amount, :decimal, precision: 16, scale: 4, null: false
      add :balance_after, :decimal, precision: 16, scale: 4, null: false

      add :reference_type, :string
      add :reference_id, :binary_id
      add :note, :text
      add :occurred_at, :utc_datetime_usec, null: false

      add :actor_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:store_credit_transactions, [:store_credit_id, :occurred_at])

    create constraint(:store_credit_transactions, :store_credit_transactions_kind_check,
             check: "kind IN ('issue','redeem','refund','expire','void','adjustment')"
           )

    create constraint(:store_credit_transactions, :store_credit_transactions_amount_check,
             check: "amount <> 0"
           )

    # --------------------------------------------------------- gift cards
    create table(:gift_cards, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      # A bearer instrument: the code *is* the money, so only its hash is kept
      # and the last four characters are stored separately so staff can find a
      # card the customer is holding without the database ever storing one that
      # could be spent if it leaked.
      add :code_hash, :binary, null: false
      add :code_last_four, :string, size: 4, null: false

      add :currency, :string, size: 3, null: false
      add :issued_amount, :decimal, precision: 16, scale: 4, null: false
      add :balance, :decimal, precision: 16, scale: 4, null: false

      add :status, :string, null: false, default: "active"

      # Who it was bought for, if anyone said. Not a restriction on who may
      # spend it — that is what makes it a gift.
      add :customer_id, references(:customers, type: :binary_id, on_delete: :nilify_all)
      add :recipient_name, :string
      add :message, :text

      # The sale that sold it, so an unredeemed card can be traced.
      add :issued_by_sale_id, references(:sales, type: :binary_id, on_delete: :nilify_all)
      add :issued_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :issued_at, :utc_datetime_usec, null: false
      add :expires_on, :date
      add :activated_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:gift_cards, [:business_id, :code_hash])
    create index(:gift_cards, [:business_id, :code_last_four])
    create index(:gift_cards, [:customer_id])

    create constraint(:gift_cards, :gift_cards_status_check,
             check: "status IN ('inactive','active','depleted','expired','voided')"
           )

    create constraint(:gift_cards, :gift_cards_amounts_check,
             check: "issued_amount > 0 AND balance >= 0"
           )

    create table(:gift_card_transactions, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :gift_card_id, references(:gift_cards, type: :binary_id, on_delete: :restrict),
        null: false

      add :kind, :string, null: false
      # Signed: positive loads, negative spends.
      add :amount, :decimal, precision: 16, scale: 4, null: false
      add :balance_after, :decimal, precision: 16, scale: 4, null: false

      add :reference_type, :string
      add :reference_id, :binary_id
      add :note, :text
      add :occurred_at, :utc_datetime_usec, null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :nilify_all)
      add :actor_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:gift_card_transactions, [:gift_card_id, :occurred_at])
    create index(:gift_card_transactions, [:reference_type, :reference_id])

    create constraint(:gift_card_transactions, :gift_card_transactions_kind_check,
             check: "kind IN ('issue','topup','redeem','refund','expire','void','adjustment')"
           )

    create constraint(:gift_card_transactions, :gift_card_transactions_amount_check,
             check: "amount <> 0"
           )
  end
end
