defmodule Kaarobar.Repo.Migrations.CreateInvitations do
  use Ecto.Migration

  @moduledoc """
  Pending staff invitations.

  Invitations exist separately from memberships because the person being
  invited may not have an account yet, and often will not — a shop owner adding
  a new cashier knows their phone number, not whether they have ever used
  Kaarobar. The membership is created when the invitation is accepted, so an
  unaccepted invitation grants nothing and an expired one grants nothing
  forever.

  `branch_ids` is an array rather than a join table on purpose: it is a frozen
  copy of the intent at invite time, not live scoping. The real scoping rows are
  written into `membership_branches` on acceptance.
  """

  def change do
    create table(:invitations, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all)

      add :email, :citext, null: false
      add :name, :string
      add :phone, :string

      add :role_id, references(:roles, type: :binary_id, on_delete: :restrict), null: false
      add :branch_ids, {:array, :binary_id}, null: false, default: []

      add :invited_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      # SHA-256 of the token that was emailed. See user_tokens for the
      # reasoning: what is sent is never what is stored.
      add :token, :binary, null: false

      add :status, :string, null: false, default: "pending"
      add :message, :text

      add :expires_at, :utc_datetime_usec, null: false
      add :accepted_at, :utc_datetime_usec
      add :accepted_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :revoked_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:invitations, [:token])
    create index(:invitations, [:organization_id])
    create index(:invitations, [:email])

    # One outstanding invitation per address per organization. Re-inviting
    # should resend, not accumulate rows that all still work.
    create unique_index(:invitations, [:organization_id, :email],
             where: "status = 'pending'",
             name: :invitations_pending_unique_index
           )

    create constraint(:invitations, :invitations_status_check,
             check: "status IN ('pending','accepted','revoked','expired')"
           )
  end
end
