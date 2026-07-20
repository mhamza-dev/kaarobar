defmodule KaarobarWeb.V1.TillController do
  use KaarobarWeb, :controller
  alias Kaarobar.Pos
  alias Kaarobar.Guardian

  def open(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:current_branch_id]

    case Pos.open_till(branch_id, owner_id, business_id, user.id, params["opening_cash"] || "0") do
      {:ok, till} -> conn |> put_status(:created) |> json(%{data: till})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def close(conn, %{"id" => id} = params) do
    case Pos.close_till(id, params["closing_cash"] || "0") do
      {:ok, till} -> json(conn, %{data: till})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end
end
