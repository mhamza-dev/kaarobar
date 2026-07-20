defmodule KaarobarWeb.V1.LeaveController do
  use KaarobarWeb, :controller
  alias Kaarobar.Hr
  alias Kaarobar.Guardian

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id

    attrs = %{
      employee_id: params["employee_id"],
      owner_id: owner_id,
      business_id: business_id,
      type: params["type"] || "annual",
      start_date: params["start_date"],
      end_date: params["end_date"],
      reason: params["reason"],
      status: "Pending"
    }

    case Hr.request_leave(attrs) do
      {:ok, leave} ->
        Kaarobar.Notifications.enqueue(%{
          user_id: user.id,
          owner_id: owner_id,
          channel: "email",
          type: "leave_request",
          payload: %{leave_id: leave.id}
        })

        conn |> put_status(:created) |> json(%{data: leave})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def approve(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)

    case Hr.approve_leave(id, user.id) do
      {:ok, leave} -> json(conn, %{data: leave})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end
end
