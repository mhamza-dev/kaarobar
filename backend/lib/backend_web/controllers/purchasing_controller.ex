defmodule KaarobarWeb.PurchasingController do
  @moduledoc """
  Suppliers, purchase orders, deliveries, invoices, payments and returns.

  Every document starts as a draft that changes nothing. Posting a receipt
  moves stock; posting a bill moves the supplier ledger. That is what lets
  someone key a delivery in over an afternoon, and why a mistake caught before
  posting costs nothing.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Purchasing
  alias KaarobarWeb.Pagination

  # --- Suppliers -------------------------------------------------------------

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "supplier:view"]
       when action in [:index_suppliers, :show_supplier, :supplier_ledger, :supplier_products]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "supplier:create"] when action in [:create_supplier]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "supplier:edit"] when action in [:update_supplier, :put_supplier_product]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "supplier:archive"] when action in [:archive_supplier]

  # --- Orders and receipts ---------------------------------------------------

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "purchase_order:view"]
       when action in [:index_orders, :show_order, :index_receipts, :show_receipt]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "purchase_order:create"] when action in [:create_order]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "purchase_order:edit"] when action in [:update_order, :close_order]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "purchase_order:approve"] when action in [:approve_order]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "purchase_order:cancel"] when action in [:cancel_order]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "purchase_order:receive"]
       when action in [:create_receipt, :post_receipt]

  # --- Money -----------------------------------------------------------------

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "supplier_bill:manage"]
       when action in [:index_bills, :show_bill, :create_bill, :post_bill, :ageing]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "supplier_payment:record"] when action in [:record_payment]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "purchase_return:manage"]
       when action in [:index_returns, :show_return, :create_return, :post_return]

  # ===========================================================================
  # Suppliers
  # ===========================================================================

  def index_suppliers(conn, params) do
    suppliers = Purchasing.list_suppliers(conn.assigns.scope, Map.take(params, ~w(q active owing)))

    render(conn, :suppliers, suppliers: suppliers)
  end

  def show_supplier(conn, %{"id" => id}) do
    with {:ok, supplier} <- Purchasing.fetch_supplier(conn.assigns.scope, id) do
      render(conn, :supplier, supplier: supplier)
    end
  end

  def create_supplier(conn, params) do
    with {:ok, supplier} <- Purchasing.create_supplier(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:supplier, supplier: supplier)
    end
  end

  def update_supplier(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, supplier} <- Purchasing.fetch_supplier(scope, id),
         {:ok, updated} <- Purchasing.update_supplier(scope, supplier, params) do
      render(conn, :supplier, supplier: updated)
    end
  end

  @doc "Archives a supplier. Refused while money is still owed to them."
  def archive_supplier(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, supplier} <- Purchasing.fetch_supplier(scope, id),
         {:ok, _archived} <- Purchasing.archive_supplier(scope, supplier) do
      send_resp(conn, :no_content, "")
    end
  end

  @doc "The running account with one supplier."
  def supplier_ledger(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, supplier} <- Purchasing.fetch_supplier(scope, id) do
      render(conn, :ledger,
        supplier: supplier,
        entries: Purchasing.supplier_ledger(scope, supplier)
      )
    end
  end

  def supplier_products(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, supplier} <- Purchasing.fetch_supplier(scope, id) do
      render(conn, :supplier_products,
        supplier_products: Purchasing.list_supplier_products(scope, supplier)
      )
    end
  end

  def put_supplier_product(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, supplier} <- Purchasing.fetch_supplier(scope, id),
         {:ok, record} <- Purchasing.put_supplier_product(scope, supplier, params) do
      conn |> put_status(:created) |> render(:supplier_product, supplier_product: record)
    end
  end

  # ===========================================================================
  # Purchase orders
  # ===========================================================================

  def index_orders(conn, params) do
    {orders, meta} =
      conn.assigns.scope
      |> Purchasing.order_query(Map.take(params, ~w(status supplier_id branch_id open)))
      |> Pagination.page(params)

    render(conn, :orders, orders: orders, meta: meta)
  end

  def show_order(conn, %{"id" => id}) do
    with {:ok, order} <- Purchasing.fetch_order(conn.assigns.scope, id) do
      render(conn, :order, order: order)
    end
  end

  @doc "Creates an order in draft. Moves no stock."
  def create_order(conn, params) do
    with {:ok, order} <- Purchasing.create_order(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:order, order: order)
    end
  end

  def update_order(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, order} <- Purchasing.fetch_order(scope, id),
         {:ok, updated} <- Purchasing.update_order(scope, order, params) do
      render(conn, :order, order: updated)
    end
  end

  @doc "Approves an order: the stock on it becomes expected."
  def approve_order(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, order} <- Purchasing.fetch_order(scope, id),
         {:ok, approved} <- Purchasing.approve_order(scope, order) do
      render(conn, :order, order: approved)
    end
  end

  def cancel_order(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, order} <- Purchasing.fetch_order(scope, id),
         {:ok, cancelled} <- Purchasing.cancel_order(scope, order) do
      render(conn, :order, order: cancelled)
    end
  end

  @doc """
  Closes an order short.

  For the supplier who is never going to send the last twelve units, so the
  order stops holding phantom incoming stock against every reorder suggestion.
  """
  def close_order(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, order} <- Purchasing.fetch_order(scope, id),
         {:ok, closed} <- Purchasing.close_order(scope, order) do
      render(conn, :order, order: closed)
    end
  end

  # ===========================================================================
  # Goods receipts
  # ===========================================================================

  def index_receipts(conn, params) do
    receipts =
      Purchasing.list_receipts(
        conn.assigns.scope,
        Map.take(params, ~w(status supplier_id purchase_order_id))
      )

    render(conn, :receipts, receipts: receipts)
  end

  def show_receipt(conn, %{"id" => id}) do
    with {:ok, receipt} <- Purchasing.fetch_receipt(conn.assigns.scope, id) do
      render(conn, :receipt, receipt: receipt)
    end
  end

  @doc "Records a delivery as a draft. Nothing moves yet."
  def create_receipt(conn, params) do
    with {:ok, receipt} <- Purchasing.create_receipt(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:receipt, receipt: receipt)
    end
  end

  @doc """
  Posts a delivery: stock arrives.

  Creates batches, moves stock at the cost actually charged, writes off
  anything broken, and updates the order behind it — all in one transaction.
  """
  def post_receipt(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, receipt} <- Purchasing.fetch_receipt(scope, id),
         {:ok, posted} <- Purchasing.post_receipt(scope, receipt) do
      render(conn, :receipt, receipt: posted)
    end
  end

  # ===========================================================================
  # Bills, payments and returns
  # ===========================================================================

  def index_bills(conn, params) do
    bills =
      Purchasing.list_bills(
        conn.assigns.scope,
        Map.take(params, ~w(status supplier_id outstanding overdue))
      )

    render(conn, :bills, bills: bills)
  end

  def show_bill(conn, %{"id" => id}) do
    with {:ok, bill} <- Purchasing.fetch_bill(conn.assigns.scope, id) do
      render(conn, :bill, bill: bill)
    end
  end

  def create_bill(conn, params) do
    with {:ok, bill} <- Purchasing.create_bill(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:bill, bill: bill)
    end
  end

  @doc "Posts a bill: the debt becomes real and hits the supplier ledger."
  def post_bill(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, bill} <- Purchasing.fetch_bill(scope, id),
         {:ok, posted} <- Purchasing.post_bill(scope, bill) do
      render(conn, :bill, bill: posted)
    end
  end

  @doc """
  Records a payment, optionally allocating it to bills.

  Anything unallocated stays on account, which is a legitimate state — a shop
  pays a round figure and the bookkeeper decides later what it clears.
  """
  def record_payment(conn, params) do
    with {:ok, payment} <- Purchasing.record_payment(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:payment, payment: payment)
    end
  end

  @doc "What is owed, bucketed against each supplier's own agreed terms."
  def ageing(conn, _params) do
    render(conn, :ageing, ageing: Purchasing.payables_ageing(conn.assigns.scope))
  end

  def index_returns(conn, _params) do
    render(conn, :returns, returns: Purchasing.list_returns(conn.assigns.scope))
  end

  def show_return(conn, %{"id" => id}) do
    with {:ok, record} <- Purchasing.fetch_return(conn.assigns.scope, id) do
      render(conn, :purchase_return, purchase_return: record)
    end
  end

  def create_return(conn, params) do
    with {:ok, record} <- Purchasing.create_return(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:purchase_return, purchase_return: record)
    end
  end

  @doc "Posts a return: stock leaves and the supplier is credited, together."
  def post_return(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, record} <- Purchasing.fetch_return(scope, id),
         {:ok, posted} <- Purchasing.post_return(scope, record) do
      render(conn, :purchase_return, purchase_return: posted)
    end
  end
end
