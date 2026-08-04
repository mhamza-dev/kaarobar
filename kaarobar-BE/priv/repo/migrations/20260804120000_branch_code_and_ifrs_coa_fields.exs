defmodule Kaarobar.Repo.Migrations.BranchCodeAndIfrsCoaFields do
  use Ecto.Migration

  def up do
    alter table(:branches) do
      add :code, :string
    end

    create unique_index(:branches, [:business_id, :code],
             where: "code IS NOT NULL AND code <> ''"
           )

    alter table(:chart_of_accounts) do
      add :normal_balance, :string, default: "debit"
      add :classification, :string
      add :is_header, :boolean, default: false, null: false
    end

    execute("""
    UPDATE branches
    SET code = UPPER(LEFT(REGEXP_REPLACE(COALESCE(name, 'MAIN'), '[^A-Za-z0-9]', '', 'g'), 6))
    WHERE code IS NULL OR code = ''
    """)

    # Deduplicate colliding codes within a business by appending a short suffix
    execute("""
    WITH ranked AS (
      SELECT id,
             business_id,
             code,
             ROW_NUMBER() OVER (PARTITION BY business_id, code ORDER BY inserted_at, id) AS rn
      FROM branches
      WHERE code IS NOT NULL AND code <> ''
    )
    UPDATE branches b
    SET code = LEFT(ranked.code, 4) || LPAD(ranked.rn::text, 2, '0')
    FROM ranked
    WHERE b.id = ranked.id AND ranked.rn > 1
    """)

    execute("""
    UPDATE chart_of_accounts
    SET normal_balance = CASE type
      WHEN 'Asset' THEN 'debit'
      WHEN 'Expense' THEN 'debit'
      WHEN 'Liability' THEN 'credit'
      WHEN 'Equity' THEN 'credit'
      WHEN 'Revenue' THEN 'credit'
      ELSE 'debit'
    END
    WHERE normal_balance IS NULL OR normal_balance = ''
    """)

    execute("""
    UPDATE chart_of_accounts
    SET classification = CASE type
      WHEN 'Asset' THEN 'current_asset'
      WHEN 'Liability' THEN 'current_liability'
      WHEN 'Equity' THEN 'equity'
      WHEN 'Revenue' THEN 'revenue'
      WHEN 'Expense' THEN 'operating_expense'
      ELSE 'operating_expense'
    END
    WHERE classification IS NULL OR classification = ''
    """)
  end

  def down do
    alter table(:chart_of_accounts) do
      remove :is_header
      remove :classification
      remove :normal_balance
    end

    drop_if_exists unique_index(:branches, [:business_id, :code],
                     where: "code IS NOT NULL AND code <> ''"
                   )

    alter table(:branches) do
      remove :code
    end
  end
end
