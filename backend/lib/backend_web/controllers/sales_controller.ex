defmodule KaarobarWeb.SalesController do
  @moduledoc """
  The till.

  `POST /sales` is the busiest and most consequential endpoint in the system —
  it is the one a shop's day is made of, and the one that must never charge a
  customer twice. Retries carry an `Idempotency-Key`, which the pipeline plug
  persists with its response so a dropped connection is replayed rather than
  re-rung.

  Voids and refunds are separate endpoints with separate permissions, because
  reversing money is not the same act as taking it, and in most shops it is not
  the same person's job.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Sales
  alias Kaarobar.Sales.Checkout
  alias KaarobarWeb.Pagination

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "sales:checkout"] when action in [:create, :preview]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "sale:view"] when action in [:index, :show, :by_number, :returns]

  plug KaarobarWeb.Plugs.Authorize, [permission: "sale:void"] when action in [:void]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "sale:refund_request"]
       when action in [:create_refund_request, :index_refund_requests, :show_refund_request]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "sale:refund_approve"] when action in [:approve_refund, :reject_refund, :refund]

  # ===========================================================================
  # Selling
  # ===========================================================================

  @doc """
  Prices a basket without committing anything.

  What the till shows as items are added. Takes no stock and writes nothing, so
  it is safe on every keystroke.
  """
  def preview(conn, params) do
    with {:ok, summary} <- Checkout.preview(conn.assigns.scope, params) do
      render(conn, :quote, quote: summary)
    end
  end

  @doc "Completes a sale. One transaction: stock, tenders, ledger, shift."
  def create(conn, params) do
    with {:ok, sale} <- Checkout.run(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:sale, sale: sale)
    end
  end

  def index(conn, params) do
    {sales, meta} =
      conn.assigns.scope
      |> Sales.query(sale_filters(params))
      |> Pagination.page(params)

    render(conn, :sales, sales: sales, meta: meta)
  end

  def show(conn, %{"id" => id}) do
    with {:ok, sale} <- Sales.fetch_sale(conn.assigns.scope, id) do
      render(conn, :sale, sale: sale)
    end
  end

  @doc "Finds a sale by the number a customer is reading off their receipt."
  def by_number(conn, %{"number" => number}) do
    with {:ok, sale} <- Sales.fetch_sale_by_number(conn.assigns.scope, number) do
      render(conn, :sale, sale: sale)
    end
  end

  # ===========================================================================
  # Undoing
  # ===========================================================================

  @doc "Voids a whole sale. A reason is required and is recorded against it."
  def void(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, sale} <- Sales.fetch_sale(scope, id),
         {:ok, voided} <- Sales.void_sale(scope, sale, Map.get(params, "reason")) do
      render(conn, :sale, sale: voided)
    end
  end

  @doc "Takes goods back and gives money back, against an approved request."
  def refund(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, sale} <- Sales.fetch_sale(scope, id),
         {:ok, record} <- Sales.process_return(scope, sale, params) do
      conn |> put_status(:created) |> render(:sale_return, sale_return: record)
    end
  end

  def returns(conn, params) do
    returns = Sales.list_returns(conn.assigns.scope, Map.take(params, ~w(sale_id)))

    render(conn, :sale_returns, sale_returns: returns)
  end

  # ===========================================================================
  # Refund requests
  # ===========================================================================

  def create_refund_request(conn, %{"sale_id" => sale_id} = params) do
    scope = conn.assigns.scope

    with {:ok, sale} <- Sales.fetch_sale(scope, sale_id),
         {:ok, request} <- Sales.create_refund_request(scope, sale, params) do
      conn |> put_status(:created) |> render(:refund_request, refund_request: request)
    end
  end

  def index_refund_requests(conn, params) do
    requests = Sales.list_refund_requests(conn.assigns.scope, Map.take(params, ~w(status)))

    render(conn, :refund_requests, refund_requests: requests)
  end

  def show_refund_request(conn, %{"id" => id}) do
    with {:ok, request} <- Sales.fetch_refund_request(conn.assigns.scope, id) do
      render(conn, :refund_request, refund_request: request)
    end
  end

  def approve_refund(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, request} <- Sales.fetch_refund_request(scope, id),
         {:ok, approved} <-
           Sales.approve_refund_request(scope, request, Map.get(params, "note")) do
      render(conn, :refund_request, refund_request: approved)
    end
  end

  def reject_refund(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, request} <- Sales.fetch_refund_request(scope, id),
         {:ok, rejected} <-
           Sales.reject_refund_request(scope, request, Map.get(params, "note")) do
      render(conn, :refund_request, refund_request: rejected)
    end
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  # Dates arrive as strings and are only useful to the query as `Date`s. An
  # unparseable one is dropped rather than rejected: a stale bookmark should
  # return today's sales, not an error.
  defp sale_filters(params) do
    params
    |> Map.take(~w(status branch_id customer_id shift_id from to))
    |> Enum.reduce(%{}, fn
      {key, value}, acc when key in ~w(from to) ->
        case Date.from_iso8601(to_string(value)) do
          {:ok, date} -> Map.put(acc, key, date)
          {:error, _reason} -> acc
        end

      {key, value}, acc ->
        Map.put(acc, key, value)
    end)
  end
end
