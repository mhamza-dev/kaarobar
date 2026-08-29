defmodule Kaarobar.Idempotency do
  @moduledoc """
  Makes retried writes safe.

  A till on a weak connection sends a checkout, times out waiting, and sends it
  again. Without this the customer is charged twice, stock falls twice, and the
  invoice sequence has a hole. With it, the second request gets the first
  request's answer.

  Three outcomes when a key arrives:

    * **fresh** — claim it and run the work
    * **completed, same request** — replay the stored response; the work is not
      repeated
    * **completed, different request** — refuse. The same key with a different
      payload is a client bug, and answering it with someone else's response
      would be worse than an error
    * **in progress** — refuse with `409`. The original is still running, and
      letting the retry race it is precisely how double charges happen

  Keys expire after a week, swept by a scheduled job.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Idempotency.Key
  alias Kaarobar.Repo

  @type claim ::
          {:ok, Key.t()}
          | {:replay, integer(), map()}
          | {:error, :conflict}
          | {:error, :in_progress}

  @doc """
  Claims a key for a request, or reports what to do instead.
  """
  @spec claim(map()) :: claim()
  def claim(%{organization_id: organization_id, key: key} = attrs) do
    fingerprint = Key.fingerprint(attrs.request_method, attrs.request_path, attrs.body)

    changeset =
      Key.claim_changeset(%Key{}, %{
        organization_id: organization_id,
        user_id: Map.get(attrs, :user_id),
        key: key,
        request_method: attrs.request_method,
        request_path: attrs.request_path,
        request_hash: fingerprint
      })

    case Repo.insert(changeset) do
      {:ok, claimed} -> {:ok, claimed}
      {:error, _changeset} -> existing_verdict(organization_id, key, fingerprint)
    end
  end

  defp existing_verdict(organization_id, key, fingerprint) do
    case fetch(organization_id, key) do
      nil ->
        # Lost a race and the row vanished — treat as a conflict rather than
        # guessing, so nothing runs twice.
        {:error, :conflict}

      %Key{request_hash: stored} when stored != fingerprint ->
        {:error, :conflict}

      %Key{status: "completed"} = existing ->
        {:replay, existing.response_status, existing.response_body || %{}}

      %Key{status: "in_progress"} ->
        {:error, :in_progress}

      %Key{status: "failed"} = existing ->
        # The first attempt errored in a retryable way; let this one proceed.
        {:ok, reopen(existing)}
    end
  end

  defp reopen(%Key{} = existing) do
    {:ok, reopened} =
      existing
      |> Ecto.Changeset.change(status: "in_progress", locked_at: DateTime.utc_now())
      |> Repo.update()

    reopened
  end

  @doc "Stores the response so a retry can replay it."
  @spec complete(Key.t(), integer(), map()) :: :ok
  def complete(%Key{} = key, status, body) do
    key |> Key.complete_changeset(status, body) |> Repo.update()
    :ok
  end

  @doc "Releases a key after a failure that is safe to retry."
  @spec fail(Key.t()) :: :ok
  def fail(%Key{} = key) do
    key |> Key.fail_changeset() |> Repo.update()
    :ok
  end

  @doc "Fetches a stored key."
  @spec fetch(Ecto.UUID.t(), String.t()) :: Key.t() | nil
  def fetch(organization_id, key) do
    Repo.one(
      from stored in Key,
        where: stored.organization_id == ^organization_id and stored.key == ^key
    )
  end

  @doc "Deletes expired keys. Run on a schedule."
  @spec prune_expired() :: {non_neg_integer(), nil}
  def prune_expired do
    now = DateTime.utc_now()
    Repo.delete_all(from key in Key, where: key.expires_at < ^now)
  end
end
