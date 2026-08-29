defmodule Kaarobar.Idempotency.Key do
  @moduledoc """
  A recorded write request, so a retry cannot repeat it.

  See the migration for why this exists. The states are:

    * `in_progress` — the original request is still running. A retry arriving
      now is told to wait rather than racing it, which is the case that
      actually produces double charges.
    * `completed` — the response was captured and is replayed verbatim.
    * `failed` — the request errored in a way that is safe to retry, so the key
      is released rather than pinning the client to a failure forever.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(in_progress completed failed)

  # Long enough to cover a device that was offline for a working week, short
  # enough that the table does not become a second copy of every write.
  @retention_days 7

  schema "idempotency_keys" do
    field :key, :string

    field :request_method, :string
    field :request_path, :string
    field :request_hash, :string

    field :status, :string, default: "in_progress"

    field :response_status, :integer
    field :response_body, :map

    field :locked_at, :utc_datetime_usec
    field :completed_at, :utc_datetime_usec
    field :expires_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :user, User

    timestamps()
  end

  @doc "The states a key may be in."
  def statuses, do: @statuses

  @doc "How long a key is remembered."
  def retention_days, do: @retention_days

  @doc "Changeset claiming a key before the work begins."
  def claim_changeset(key, attrs) do
    key
    |> cast(attrs, [
      :organization_id,
      :user_id,
      :key,
      :request_method,
      :request_path,
      :request_hash
    ])
    |> validate_required([:organization_id, :key, :request_method, :request_path, :request_hash])
    |> validate_length(:key, min: 8, max: 255)
    |> put_change(:status, "in_progress")
    |> put_change(:locked_at, DateTime.utc_now())
    |> put_change(:expires_at, DateTime.add(DateTime.utc_now(), @retention_days * 86_400, :second))
    |> foreign_key_constraint(:organization_id)
    |> unique_constraint([:organization_id, :key],
      message: "has already been used for a different request"
    )
  end

  @doc "Changeset recording the response so a retry can replay it."
  def complete_changeset(key, status, body) do
    change(key,
      status: "completed",
      response_status: status,
      response_body: body,
      completed_at: DateTime.utc_now()
    )
  end

  @doc """
  Changeset releasing a key after a failure that is safe to retry.

  A 500 from a database deadlock should not permanently poison the client's
  key; a 422 from bad input should not either, since the client will fix the
  input and send a new key anyway.
  """
  def fail_changeset(key) do
    change(key, status: "failed", completed_at: DateTime.utc_now())
  end

  @doc """
  Fingerprints a request so that reusing a key with a different payload is
  detected instead of being answered with the wrong stored response.
  """
  @spec fingerprint(String.t(), String.t(), term()) :: String.t()
  def fingerprint(method, path, body) do
    :sha256
    |> :crypto.hash("#{method}\n#{path}\n#{:erlang.term_to_binary(body)}")
    |> Base.encode16(case: :lower)
  end

  @doc "True when the stored response may be replayed."
  def replayable?(%__MODULE__{status: "completed", response_status: status}) when is_integer(status),
    do: true

  def replayable?(%__MODULE__{}), do: false
end
