defmodule KaarobarWeb.V1.PayrollController do
  use KaarobarWeb, :controller
  alias Kaarobar.Hr
  alias Kaarobar.Guardian

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    from = Date.from_iso8601!(params["period_start"] || to_string(%Date{Date.utc_today() | day: 1}))
    to = Date.from_iso8601!(params["period_end"] || to_string(Date.utc_today()))

    case Hr.create_payroll_run(business_id, owner_id, from, to) do
      {:ok, run} -> conn |> put_status(:created) |> json(%{data: run})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def submit(conn, %{"id" => id}) do
    case Hr.submit_payroll(id) do
      {:ok, run} -> json(conn, %{data: run})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def approve(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)

    case Hr.approve_payroll(id, user.id) do
      {:ok, run} -> json(conn, %{data: run})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end
end
