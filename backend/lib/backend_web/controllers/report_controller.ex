defmodule KaarobarWeb.ReportController do
  @moduledoc """
  The numbers a shopkeeper opens the app to see.

  ## The period is always explicit

  Every action takes `from` and `to` and defaults to the last thirty days when
  they are missing. No endpoint here silently reports "this month" — a figure
  whose period the caller did not choose is a figure they will misread, and
  two clients guessing differently would show two answers for the same shop.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Credit
  alias Kaarobar.Purchasing
  alias Kaarobar.Registers
  alias Kaarobar.Reports
  alias Kaarobar.Reports.Export
  alias Kaarobar.Reports.RollupWorker
  alias Kaarobar.Scope

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "report:sales"]
       when action in [:summary, :daily, :by_branch, :by_tender, :by_hour, :top_products, :by_category]

  plug KaarobarWeb.Plugs.Authorize, [permission: "report:staff"] when action in [:by_cashier]
  plug KaarobarWeb.Plugs.Authorize, [permission: "report:financial"] when action in [:profit]
  plug KaarobarWeb.Plugs.Authorize, [permission: "report:tax"] when action in [:tax]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "report:financial"] when action in [:receivables, :payables]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "shift:view_all"] when action in [:x_report, :z_report]
  plug KaarobarWeb.Plugs.Authorize, [permission: "report:sales"] when action in [:rebuild]
  plug KaarobarWeb.Plugs.Authorize, [permission: "report:export"] when action in [:export]

  def summary(conn, params) do
    scope = conn.assigns.scope
    render(conn, :summary, summary: Reports.summary(scope, period(params), opts(params)))
  end

  def daily(conn, params) do
    scope = conn.assigns.scope
    render(conn, :daily, days: Reports.daily_series(scope, period(params), opts(params)))
  end

  def top_products(conn, params) do
    scope = conn.assigns.scope
    opts = Keyword.put(opts(params), :limit, limit(params, 10))
    render(conn, :rows, rows: Reports.top_products(scope, period(params), opts))
  end

  def by_category(conn, params) do
    scope = conn.assigns.scope
    render(conn, :rows, rows: Reports.sales_by_category(scope, period(params), opts(params)))
  end

  def by_branch(conn, params) do
    scope = conn.assigns.scope
    render(conn, :rows, rows: Reports.sales_by_branch(scope, period(params)))
  end

  def by_tender(conn, params) do
    scope = conn.assigns.scope
    render(conn, :rows, rows: Reports.sales_by_tender(scope, period(params), opts(params)))
  end

  def by_cashier(conn, params) do
    scope = conn.assigns.scope
    render(conn, :rows, rows: Reports.sales_by_cashier(scope, period(params), opts(params)))
  end

  def by_hour(conn, params) do
    scope = conn.assigns.scope
    render(conn, :rows, rows: Reports.sales_by_hour(scope, period(params), opts(params)))
  end

  def profit(conn, params) do
    scope = conn.assigns.scope
    render(conn, :profit, profit: Reports.profit_and_loss(scope, period(params)))
  end

  def tax(conn, params) do
    scope = conn.assigns.scope
    render(conn, :rows, rows: Reports.tax_report(scope, period(params), opts(params)))
  end

  @doc """
  What customers owe, in ageing buckets.

  The total says how bad it is; `by_customer` says where to start, which is
  what a collections round is actually built from.
  """
  def receivables(conn, params) do
    scope = conn.assigns.scope
    opts = as_of(params)

    render(conn, :ageing,
      totals: Credit.ageing(scope, opts),
      by_party: Credit.ageing_by_customer(scope, opts)
    )
  end

  @doc "What the shop owes its suppliers, in the same buckets."
  def payables(conn, _params) do
    render(conn, :payables, payables: Purchasing.payables_ageing(conn.assigns.scope))
  end

  @doc """
  Where a shift stands right now, without closing it.

  Read from the shift's running totals, so it costs one row — which is what
  makes it usable as the mid-afternoon check it is meant to be.
  """
  def x_report(conn, %{"shift_id" => shift_id}) do
    scope = conn.assigns.scope

    with {:ok, shift} <- Registers.fetch_shift(scope, shift_id) do
      render(conn, :shift_report, report: Registers.x_report(scope, shift))
    end
  end

  @doc """
  The same figures, recomputed from the sales themselves.

  The Z report is the one that has to balance, so it is derived a second way
  rather than read from the running totals it is meant to check.
  """
  def z_report(conn, %{"shift_id" => shift_id}) do
    scope = conn.assigns.scope

    with {:ok, shift} <- Registers.fetch_shift(scope, shift_id) do
      render(conn, :shift_report, report: Registers.reconcile_shift(scope, shift))
    end
  end

  @doc """
  Recomputes the rollups behind these figures.

  Queued rather than run inline: a year of days across a dozen branches is not
  a web request, and the answer the caller wants is "it is being redone", not a
  connection held open while it is.
  """
  def rebuild(conn, _params) do
    with {:ok, _job} <- RollupWorker.enqueue(Scope.business_id(conn.assigns.scope)) do
      conn |> put_status(:accepted) |> render(:queued, queued: true)
    end
  end

  @doc """
  Any of the reports above, as a CSV.

  Sent as a file rather than queued to object storage: these are tens to
  hundreds of rows, and a download that arrives now beats a job whose link the
  user has to go and find. A report large enough to need a job is one that
  should be narrowed by date first.
  """
  def export(conn, %{"report" => report} = params) do
    scope = conn.assigns.scope
    {from, to} = period(params)

    with {:ok, name} <- known_report(report),
         columns when is_list(columns) <- Export.columns(name) do
      rows = export_rows(name, scope, {from, to}, opts(params))

      conn
      |> put_resp_content_type("text/csv")
      |> put_resp_header(
        "content-disposition",
        ~s(attachment; filename="#{Export.filename(name, from, to)}")
      )
      |> send_resp(200, Export.to_csv(rows, columns))
    else
      _unknown -> {:error, :not_found}
    end
  end

  defp export_rows(:daily, scope, period, opts), do: Reports.daily_series(scope, period, opts)

  defp export_rows(:top_products, scope, period, opts),
    do: Reports.top_products(scope, period, Keyword.put(opts, :limit, 200))

  defp export_rows(:by_tender, scope, period, opts), do: Reports.sales_by_tender(scope, period, opts)

  defp export_rows(:by_cashier, scope, period, opts),
    do: Reports.sales_by_cashier(scope, period, opts)

  defp export_rows(:by_branch, scope, period, _opts), do: Reports.sales_by_branch(scope, period)

  defp export_rows(:by_category, scope, period, opts),
    do: Reports.sales_by_category(scope, period, opts)

  defp export_rows(:tax, scope, period, opts), do: Reports.tax_report(scope, period, opts)

  # Only the reports named here. `String.to_existing_atom` on a path segment
  # would let a caller probe which atoms the node has, and a typo would crash
  # rather than 404.
  @exportable ~w(daily top_products by_tender by_cashier by_branch by_category tax)

  defp known_report(report) when report in @exportable,
    do: {:ok, String.to_existing_atom(report)}

  defp known_report(_other), do: :error

  # --- Parameters -------------------------------------------------------------

  # Thirty days is the default because it is the window a shop actually talks
  # in — "how was last month?" — and because it is short enough that a missing
  # parameter never accidentally scans a decade.
  defp period(params) do
    to = parse_date(params["to"]) || Date.utc_today()
    from = parse_date(params["from"]) || Date.add(to, -29)

    if Date.compare(from, to) == :gt, do: {to, from}, else: {from, to}
  end

  defp opts(params) do
    case params["branch_id"] do
      id when is_binary(id) and id != "" -> [branch_id: id]
      _absent -> []
    end
  end

  defp limit(params, fallback) do
    case Integer.parse(to_string(params["limit"] || "")) do
      {value, _rest} when value > 0 and value <= 200 -> value
      _other -> fallback
    end
  end

  defp as_of(params) do
    case parse_date(params["as_of"]) do
      nil -> []
      date -> [as_of: date]
    end
  end

  defp parse_date(nil), do: nil

  defp parse_date(value) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, date} -> date
      {:error, _reason} -> nil
    end
  end

  defp parse_date(_value), do: nil
end
