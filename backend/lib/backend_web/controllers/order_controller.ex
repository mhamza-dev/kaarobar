defmodule KaarobarWeb.OrderController do
  @moduledoc """
  Open tickets: items chosen, money not yet taken.

  One endpoint set serving a restaurant table's running tab, a salon client's
  visit, a laundry job built at the counter, and a retail sale parked while the
  customer fetches their wallet. Billing a ticket goes through
  `POST /sales` with `order_id`, not through here — a ticket becomes a sale by
  being paid for, and only the checkout may write a sale.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Sales

  plug KaarobarWeb.Plugs.Authorize, [permission: "order:view"] when action in [:index, :show]
  plug KaarobarWeb.Plugs.Authorize, [permission: "order:create"] when action in [:create]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "order:edit"] when action in [:add_items, :remove_item, :hold, :resume]

  plug KaarobarWeb.Plugs.Authorize, [permission: "order:cancel"] when action in [:cancel]

  def index(conn, params) do
    orders = Sales.list_orders(conn.assigns.scope, Map.take(params, ~w(status)))

    render(conn, :orders, orders: orders)
  end

  def show(conn, %{"id" => id}) do
    with {:ok, order} <- Sales.fetch_order(conn.assigns.scope, id) do
      render(conn, :order, order: order)
    end
  end

  def create(conn, params) do
    with {:ok, order} <- Sales.create_order(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:order, order: order)
    end
  end

  def add_items(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, order} <- Sales.fetch_order(scope, id),
         {:ok, updated} <- Sales.add_order_items(scope, order, Map.get(params, "items", [])) do
      render(conn, :order, order: updated)
    end
  end

  def remove_item(conn, %{"id" => id, "item_id" => item_id}) do
    scope = conn.assigns.scope

    with {:ok, order} <- Sales.fetch_order(scope, id),
         {:ok, updated} <- Sales.remove_order_item(scope, order, item_id) do
      render(conn, :order, order: updated)
    end
  end

  def hold(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, order} <- Sales.fetch_order(scope, id),
         {:ok, held} <- Sales.hold_order(scope, order) do
      render(conn, :order, order: held)
    end
  end

  def resume(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, order} <- Sales.fetch_order(scope, id),
         {:ok, resumed} <- Sales.resume_order(scope, order) do
      render(conn, :order, order: resumed)
    end
  end

  def cancel(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, order} <- Sales.fetch_order(scope, id),
         {:ok, cancelled} <- Sales.cancel_order(scope, order, Map.get(params, "reason")) do
      render(conn, :order, order: cancelled)
    end
  end
end
