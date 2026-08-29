defmodule KaarobarWeb.Plugs.LoadScope do
  @moduledoc """
  Builds the request's `%Kaarobar.Scope{}` and assigns it as `:scope`.

  Which tenant the request is acting in comes from, in order of precedence:

  1. path parameters — `/businesses/:business_id/branches/:branch_id/...`
  2. headers — `X-Business-Id`, `X-Branch-Id`, `X-Organization-Id`
  3. the user's only organization, when they have exactly one

  Path parameters win because a URL is unambiguous, whereas a stale header on a
  client that has since switched shops is a real source of cross-branch
  mistakes.

  None of this is trusted. `Kaarobar.Scopes` resolves every id through the
  user's memberships, so naming a tenant the caller does not belong to yields
  `404` — the same answer as naming one that does not exist, because
  distinguishing them would confirm the tenant is real.
  """

  @behaviour Plug

  import Plug.Conn

  require Logger

  alias Kaarobar.Scope
  alias Kaarobar.Scopes
  alias KaarobarWeb.ErrorEnvelope

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(%Plug.Conn{assigns: %{current_user: user}} = conn, _opts) do
    case Scopes.build(user, selection(conn)) do
      {:ok, scope} ->
        scope =
          Scope.put_request_metadata(scope, conn.assigns[:request_id], conn.assigns[:remote_ip])

        Logger.metadata(Scope.logger_metadata(scope))

        assign(conn, :scope, scope)

      {:error, :not_found} ->
        reject(conn)
    end
  end

  def call(conn, _opts), do: reject(conn, :unauthorized)

  defp selection(conn) do
    %{
      organization_id: pick(conn, "organization_id", "x-organization-id"),
      business_id: pick(conn, "business_id", "x-business-id"),
      branch_id: pick(conn, "branch_id", "x-branch-id")
    }
  end

  defp pick(conn, param, header) do
    case conn.path_params[param] do
      value when is_binary(value) and value != "" -> value
      _other -> header_value(conn, header)
    end
  end

  defp header_value(conn, header) do
    case get_req_header(conn, header) do
      [value | _rest] -> String.trim(value)
      [] -> nil
    end
  end

  defp reject(conn, reason \\ :not_found) do
    {status, body} = ErrorEnvelope.for_reason(reason)

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(Plug.Conn.Status.code(status), Jason.encode_to_iodata!(body))
    |> halt()
  end
end
