defmodule KaarobarWeb.Plugs.CustomerPortalAuth do
  @moduledoc """
  Authenticates Customer Portal sessions (CUS-FR-008).
  Expects `Authorization: Bearer <session_token>` and `x-business-id`.
  Sets LOCAL app.customer_id when possible.
  """
  import Plug.Conn

  alias Kaarobar.CustomerPortal
  alias Kaarobar.Repo

  def init(opts), do: opts

  def call(conn, _opts) do
    business_id = header(conn, "x-business-id")
    token = bearer_token(conn)

    cond do
      is_nil(business_id) or business_id == "" ->
        forbid(conn, "business_required", 400)

      is_nil(token) ->
        forbid(conn, "unauthorized", 401)

      true ->
        case CustomerPortal.get_account_by_session_token(token) do
          %{business_id: ^business_id} = account ->
            set_customer_local(account.customer_id)

            conn
            |> assign(:portal_account, account)
            |> assign(:portal_customer_id, account.customer_id)
            |> assign(:business_id, business_id)
            |> assign(:owner_id, account.owner_id)
            |> assign(:customer_id, account.customer_id)

          %{business_id: _} ->
            forbid(conn, "forbidden_business", 403)

          nil ->
            forbid(conn, "unauthorized", 401)
        end
    end
  end

  defp set_customer_local(customer_id) when is_binary(customer_id) do
    Repo.query!("SELECT set_config('app.customer_id', $1, true)", [customer_id])
  rescue
    _ -> :ok
  end

  defp bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> String.trim(token)
      _ -> nil
    end
  end

  defp header(conn, name) do
    case get_req_header(conn, name) |> List.first() do
      nil -> nil
      "" -> nil
      value -> value
    end
  end

  defp forbid(conn, reason, status) do
    body = Jason.encode!(%{error: reason})

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(status, body)
    |> halt()
  end
end
