defmodule KaarobarWeb.AuditController do
  @moduledoc """
  Reads the audit trail.

  Cursor paginated like every other list. The trail is the fastest-growing
  table in the system, and offset pagination over it degrades exactly when
  someone is trying to investigate something.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Audit
  alias KaarobarWeb.Pagination

  plug KaarobarWeb.Plugs.Authorize, permission: "audit:view"

  @doc """
  Lists audit entries, newest first.

  Filterable by `entity_type`, `entity_id`, `actor_user_id`, `action`,
  `business_id`, and a `from`/`to` window.
  """
  def index(conn, params) do
    {entries, meta} =
      conn.assigns.scope
      |> Audit.query(filters(params))
      |> Pagination.page(params)

    render(conn, :index, entries: entries, meta: meta)
  end

  @filter_keys ~w(entity_type entity_id actor_user_id action business_id)

  defp filters(params) do
    params
    |> Map.take(@filter_keys)
    |> put_time("from", params["from"])
    |> put_time("to", params["to"])
  end

  defp put_time(filters, _key, nil), do: filters

  defp put_time(filters, key, value) do
    case DateTime.from_iso8601(value) do
      {:ok, datetime, _offset} -> Map.put(filters, key, datetime)
      # An unparseable date is ignored rather than rejected: a filter the user
      # typed wrong should show them everything, not an error page.
      {:error, _reason} -> filters
    end
  end
end
