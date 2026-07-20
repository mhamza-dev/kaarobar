defmodule KaarobarWeb.V1.ReportController do
  use KaarobarWeb, :controller
  alias Kaarobar.{Reporting, Accounting, Guardian}

  def dashboard(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    json(conn, %{data: Reporting.owner_dashboard(user.id)})
  end

  def trial_balance(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "x-business-id required"})
    else
      rows = Accounting.trial_balance(business_id, owner_id)
      json(conn, %{data: rows})
    end
  end

  def profit_and_loss(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    from = parse_date(params["from"])
    to = parse_date(params["to"])

    json(conn, %{data: Accounting.profit_and_loss(business_id, owner_id, from, to)})
  end

  def balance_sheet(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    as_of = parse_date(params["as_of"])
    json(conn, %{data: Accounting.balance_sheet(business_id, owner_id, as_of)})
  end

  defp parse_date(nil), do: Date.utc_today()
  defp parse_date(str) do
    case Date.from_iso8601(str) do
      {:ok, d} -> d
      _ -> Date.utc_today()
    end
  end
end
