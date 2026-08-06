defmodule Kaarobar.Repo.Migrations.TenancyRbac do
  use Ecto.Migration

  def up do
    alter table(:users) do
      add :totp_enabled_at, :utc_datetime
      add :mfa_required, :boolean, default: false, null: false
    end

    create_if_not_exists index(:memberships, [:user_id, :business_id])
    create_if_not_exists index(:memberships, [:business_id, :status])

    # TEN-FR-008: make audit_logs insert-only at the database level
    execute("""
    CREATE OR REPLACE FUNCTION kaarobar_forbid_audit_mutation()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'audit_logs are immutable';
    END;
    $$ LANGUAGE plpgsql;
    """)

    execute("""
    DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
    """)

    execute("""
    CREATE TRIGGER audit_logs_no_update
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE PROCEDURE kaarobar_forbid_audit_mutation();
    """)
  end

  def down do
    execute("DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;")
    execute("DROP FUNCTION IF EXISTS kaarobar_forbid_audit_mutation();")

    drop_if_exists index(:memberships, [:business_id, :status])
    drop_if_exists index(:memberships, [:user_id, :business_id])

    alter table(:users) do
      remove :totp_enabled_at
      remove :mfa_required
    end
  end
end
