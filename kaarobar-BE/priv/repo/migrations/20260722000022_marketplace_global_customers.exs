defmodule Kaarobar.Repo.Migrations.MarketplaceGlobalCustomers do
  use Ecto.Migration

  def up do
    alter table(:customers) do
      add :customer_account_id, references(:customer_accounts, type: :binary_id, on_delete: :nilify_all)
    end

    create index(:customers, [:customer_account_id])

    create unique_index(:customers, [:business_id, :customer_account_id],
      name: :customers_business_id_customer_account_id_uidx,
      where: "customer_account_id IS NOT NULL"
    )

    alter table(:businesses) do
      add :marketplace_enabled, :boolean, null: false, default: false
      add :marketplace_slug, :string
      add :online_branch_id, references(:branches, type: :binary_id, on_delete: :nilify_all)
    end

    create unique_index(:businesses, [:marketplace_slug],
      name: :businesses_marketplace_slug_uidx,
      where: "marketplace_slug IS NOT NULL AND marketplace_slug <> ''"
    )

    alter table(:sales) do
      add :source, :string, null: false, default: "pos"
      modify :cashier_id, :binary_id, null: true, from: :binary_id
    end

    create index(:sales, [:business_id, :source])

    # Backfill: link each customer_account's customer_id → customers.customer_account_id
    execute("""
    UPDATE customers c
    SET customer_account_id = a.id
    FROM customer_accounts a
    WHERE a.customer_id = c.id
      AND c.customer_account_id IS NULL
    """)

    # Merge duplicate emails: keep oldest account per email, re-point customers + sessions
    execute("""
    WITH ranked AS (
      SELECT id, lower(email) AS email_key,
             ROW_NUMBER() OVER (PARTITION BY lower(email) ORDER BY inserted_at ASC, id ASC) AS rn
      FROM customer_accounts
    ),
    winners AS (
      SELECT id AS keep_id, email_key FROM ranked WHERE rn = 1
    ),
    losers AS (
      SELECT r.id AS lose_id, w.keep_id
      FROM ranked r
      JOIN winners w ON w.email_key = r.email_key
      WHERE r.rn > 1
    )
    UPDATE customers c
    SET customer_account_id = l.keep_id
    FROM losers l
    WHERE c.customer_account_id = l.lose_id
    """)

    execute("""
    WITH ranked AS (
      SELECT id, lower(email) AS email_key,
             ROW_NUMBER() OVER (PARTITION BY lower(email) ORDER BY inserted_at ASC, id ASC) AS rn
      FROM customer_accounts
    ),
    winners AS (
      SELECT id AS keep_id, email_key FROM ranked WHERE rn = 1
    ),
    losers AS (
      SELECT r.id AS lose_id, w.keep_id
      FROM ranked r
      JOIN winners w ON w.email_key = r.email_key
      WHERE r.rn > 1
    )
    UPDATE customer_sessions s
    SET customer_account_id = l.keep_id
    FROM losers l
    WHERE s.customer_account_id = l.lose_id
    """)

    execute("""
    DELETE FROM customer_accounts a
    USING (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY lower(email) ORDER BY inserted_at ASC, id ASC) AS rn
      FROM customer_accounts
    ) ranked
    WHERE a.id = ranked.id AND ranked.rn > 1
    """)

    # Drop old FKs/uniques that tie accounts to a single business/customer
    drop_if_exists unique_index(:customer_accounts, [:customer_id])
    drop_if_exists unique_index(:customer_accounts, [:business_id, :email])

    execute("ALTER TABLE customer_accounts DROP CONSTRAINT IF EXISTS customer_accounts_customer_id_fkey")
    execute("ALTER TABLE customer_accounts DROP CONSTRAINT IF EXISTS customer_accounts_business_id_fkey")
    execute("ALTER TABLE customer_accounts DROP CONSTRAINT IF EXISTS customer_accounts_owner_id_fkey")

    alter table(:customer_accounts) do
      add :name, :string
      add :phone, :string
      modify :customer_id, :binary_id, null: true, from: :binary_id
      modify :business_id, :binary_id, null: true, from: :binary_id
      modify :owner_id, :binary_id, null: true, from: :binary_id
    end

    create unique_index(:customer_accounts, [:email], name: :customer_accounts_email_uidx)

    # Copy name/phone from primary customer where missing
    execute("""
    UPDATE customer_accounts a
    SET name = COALESCE(a.name, c.name),
        phone = COALESCE(a.phone, c.phone)
    FROM customers c
    WHERE c.customer_account_id = a.id
      AND (a.name IS NULL OR a.phone IS NULL)
    """)
  end

  def down do
    drop_if_exists unique_index(:customer_accounts, [:email], name: :customer_accounts_email_uidx)

    alter table(:customer_accounts) do
      remove :name
      remove :phone
    end

    # Cannot safely restore NOT NULL business_id/customer_id/owner_id without data loss.
    drop_if_exists index(:sales, [:business_id, :source])

    alter table(:sales) do
      remove :source
      modify :cashier_id, :binary_id, null: false, from: :binary_id
    end

    drop_if_exists unique_index(:businesses, [:marketplace_slug], name: :businesses_marketplace_slug_uidx)

    alter table(:businesses) do
      remove :marketplace_enabled
      remove :marketplace_slug
      remove :online_branch_id
    end

    drop_if_exists unique_index(:customers, [:business_id, :customer_account_id],
      name: :customers_business_id_customer_account_id_uidx
    )

    drop_if_exists index(:customers, [:customer_account_id])

    alter table(:customers) do
      remove :customer_account_id
    end
  end
end
