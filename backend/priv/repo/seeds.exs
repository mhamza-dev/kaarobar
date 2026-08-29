# Seeds.
#
#     mix run priv/repo/seeds.exs      # or: mix ecto.setup
#
# Two parts:
#
#   * **Reference data** — the permission catalogue and the system role
#     templates. These are not sample data; the application does not work
#     without them, because every membership points at a role row. Always run,
#     idempotent, safe in production.
#
#   * **Demo data** — a worked example organization with one business per
#     vertical. Only when SEED_DEMO=true, and refused outside dev and test.

require Logger

alias Kaarobar.AccessControl

{:ok, permissions} = AccessControl.sync_permissions()
{:ok, role_count} = AccessControl.sync_system_roles()

Logger.info(
  "Seeded #{permissions.inserted} permissions " <>
    "(#{permissions.deleted} removed) and #{role_count} system roles."
)

if System.get_env("SEED_DEMO") in ~w(true 1) do
  case Application.get_env(:backend, :env) do
    env when env in [:dev, :test] ->
      Code.eval_file(Path.join(__DIR__, "seeds/demo.exs"))

    env ->
      Logger.warning("Refusing to seed demo data in #{env}.")
  end
end
