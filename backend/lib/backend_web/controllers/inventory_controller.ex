defmodule KaarobarWeb.InventoryController do
  @moduledoc """
  Stock levels, the movement ledger, batches, and what it is all worth.

  `reconcile/2` is the endpoint an accountant cares about: it puts the
  projected valuation, the ledger valuation and the FIFO layers side by side,
  and says whether they agree. A stock figure nobody can tie back to the
  movements behind it is one nobody will sign off.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Inventory
  alias KaarobarWeb.Pagination

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "inventory:view"]
       when action in [:index, :show, :moves, :ledger, :batches, :expiring, :serials, :reorder]

  plug KaarobarWeb.Plugs.Authorize, [permission: "valuation:view"] when action in [:valuation, :reconcile]
  plug KaarobarWeb.Plugs.Authorize, [permission: "stock:adjust"] when action in [:adjust, :opening]
  plug KaarobarWeb.Plugs.Authorize, [permission: "stock:wastage"] when action in [:write_off]
  plug KaarobarWeb.Plugs.Authorize, [permission: "reorder:manage"] when action in [:update_settings]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "batch:manage"] when action in [:create_batch, :set_batch_status]

  @stock_filters ~w(branch_id variant_id category_id low_stock in_stock q)
  @move_filters ~w(branch_id variant_id batch_id kind)

  @doc "Lists stock levels."
  def index(conn, params) do
    {items, meta} =
      conn.assigns.scope
      |> Inventory.stock_query(Map.take(params, @stock_filters))
      |> Pagination.page(params)

    render(conn, :index, stock_items: items, meta: meta)
  end

  @doc "The stock level for one variant at one branch."
  def show(conn, %{"variant_id" => variant_id, "branch_id" => branch_id}) do
    with {:ok, item} <- Inventory.fetch_stock_item(conn.assigns.scope, variant_id, branch_id) do
      render(conn, :show, stock_item: item)
    end
  end

  @doc "Updates the reorder settings for a stock line."
  def update_settings(conn, %{"variant_id" => variant_id, "branch_id" => branch_id} = params) do
    scope = conn.assigns.scope

    with {:ok, item} <- Inventory.fetch_stock_item(scope, variant_id, branch_id),
         {:ok, updated} <- Inventory.update_stock_settings(scope, item, params) do
      render(conn, :show, stock_item: updated)
    end
  end

  @doc "The movement history, filtered and paginated."
  def moves(conn, params) do
    {moves, meta} =
      conn.assigns.scope
      |> Inventory.move_query(Map.take(params, @move_filters))
      |> Pagination.page(params)

    render(conn, :moves, moves: moves, meta: meta)
  end

  @doc """
  The full ledger for one variant at one branch, oldest first.

  Read as a running account: each row's `balance_after` should follow from the
  one above it.
  """
  def ledger(conn, %{"variant_id" => variant_id, "branch_id" => branch_id}) do
    moves = Inventory.variant_ledger(conn.assigns.scope, variant_id, branch_id)

    render(conn, :ledger, moves: moves)
  end

  @doc "Corrects a stock level. A reason is required."
  def adjust(conn, params) do
    with {:ok, move} <- Inventory.adjust(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:move, move: move)
    end
  end

  @doc "Writes stock off — breakage, spoilage, theft."
  def write_off(conn, params) do
    with {:ok, move} <- Inventory.write_off(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:move, move: move)
    end
  end

  @doc "Records the stock a business is starting with."
  def opening(conn, params) do
    with {:ok, move} <- Inventory.set_opening_stock(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:move, move: move)
    end
  end

  @doc "Lists batches."
  def batches(conn, params) do
    batches =
      Inventory.list_batches(conn.assigns.scope, Map.take(params, ~w(variant_id status in_stock)))

    render(conn, :batches, batches: batches)
  end

  @doc "Creates a batch, for opening stock or a correction."
  def create_batch(conn, params) do
    with {:ok, batch} <- Inventory.create_batch(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:batch, batch: batch)
    end
  end

  @doc """
  Quarantines or recalls a batch.

  Takes that lot out of every pick list at once — a recall announced this
  morning has to stop it being sold this afternoon, across every branch.
  """
  def set_batch_status(conn, %{"id" => id, "status" => status}) do
    scope = conn.assigns.scope

    with {:ok, batch} <- Inventory.fetch_batch(scope, id),
         {:ok, updated} <- Inventory.set_batch_status(scope, batch, status) do
      render(conn, :batch, batch: updated)
    end
  end

  def set_batch_status(_conn, _params), do: {:error, :unprocessable_entity}

  @doc "Batches expiring soon, soonest first."
  def expiring(conn, params) do
    days = params |> Map.get("days", "30") |> parse_days()

    render(conn, :batches, batches: Inventory.expiring_batches(conn.assigns.scope, days))
  end

  @doc "Lists individually tracked units."
  def serials(conn, params) do
    serials =
      Inventory.list_serials(conn.assigns.scope, Map.take(params, ~w(variant_id status branch_id)))

    render(conn, :serials, serials: serials)
  end

  @doc "What the stock is worth."
  def valuation(conn, params) do
    render(conn, :valuation,
      valuation: Inventory.valuation(conn.assigns.scope, Map.take(params, @stock_filters))
    )
  end

  @doc """
  The projected, ledger and layer valuations side by side.

  `balanced` is the answer: quantities must agree exactly, because the
  projection is the sum of the moves.
  """
  def reconcile(conn, params) do
    render(conn, :reconcile,
      reconciliation: Inventory.reconcile(conn.assigns.scope, Map.take(params, @stock_filters))
    )
  end

  @doc "Stock at or below its reorder point, with a suggested order quantity."
  def reorder(conn, params) do
    render(conn, :reorder,
      suggestions: Inventory.reorder_suggestions(conn.assigns.scope, Map.take(params, @stock_filters))
    )
  end

  defp parse_days(value) do
    case Integer.parse(to_string(value)) do
      {days, _rest} when days > 0 and days <= 365 -> days
      _other -> 30
    end
  end
end
