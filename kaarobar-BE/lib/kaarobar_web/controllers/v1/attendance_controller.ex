defmodule KaarobarWeb.V1.AttendanceController do
  use KaarobarWeb, :controller
  alias Kaarobar.Hr
  alias Kaarobar.Guardian

  def clock_in(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:current_branch_id]

    attrs = %{
      employee_id: params["employee_id"],
      branch_id: branch_id,
      owner_id: owner_id,
      business_id: business_id,
      date: Date.utc_today(),
      source: params["source"] || "pos"
    }

    case Hr.clock_in(attrs) do
      {:ok, rec} -> conn |> put_status(:created) |> json(%{data: rec})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def clock_out(conn, %{"id" => id}) do
    case Hr.clock_out(id) do
      {:ok, rec} -> json(conn, %{data: rec})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end
end
