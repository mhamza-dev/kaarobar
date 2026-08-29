defmodule Kaarobar.Repo.Migrations.CreateUserTokens do
  use Ecto.Migration

  @moduledoc """
  Bearer tokens, password resets, email confirmations and invitations.

  Only the SHA-256 hash of a token is stored. A leaked database therefore
  yields no usable sessions — the same reason passwords are hashed, applied to
  the credential that is actually sent on every request.

  One row per device gives the two properties a shop needs: a stolen tablet can
  be revoked without disturbing the counter, and "sign out everywhere" is one
  `DELETE`.
  """

  def change do
    create table(:user_tokens, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false

      add :token, :binary, null: false
      add :context, :string, null: false
      # The address a reset or confirmation was sent to, so a token stops
      # working if the user changes their email before using it.
      add :sent_to, :string

      add :device_name, :string
      add :user_agent, :string
      add :ip_address, :string

      add :last_used_at, :utc_datetime_usec
      add :expires_at, :utc_datetime_usec
      add :revoked_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create unique_index(:user_tokens, [:context, :token])
    create index(:user_tokens, [:user_id])
    # Supports the scheduled sweep of expired rows.
    create index(:user_tokens, [:expires_at])

    create constraint(:user_tokens, :user_tokens_context_check,
             check: "context IN ('session','api','reset_password','confirm','invite')"
           )
  end
end
