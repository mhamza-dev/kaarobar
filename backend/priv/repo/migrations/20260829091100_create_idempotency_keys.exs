defmodule Kaarobar.Repo.Migrations.CreateIdempotencyKeys do
  use Ecto.Migration

  @moduledoc """
  Replay protection for write endpoints.

  Shop connections drop mid-request. The tablet retries, and without this table
  the customer is charged twice, stock falls twice, and the invoice number
  sequence has a hole in it. A client sends `Idempotency-Key: <uuid>` with any
  write, and a replay of the same key returns the original response instead of
  performing the work again.

  Two details matter:

    * **`request_hash`** fingerprints the method, path and body. If the same key
      arrives with a *different* payload that is a client bug, not a retry, and
      it is rejected rather than being answered with someone else's response.
    * **`status`** distinguishes in-flight from finished. A retry that arrives
      while the first request is still running is told to wait, rather than
      racing it — which is the case that actually produces double charges.

  Rows expire; `expires_at` is swept by a scheduled job.
  """

  def change do
    create table(:idempotency_keys, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :user_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      add :key, :string, null: false

      add :request_method, :string, null: false
      add :request_path, :string, null: false
      add :request_hash, :string, null: false

      add :status, :string, null: false, default: "in_progress"

      add :response_status, :integer
      add :response_body, :map

      add :locked_at, :utc_datetime_usec
      add :completed_at, :utc_datetime_usec
      add :expires_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec)
    end

    # Scoped to the organization: two tenants generating the same uuid must not
    # collide, and one tenant must never read another's stored response.
    create unique_index(:idempotency_keys, [:organization_id, :key])
    create index(:idempotency_keys, [:expires_at])

    create constraint(:idempotency_keys, :idempotency_keys_status_check,
             check: "status IN ('in_progress','completed','failed')"
           )
  end
end
