defmodule Kaarobar.Repo.Migrations.CreateAccessControl do
  use Ecto.Migration

  @moduledoc """
  Roles, permissions, and the two ways they attach to a person.

  Four tables, and the shape of them is what makes the model both safe and
  flexible:

    * `permissions` — the seeded catalogue from
      `Kaarobar.AccessControl.Permissions`, keyed by its string key so that
      `role_permissions` rows are readable in a database console and a typo is
      rejected by a foreign key rather than becoming an unreachable endpoint.
    * `roles` — system templates live once, with `organization_id` NULL, and
      are immutable. Custom roles belong to an organization.
    * `membership_roles` — a person may hold more than one role. Permissions
      are the union; rank is the strongest held.
    * `permission_grants` — per-person exceptions, `allow` or `deny`. A shop
      wants "the cashier, but she can also approve refunds" without inventing a
      role for one person, and "the manager, but not this branch's cash drawer"
      without weakening the manager role for everyone.

  `deny` wins over `allow`, and both win over roles. Revoking one dangerous
  permission from one person must never depend on getting a role edit right.
  """

  def change do
    # ---------------------------------------------------------------------
    # Catalogue
    # ---------------------------------------------------------------------
    create table(:permissions, primary_key: false) do
      add :key, :string, primary_key: true
      add :group, :string, null: false
      add :label, :string, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:permissions, [:group])

    # ---------------------------------------------------------------------
    # Roles
    # ---------------------------------------------------------------------
    create table(:roles, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      # NULL marks a system template shared by every organization.
      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all)

      add :key, :string, null: false
      add :name, :string, null: false
      add :description, :text

      # Lower is more powerful. Prevents a member from assigning a role above
      # their own, which would turn `staff:assign_roles` into `organization:*`.
      add :rank, :integer, null: false, default: 100
      add :is_system, :boolean, null: false, default: false

      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:roles, [:key],
             where: "organization_id IS NULL AND deleted_at IS NULL",
             name: :roles_system_key_index
           )

    create unique_index(:roles, [:organization_id, :key],
             where: "organization_id IS NOT NULL AND deleted_at IS NULL",
             name: :roles_organization_key_index
           )

    create index(:roles, [:organization_id])

    create constraint(:roles, :roles_system_has_no_organization_check,
             check: "(is_system AND organization_id IS NULL) OR (NOT is_system)"
           )

    create constraint(:roles, :roles_rank_check, check: "rank >= 0")

    # ---------------------------------------------------------------------
    # Role contents
    # ---------------------------------------------------------------------
    create table(:role_permissions, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :role_id, references(:roles, type: :binary_id, on_delete: :delete_all), null: false

      add :permission_key,
          references(:permissions, column: :key, type: :string, on_delete: :delete_all),
          null: false

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create unique_index(:role_permissions, [:role_id, :permission_key])
    create index(:role_permissions, [:permission_key])

    # ---------------------------------------------------------------------
    # Assignment
    # ---------------------------------------------------------------------
    create table(:membership_roles, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :membership_id,
          references(:memberships, type: :binary_id, on_delete: :delete_all),
          null: false

      # Restricted: a role still held by someone cannot be deleted out from
      # under them, silently dropping their access.
      add :role_id, references(:roles, type: :binary_id, on_delete: :restrict), null: false

      add :assigned_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create unique_index(:membership_roles, [:membership_id, :role_id])
    create index(:membership_roles, [:role_id])

    # ---------------------------------------------------------------------
    # Per-person exceptions
    # ---------------------------------------------------------------------
    create table(:permission_grants, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :membership_id,
          references(:memberships, type: :binary_id, on_delete: :delete_all),
          null: false

      add :permission_key,
          references(:permissions, column: :key, type: :string, on_delete: :delete_all),
          null: false

      add :effect, :string, null: false

      add :granted_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      # Why this person is an exception. Read during an audit, when nobody
      # remembers.
      add :reason, :text
      add :expires_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:permission_grants, [:membership_id, :permission_key])

    create constraint(:permission_grants, :permission_grants_effect_check,
             check: "effect IN ('allow','deny')"
           )
  end
end
