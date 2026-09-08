defmodule Kaarobar.Repo.Migrations.CreateRestrictedAppRole do
  use Ecto.Migration

  @moduledoc """
  `backend_app` — a Postgres role RLS actually applies to.

  This does **not** change which role the application connects as; see the
  caveat in
  `priv/repo/migrations/20260909000000_enable_row_level_security.exs`'s
  moduledoc. Postgres superusers bypass row-level security unconditionally —
  `FORCE ROW LEVEL SECURITY` only closes the *table owner* exemption, and in
  every environment this application runs in today, the connecting role
  (`DATABASE_USER`, `postgres` by default) is the database's bootstrap
  superuser. No policy, and no amount of `FORCE`, changes that.

  `backend_app` exists so `test/backend/row_level_security_test.exs` can prove
  the *policies themselves* are correct — granted access, not ownership, and
  nowhere near superuser — which is the shape a real production role should
  take. Wiring the application to actually connect (or de-escalate via `SET
  ROLE`) as a role like this one, rather than the bootstrap superuser, is a
  deliberately separate piece of work: it touches connection bootstrapping and
  the ownership of every existing table, and deserves its own change, verified
  against a fresh database rather than folded into this one.
  """

  def up do
    execute """
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'backend_app') THEN
        CREATE ROLE backend_app NOLOGIN;
      END IF;
    END
    $$
    """

    execute "GRANT backend_app TO CURRENT_USER"
    # So a connection already demoted to backend_app can still reach
    # `Kaarobar.Repo.as_system/1`'s `SET ROLE backend_system`.
    execute "GRANT backend_system TO backend_app"

    execute "GRANT USAGE ON SCHEMA public TO backend_app"
    execute "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO backend_app"
    execute "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO backend_app"

    # So the tables the next migration creates are covered without a repeat
    # of these three grants.
    execute """
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO backend_app
    """

    execute """
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO backend_app
    """
  end

  def down do
    execute """
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
      REVOKE USAGE, SELECT ON SEQUENCES FROM backend_app
    """

    execute """
    ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public
      REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM backend_app
    """

    execute "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM backend_app"
    execute "REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM backend_app"
    execute "REVOKE USAGE ON SCHEMA public FROM backend_app"
    execute "REVOKE backend_system FROM backend_app"
    execute "REVOKE backend_app FROM CURRENT_USER"
    execute "DROP ROLE IF EXISTS backend_app"
  end
end
