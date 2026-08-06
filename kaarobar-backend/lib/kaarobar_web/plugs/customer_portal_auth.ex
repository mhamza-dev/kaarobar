defmodule KaarobarWeb.Plugs.CustomerPortalAuth do
  @moduledoc """
  Authenticates Customer Portal sessions (CUS-FR-008).
  Expects `Authorization: Bearer <session_token>`.
  Optional `x-business-id` scopes membership context.
  """
  import Plug.Conn

  alias Kaarobar.CustomerPortal
  alias Kaarobar.Repo

  def init(opts), do: opts

  def call(conn, _opts) do
    token = bearer_token(conn)
    business_id = header(conn, "x-business-id")

    cond do
      is_nil(token) ->
        forbid(conn, "unauthorized", 401)

      true ->
        case CustomerPortal.get_account_by_session_token(token) do
          nil ->
            forbid(conn, "unauthorized", 401)

          account ->
            membership =
              if is_binary(business_id) do
                CustomerPortal.membership_for(account, business_id)
              else
                nil
              end

            if is_binary(business_id) and is_nil(membership) do
              # Soft scope: allow access; controllers may call ensure_membership
              assign_portal(conn, account, nil, business_id)
            else
              if membership, do: set_customer_local(membership.id)
              assign_portal(conn, account, membership, business_id)
            end
        end
    end
  end

  defp assign_portal(conn, account, membership, business_id) do
    conn
    |> assign(:portal_account, account)
    |> assign(:portal_membership, membership)
    |> assign(:portal_customer_id, membership && membership.id)
    |> assign(:business_id, business_id)
    |> assign(:customer_id, membership && membership.id)
    |> assign(:owner_id, membership && membership.owner_id)
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
