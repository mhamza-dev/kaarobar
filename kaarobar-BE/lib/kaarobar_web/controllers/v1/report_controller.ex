defmodule KaarobarWeb.V1.ReportController do
  use KaarobarWeb, :controller

  alias Kaarobar.{Accounting, Guardian, Reporting}

  def dashboard(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    json(conn, %{data: Reporting.owner_dashboard(user.id)})
  end

  def trial_balance(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "x-business-id required"})
    else
      from = parse_date_opt(params["from"])
      to = parse_date_opt(params["to"])
      rows = Accounting.trial_balance(business_id, owner_id, from, to)
      json(conn, %{data: rows})
    end
  end

  def general_ledger(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    account_id = params["account_id"]
    from = parse_date(params["from"])
    to = parse_date(params["to"])

    if is_nil(business_id) or is_nil(account_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_account_required"})
    else
      rows = Accounting.general_ledger(business_id, owner_id, account_id, from, to)
      json(conn, %{data: rows})
    end
  end

  def profit_and_loss(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    from = parse_date(params["from"])
    to = parse_date(params["to"])
    opts = if params["branch_id"], do: [branch_id: params["branch_id"]], else: []

    json(conn, %{data: Accounting.profit_and_loss(business_id, owner_id, from, to, opts)})
  end

  def balance_sheet(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    as_of = parse_date(params["as_of"])
    opts = if params["branch_id"], do: [branch_id: params["branch_id"]], else: []

    json(conn, %{data: Accounting.balance_sheet(business_id, owner_id, as_of, opts)})
  end

  def consolidated(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id
    json(conn, %{data: Accounting.consolidated_trial_balance(owner_id)})
  end

  defp parse_date(nil), do: Date.utc_today()

  defp parse_date(str) do
    case Date.from_iso8601(str) do
      {:ok, d} -> d
      _ -> Date.utc_today()
    end
  end

  defp parse_date_opt(nil), do: nil

  defp parse_date_opt(str) do
    case Date.from_iso8601(str) do
      {:ok, d} -> d
      _ -> nil
    end
  end
end
