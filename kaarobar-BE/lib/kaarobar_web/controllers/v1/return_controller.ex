defmodule KaarobarWeb.V1.ReturnController do
  use KaarobarWeb, :controller
  alias Kaarobar.Pos
  alias Kaarobar.Guardian

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:current_branch_id]

    case Pos.create_return(params["sale_id"], owner_id, business_id, branch_id, user.id, params) do
      {:ok, ret} -> conn |> put_status(:created) |> json(%{data: ret})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def approve(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)

    case Pos.approve_return(id, user.id) do
      {:ok, ret} -> json(conn, %{data: ret})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end
end
