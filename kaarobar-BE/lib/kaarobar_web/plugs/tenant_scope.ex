defmodule KaarobarWeb.Plugs.TenantScope do
  @moduledoc """
  Optional business/branch scoping from headers.
  Business list / dashboard do not require x-business-id.
  Module routes that need a business should check assigns themselves.
  """
  import Plug.Conn

  alias Kaarobar.Tenancy

  def init(opts), do: opts

  def call(conn, _opts) do
    user = Guardian.Plug.current_resource(conn)
    business_id = get_req_header(conn, "x-business-id") |> List.first()
    branch_id = get_req_header(conn, "x-branch-id") |> List.first()

    cond do
      is_nil(user) ->
        conn

      is_nil(business_id) or business_id == "" ->
        conn
        |> assign(:current_user, user)
        |> assign(:current_business_id, nil)
        |> assign(:current_branch_id, nil)
        |> assign(:current_owner_id, user.id)
        |> assign(:business_id, nil)
        |> assign(:branch_id, nil)
        |> assign(:owner_id, user.id)

      Tenancy.user_can_access_business?(user, business_id) ->
        owner_id = Tenancy.owner_id_for_business(business_id) || user.id

        conn
        |> assign(:current_user, user)
        |> assign(:current_business_id, business_id)
        |> assign(:current_branch_id, branch_id)
        |> assign(:current_owner_id, owner_id)
        |> assign(:business_id, business_id)
        |> assign(:branch_id, branch_id)
        |> assign(:owner_id, owner_id)

      true ->
        body = Jason.encode!(%{error: "forbidden_business"})

        conn
        |> put_resp_content_type("application/json")
        |> send_resp(403, body)
        |> halt()
    end
  end
end
