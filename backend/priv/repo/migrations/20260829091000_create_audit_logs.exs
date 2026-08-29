defmodule Kaarobar.Repo.Migrations.CreateAuditLogs do
  use Ecto.Migration

  @moduledoc """
  The append-only record of who did what.

  In a POS this is not a compliance checkbox, it is the thing an owner opens
  when the till is short. Voids, refunds, price overrides, discount approvals,
  stock adjustments and role changes are exactly the actions a dishonest
  employee needs, and all of them are otherwise invisible after the fact.

  Design decisions that follow from that:

    * **No foreign keys.** Every id here is a plain uuid. An audit row is a
      statement about the past and must outlive whatever it describes — a
      deleted product, an erased user. A foreign key would force the choice
      between keeping the row forever and losing the record of its deletion,
      and `ON DELETE SET NULL` would rewrite history to say nobody did it.
    * **Labels are snapshotted.** `actor_label` and `entity_label` hold the
      names as they were, so a renamed user or product still reads correctly.
    * **`changes` holds before and after.** "Ali changed something" is useless;
      "Ali changed price from 450 to 45" is the entire point.
    * **Updates are refused by the database.** A trigger blocks `UPDATE`, so
      tampering requires dropping the trigger rather than issuing a statement.
      `DELETE` is permitted, because retention policies have to be able to
      expire old rows.
  """

  def change do
    create table(:audit_logs, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      # Nullable: failed sign-ins and registrations happen before a tenant is
      # known, and those are exactly the events worth recording.
      add :organization_id, :binary_id
      add :business_id, :binary_id
      add :branch_id, :binary_id

      add :actor_user_id, :binary_id
      add :actor_label, :string
      # "user", "system", "api_client" — separates a nightly job from a person.
      add :actor_type, :string, null: false, default: "user"

      add :action, :string, null: false
      add :entity_type, :string, null: false
      add :entity_id, :binary_id
      add :entity_label, :string

      add :summary, :text
      add :changes, :map
      add :metadata, :map

      add :ip_address, :string
      add :user_agent, :string
      add :request_id, :string

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    # The four ways this table is read: an organization's timeline, one
    # record's history, one person's activity, and one kind of action.
    create index(:audit_logs, [:organization_id, :inserted_at])
    create index(:audit_logs, [:entity_type, :entity_id])
    create index(:audit_logs, [:actor_user_id, :inserted_at])
    create index(:audit_logs, [:business_id, :inserted_at])
    create index(:audit_logs, [:action, :inserted_at])

    create constraint(:audit_logs, :audit_logs_actor_type_check,
             check: "actor_type IN ('user','system','api_client')"
           )

    execute """
            CREATE OR REPLACE FUNCTION audit_logs_reject_update()
            RETURNS trigger AS $$
            BEGIN
              RAISE EXCEPTION 'audit_logs rows are immutable once written';
            END;
            $$ LANGUAGE plpgsql;
            """,
            "DROP FUNCTION IF EXISTS audit_logs_reject_update()"

    execute """
            CREATE TRIGGER audit_logs_no_update
            BEFORE UPDATE ON audit_logs
            FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_update();
            """,
            "DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs"
  end
end
