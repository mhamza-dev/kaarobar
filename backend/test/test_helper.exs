# Reference data — the permission catalogue and system role templates — is
# seeded once, in `:auto` mode, so it is committed to the test database and
# visible to every test. It is not fixture data: a membership without a role
# row is not a valid membership, so seeding it per test would be both slow and
# a lie about how the system is set up.
#
# The sync is idempotent, so repeated runs cost one upsert.
Ecto.Adapters.SQL.Sandbox.mode(Kaarobar.Repo, :auto)

{:ok, _permissions} = Kaarobar.AccessControl.sync_permissions()
{:ok, _roles} = Kaarobar.AccessControl.sync_system_roles()

Ecto.Adapters.SQL.Sandbox.mode(Kaarobar.Repo, :manual)

ExUnit.start()
