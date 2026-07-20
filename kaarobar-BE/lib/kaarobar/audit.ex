defmodule Kaarobar.Audit do
  @moduledoc """
  Immutable audit trail (TEN-FR-008).
  """

  alias Kaarobar.Repo
  alias Kaarobar.Schemas.AuditLog

  def log(attrs) when is_map(attrs) do
    %AuditLog{}
    |> AuditLog.changeset(attrs)
    |> Repo.insert()
  end

  def log!(attrs) do
    case log(attrs) do
      {:ok, entry} -> entry
      {:error, changeset} -> raise "audit_log_failed: #{inspect(changeset.errors)}"
    end
  end

  def list_for_owner(owner_id, opts \\ []) do
    import Ecto.Query

    limit = Keyword.get(opts, :limit, 100)

    AuditLog
    |> where([a], a.owner_id == ^owner_id)
    |> order_by([a], desc: a.inserted_at)
    |> limit(^limit)
    |> Repo.all()
  end
end
