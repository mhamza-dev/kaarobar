defmodule Kaarobar.Repo.Migrations.CreateUsers do
  use Ecto.Migration

  @moduledoc """
  Global user identities.

  A user is a person, not a member of staff. The same person may own one
  organization, cashier at a friend's shop and audit a third — one login, three
  memberships. That is why this table carries no `organization_id`: the link
  between a person and a tenant lives in `memberships`.
  """

  def change do
    create table(:users, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :email, :citext, null: false
      add :hashed_password, :string
      add :name, :string, null: false
      add :phone, :string
      add :avatar_url, :string

      add :locale, :string, null: false, default: "en"
      add :timezone, :string, null: false, default: "UTC"

      add :confirmed_at, :utc_datetime_usec
      # Encrypted at rest via Kaarobar.Encrypted.Binary.
      add :totp_secret, :binary
      add :totp_confirmed_at, :utc_datetime_usec

      add :status, :string, null: false, default: "active"

      add :last_login_at, :utc_datetime_usec
      # Throttles credential stuffing without locking a real user out for long.
      add :failed_login_count, :integer, null: false, default: 0
      add :locked_until, :utc_datetime_usec

      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    # citext makes this case-insensitive: Ali@shop.pk and ali@shop.pk are one
    # account. Soft-deleted users release their address for reuse.
    create unique_index(:users, [:email], where: "deleted_at IS NULL", name: :users_email_index)

    create constraint(:users, :users_status_check,
             check: "status IN ('active','suspended','deleted')"
           )

    create constraint(:users, :users_failed_login_count_check,
             check: "failed_login_count >= 0"
           )
  end
end
