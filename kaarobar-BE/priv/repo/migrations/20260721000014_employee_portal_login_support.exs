defmodule Kaarobar.Repo.Migrations.EmployeePortalLoginSupport do
  use Ecto.Migration

  def up do
    # Deduplicate existing employee↔user links before enforcing uniqueness.
    # Keep the earliest employee row per user_id; clear user_id on the rest.
    execute("""
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY inserted_at ASC, id ASC) AS rn
      FROM employees
      WHERE user_id IS NOT NULL
    )
    UPDATE employees e
    SET user_id = NULL
    FROM ranked r
    WHERE e.id = r.id AND r.rn > 1
    """)

    # One portal login maps to at most one HR employee profile (ESS / staff tools).
    create unique_index(:employees, [:user_id],
      name: :employees_user_id_unique,
      where: "user_id IS NOT NULL"
    )

    # Deduplicate business-wide memberships (NULL branch_id) before unique index.
    execute("""
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY user_id, business_id
               ORDER BY inserted_at ASC, id ASC
             ) AS rn
      FROM memberships
      WHERE branch_id IS NULL
    )
    DELETE FROM memberships m
    USING ranked r
    WHERE m.id = r.id AND r.rn > 1
    """)

    # PostgreSQL treats NULL as distinct in unique indexes, so business-wide
    # memberships (branch_id IS NULL) could be duplicated. Enforce one per user/business.
    create unique_index(:memberships, [:user_id, :business_id],
      name: :memberships_user_business_null_branch_uidx,
      where: "branch_id IS NULL"
    )

    # Helpful lookup for "which employee is this logged-in user?"
    create index(:employees, [:business_id, :user_id],
      name: :employees_business_user_id_index,
      where: "user_id IS NOT NULL"
    )
  end

  def down do
    drop_if_exists index(:employees, [:business_id, :user_id],
      name: :employees_business_user_id_index
    )

    drop_if_exists index(:memberships, [:user_id, :business_id],
      name: :memberships_user_business_null_branch_uidx
    )

    drop_if_exists index(:employees, [:user_id], name: :employees_user_id_unique)
  end
end
