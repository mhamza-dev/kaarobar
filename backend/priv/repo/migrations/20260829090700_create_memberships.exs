defmodule Kaarobar.Repo.Migrations.CreateMemberships do
  use Ecto.Migration

  @moduledoc """
  A membership binds a person to a tenant and says where they may work.

  `business_id` is nullable, and the distinction is the point:

    * NULL — an organization-wide member. The owner, an administrator, an
      accountant who does the books for every business.
    * set — a member of one business only. The cashier at the clothes shop has
      no visibility of the restaurant next door, even though one owner runs both.

  Branch scoping narrows it further through `membership_branches`. A membership
  with no branch rows covers every branch of its business; with rows, only
  those. That is how a supervisor can be given three of five shops.

  `pin_hash` supports the register flow: staff sharing a terminal switch users
  with a short PIN rather than typing an email and password between customers.
  The PIN is only ever valid on an already-authenticated device — it is a
  convenience over a session, not a credential of its own.
  """

  def change do
    create table(:memberships, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :user_id, references(:users, type: :binary_id, on_delete: :restrict), null: false

      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all)

      add :employee_code, :string
      add :job_title, :string

      add :pin_hash, :string

      add :status, :string, null: false, default: "active"
      add :started_on, :date
      add :ended_on, :date

      add :settings, :map, null: false, default: %{}
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    # Postgres treats NULLs as distinct in a unique index, so a single
    # three-column index would happily allow two org-wide memberships for the
    # same person. Two partial indexes close that.
    create unique_index(:memberships, [:organization_id, :user_id],
             where: "business_id IS NULL AND deleted_at IS NULL",
             name: :memberships_org_wide_unique_index
           )

    create unique_index(:memberships, [:organization_id, :user_id, :business_id],
             where: "business_id IS NOT NULL AND deleted_at IS NULL",
             name: :memberships_business_unique_index
           )

    create index(:memberships, [:user_id])
    create index(:memberships, [:organization_id])
    create index(:memberships, [:business_id])

    create unique_index(:memberships, [:business_id, :employee_code],
             where: "employee_code IS NOT NULL AND deleted_at IS NULL"
           )

    create constraint(:memberships, :memberships_status_check,
             check: "status IN ('invited','active','suspended','ended')"
           )

    create constraint(:memberships, :memberships_dates_check,
             check: "ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on"
           )

    # ---------------------------------------------------------------------
    # Branch scoping
    # ---------------------------------------------------------------------
    create table(:membership_branches, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :membership_id,
          references(:memberships, type: :binary_id, on_delete: :delete_all),
          null: false

      add :branch_id,
          references(:branches, type: :binary_id, on_delete: :delete_all),
          null: false

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create unique_index(:membership_branches, [:membership_id, :branch_id])
    create index(:membership_branches, [:branch_id])
  end
end
