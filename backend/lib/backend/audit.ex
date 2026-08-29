defmodule Kaarobar.Audit do
  @moduledoc """
  Writes and reads the audit trail.

  Recording is deliberately forgiving: `log/4` never raises and never returns
  an error the caller has to handle. A failure to write an audit row must not
  roll back a completed sale — the customer has paid and left, and refusing the
  transaction because the diary entry failed would be worse than the missing
  diary entry.

  For the same reason, `log/4` is called *inside* the transaction it describes
  wherever the entry only makes sense if the change succeeded. It is a plain
  insert, so it participates in the surrounding transaction and disappears if
  the work is rolled back.
  """

  import Ecto.Query, warn: false

  require Logger

  alias Kaarobar.Audit.Entry
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope

  @doc """
  Records an action.

  `action` reads as `entity.verb` — `"sale.voided"`, `"membership.suspended"`.
  `entity` is the struct the action was performed on.

  ## Options

    * `:summary` — a sentence for a human reading the timeline
    * `:changes` — `%{before: ..., after: ...}`, redacted before writing
    * `:metadata` — anything else worth keeping
    * `:label` — overrides the entity label, which otherwise comes from the
      struct's `name`
  """
  @spec log(Scope.t(), String.t(), struct() | map() | nil, keyword()) :: :ok
  def log(%Scope{} = scope, action, entity \\ nil, opts \\ []) do
    attrs =
      scope
      |> base_attrs()
      |> Map.merge(entity_attrs(entity, opts))
      |> Map.merge(%{
        action: action,
        summary: Keyword.get(opts, :summary),
        changes: redact(Keyword.get(opts, :changes)),
        metadata: Keyword.get(opts, :metadata)
      })

    %Entry{}
    |> Entry.changeset(attrs)
    |> Repo.insert()
    |> case do
      {:ok, _entry} ->
        :ok

      {:error, changeset} ->
        # Losing the trail is bad; losing the transaction is worse.
        Logger.error("audit write failed for #{action}: #{inspect(changeset.errors)}")
        :ok
    end
  end

  @doc """
  Records an action taken by the system rather than a person — a scheduled job,
  a webhook, a gateway callback.
  """
  @spec log_system(String.t(), String.t(), keyword()) :: :ok
  def log_system(action, entity_type, opts \\ []) do
    attrs =
      %{
        actor_type: "system",
        actor_label: Keyword.get(opts, :actor_label, "system"),
        action: action,
        entity_type: entity_type,
        entity_id: Keyword.get(opts, :entity_id),
        organization_id: Keyword.get(opts, :organization_id),
        business_id: Keyword.get(opts, :business_id),
        summary: Keyword.get(opts, :summary),
        metadata: Keyword.get(opts, :metadata)
      }

    %Entry{} |> Entry.changeset(attrs) |> Repo.insert()
    :ok
  end

  @doc """
  Records a security-relevant event that happens before a tenant is known —
  a failed sign-in, a registration, a password reset.
  """
  @spec log_anonymous(String.t(), keyword()) :: :ok
  def log_anonymous(action, opts \\ []) do
    attrs = %{
      actor_type: "system",
      actor_label: Keyword.get(opts, :actor_label),
      action: action,
      entity_type: Keyword.get(opts, :entity_type, "user"),
      entity_id: Keyword.get(opts, :entity_id),
      summary: Keyword.get(opts, :summary),
      metadata: Keyword.get(opts, :metadata),
      ip_address: Keyword.get(opts, :ip_address),
      user_agent: Keyword.get(opts, :user_agent),
      request_id: Keyword.get(opts, :request_id)
    }

    %Entry{} |> Entry.changeset(attrs) |> Repo.insert()
    :ok
  end

  @doc """
  Lists audit entries for the scope's organization, newest first.

  Supports filtering by `entity_type`, `entity_id`, `actor_user_id`, `action`
  and a `from`/`to` window.
  """
  @spec query(Scope.t(), map()) :: Ecto.Query.t()
  def query(%Scope{} = scope, filters \\ %{}) do
    Entry
    |> Scoped.for_organization(scope)
    |> filter_by(filters)
  end

  defp filter_by(query, filters) do
    Enum.reduce(filters, query, fn
      {"entity_type", value}, acc when is_binary(value) ->
        where(acc, [entry], entry.entity_type == ^value)

      {"entity_id", value}, acc when is_binary(value) ->
        where(acc, [entry], entry.entity_id == ^value)

      {"actor_user_id", value}, acc when is_binary(value) ->
        where(acc, [entry], entry.actor_user_id == ^value)

      {"action", value}, acc when is_binary(value) ->
        where(acc, [entry], entry.action == ^value)

      {"business_id", value}, acc when is_binary(value) ->
        where(acc, [entry], entry.business_id == ^value)

      {"from", %DateTime{} = value}, acc ->
        where(acc, [entry], entry.inserted_at >= ^value)

      {"to", %DateTime{} = value}, acc ->
        where(acc, [entry], entry.inserted_at <= ^value)

      _other, acc ->
        acc
    end)
  end

  # --- Internal ---------------------------------------------------------------

  defp base_attrs(%Scope{} = scope) do
    %{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      branch_id: Scope.branch_id(scope),
      actor_user_id: Scope.user_id(scope),
      actor_label: scope.user && scope.user.name,
      actor_type: "user",
      ip_address: scope.remote_ip,
      request_id: scope.request_id
    }
  end

  defp entity_attrs(nil, opts) do
    %{
      entity_type: Keyword.get(opts, :entity_type, "unknown"),
      entity_id: Keyword.get(opts, :entity_id),
      entity_label: Keyword.get(opts, :label)
    }
  end

  defp entity_attrs(entity, opts) when is_struct(entity) do
    %{
      entity_type: Keyword.get(opts, :entity_type, entity_type_of(entity)),
      entity_id: Map.get(entity, :id),
      entity_label: Keyword.get(opts, :label) || Map.get(entity, :name)
    }
  end

  defp entity_type_of(%module{}) do
    module
    |> Module.split()
    |> List.last()
    |> Macro.underscore()
  end

  # Secrets must never reach the audit trail. A "password changed" entry that
  # helpfully records the new password would be the single worst row in the
  # database.
  @redacted_keys ~w(password hashed_password pin pin_hash token secret totp_secret
                    api_key client_secret card_number cvv)

  defp redact(nil), do: nil

  defp redact(changes) when is_map(changes) do
    Map.new(changes, fn {key, value} ->
      cond do
        to_string(key) in @redacted_keys -> {key, "[REDACTED]"}
        is_map(value) -> {key, redact(value)}
        true -> {key, value}
      end
    end)
  end

  defp redact(other), do: other
end
