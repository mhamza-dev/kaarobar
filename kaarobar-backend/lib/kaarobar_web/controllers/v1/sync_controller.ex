defmodule KaarobarWeb.V1.SyncController do
  use KaarobarWeb, :controller

  alias Kaarobar.{Guardian, Sync}

  def catalog(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = conn.assigns[:branch_id]

    if is_nil(business_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_branch_required"})
    else
      json(conn, %{data: Sync.catalog(business_id, owner_id, branch_id)})
    end
  end

  def inventory(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = conn.assigns[:branch_id]

    since =
      case params["since"] do
        nil ->
          nil

        str ->
          case DateTime.from_iso8601(str) do
            {:ok, dt, _} -> DateTime.truncate(dt, :second)
            _ -> nil
          end
      end

    if is_nil(business_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_branch_required"})
    else
      json(conn, %{
        data: Sync.inventory_delta(business_id, owner_id, branch_id, since),
        server_time: DateTime.utc_now()
      })
    end
  end

  def push_sales(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]
    sales = params["sales"] || []

    if is_nil(business_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_branch_required"})
    else
      results = Sync.push_sales(branch_id, owner_id, business_id, user.id, sales)
      json(conn, %{data: results})
    end
  end
end
