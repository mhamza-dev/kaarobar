defmodule Kaarobar.Repo.Migrations.CreateSystemRole do
  use Ecto.Migration

  @moduledoc """
  `backend_system` — the one role Row-Level Security does not apply to.

  Used by `Kaarobar.Repo.as_system/1`, which the maintenance and fiscal Oban
  workers use for the handful of jobs that are genuinely cross-tenant by
  design (dunning, fiscal retry, exporting one person's own audit trail across
  every organization it touches): there is no single `app.current_org_id` for
  "every organization's overdue invoice", and RLS exists to catch a query that
  forgot to scope itself to a request's tenant, not to slow down a batch job
  that was never scoped to one.

  `BYPASSRLS` skips row-level *policies* — it grants nothing on its own.
  Without the `GRANT`s below, `backend_system` could `SET ROLE` into
  successfully and then fail every query with `permission denied`, which is a
  worse bug than never having the role at all: it looks like it should work.

  `NOLOGIN` — nothing connects to Postgres *as* `backend_system`; the running
  connection (whatever role `DATABASE_USER` names) switches into it for one
  transaction with `SET LOCAL ROLE` and switches back when the transaction
  ends, which `SET LOCAL` already does on its own.

  A managed Postgres host that does not grant this application's role
  `CREATEROLE` will reject this migration — provision `backend_system` once,
  out of band, with the same `BYPASSRLS NOLOGIN`, the same grant, and the same
  table privileges, and skip straight to the next migration.
  """

  def up do
    execute """
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'backend_system') THEN
        CREATE ROLE backend_system BYPASSRLS NOLOGIN;
      END IF;
    END
    $$
    """

    execute "GRANT backend_system TO CURRENT_USER"

    execute "GRANT USAGE ON SCHEMA public TO backend_system"

    execute "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO backend_system"

    execute "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO backend_system"

    execute """
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO backend_system
    """

    execute """
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO backend_system
    """
  end

  def down do
    execute """
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
      REVOKE USAGE, SELECT ON SEQUENCES FROM backend_system
    """

    execute """
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
      REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM backend_system
    """

    execute "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM backend_system"
    execute "REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM backend_system"
    execute "REVOKE USAGE ON SCHEMA public FROM backend_system"
    execute "REVOKE backend_system FROM CURRENT_USER"
    execute "DROP ROLE IF EXISTS backend_system"
  end
end
