defmodule KaarobarWeb.CreditController do
  @moduledoc """
  What customers owe, invoice by invoice.

  Separate from `KaarobarWeb.CustomerController` because the permissions are
  different jobs: knowing who a customer is, and knowing what they owe and
  applying money to it, are not the same trust.

  Allocation is gated apart from recording a payment. A cashier can take money
  over the counter; deciding *which invoice it settles* changes what the ageing
  report says and who gets chased, so it is a separate grant.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Credit
  alias Kaarobar.Customers

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "credit:view"]
       when action in [:invoices, :overdue, :ageing, :by_customer, :statement, :allocations]

  plug KaarobarWeb.Plugs.Authorize, [permission: "credit:allocate"] when action in [:allocate]

  @doc "Unpaid credit sales, oldest first."
  def invoices(conn, params) do
    invoices = Credit.open_invoices(conn.assigns.scope, invoice_opts(params))
    render(conn, :invoices, invoices: invoices)
  end

  @doc "The collections list: anything past its own due date, worst first."
  def overdue(conn, params) do
    invoices = Credit.overdue_invoices(conn.assigns.scope, invoice_opts(params))
    render(conn, :invoices, invoices: invoices)
  end

  def ageing(conn, params) do
    render(conn, :ageing, ageing: Credit.ageing(conn.assigns.scope, invoice_opts(params)))
  end

  @doc "The same buckets per customer — what a collections round is built from."
  def by_customer(conn, params) do
    rows = Credit.ageing_by_customer(conn.assigns.scope, invoice_opts(params))
    render(conn, :by_customer, rows: rows)
  end

  def statement(conn, %{"customer_id" => customer_id} = params) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id) do
      opts = if from = parse_date(params["from"]), do: [from: from], else: []
      render(conn, :statement, statement: Credit.statement(scope, customer, opts))
    end
  end

  @doc "Which payments settled one invoice."
  def allocations(conn, %{"sale_id" => sale_id}) do
    allocations = Credit.allocations_for_sale(conn.assigns.scope, sale_id)
    render(conn, :allocations, allocations: allocations)
  end

  @doc """
  Applies a recorded payment to particular invoices.

  `allocations` maps sale ids to amounts. `auto` spreads whatever is
  unallocated over the oldest invoices instead — a guess the caller is choosing
  to make, which is why it has to be asked for.
  """
  def allocate(conn, %{"payment_id" => payment_id} = params) do
    scope = conn.assigns.scope

    with {:ok, payment} <- Customers.fetch_payment(scope, payment_id),
         {:ok, written} <- run_allocation(scope, payment, params) do
      conn |> put_status(:created) |> render(:allocations, allocations: written)
    end
  end

  defp run_allocation(scope, payment, %{"auto" => true}), do: Credit.auto_allocate(scope, payment)

  defp run_allocation(scope, payment, params),
    do: Credit.allocate(scope, payment, Map.get(params, "allocations", %{}))

  defp invoice_opts(params) do
    []
    |> maybe_put(:customer_id, params["customer_id"])
    |> maybe_put(:as_of, parse_date(params["as_of"]))
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)

  defp parse_date(nil), do: nil

  defp parse_date(value) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, date} -> date
      {:error, _reason} -> nil
    end
  end

  defp parse_date(_value), do: nil
end
