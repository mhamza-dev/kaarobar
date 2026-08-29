defmodule KaarobarWeb.StockOperationsController do
  @moduledoc """
  Transfers between branches, and stock counts.

  Both are two-step by design. A transfer is dispatched and then received,
  because stock on a van belongs to neither branch. A count is submitted and
  then approved, because a stock take is exactly when a typo becomes a
  permanent, unexplained correction.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Inventory
  alias Kaarobar.Repo

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "inventory:view"]
       when action in [:index_transfers, :show_transfer, :index_counts, :show_count]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "stock:transfer"] when action in [:create_transfer, :cancel_transfer]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "stock:transfer_approve"] when action in [:dispatch_transfer]

  plug KaarobarWeb.Plugs.Authorize, [permission: "stock:receive"] when action in [:receive_transfer]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "stock:count"]
       when action in [:create_count, :record_count, :submit_count, :cancel_count]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "stock:count_approve"] when action in [:approve_count]

  # --- Transfers -------------------------------------------------------------

  def index_transfers(conn, params) do
    transfers =
      Inventory.list_transfers(conn.assigns.scope, Map.take(params, ~w(status branch_id)))

    render(conn, :transfers, transfers: transfers)
  end

  def show_transfer(conn, %{"id" => id}) do
    with {:ok, transfer} <- Inventory.fetch_transfer(conn.assigns.scope, id) do
      render(conn, :transfer, transfer: transfer)
    end
  end

  @doc "Creates a transfer in draft. Nothing moves until it is dispatched."
  def create_transfer(conn, params) do
    with {:ok, transfer} <- Inventory.create_transfer(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:transfer, transfer: transfer)
    end
  end

  @doc "Dispatches: the goods leave the source branch and are in transit."
  def dispatch_transfer(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, transfer} <- Inventory.fetch_transfer(scope, id),
         {:ok, dispatched} <- Inventory.dispatch_transfer(scope, transfer) do
      render(conn, :transfer, transfer: dispatched)
    end
  end

  @doc """
  Receives: the goods arrive.

  `received` maps line ids to what actually turned up. A line not mentioned is
  taken as arriving in full, which is the common case and should not require
  retyping every line.
  """
  def receive_transfer(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, transfer} <- Inventory.fetch_transfer(scope, id),
         {:ok, received} <- Inventory.receive_transfer(scope, transfer, Map.get(params, "received", %{})) do
      render(conn, :transfer, transfer: received)
    end
  end

  def cancel_transfer(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, transfer} <- Inventory.fetch_transfer(scope, id),
         {:ok, cancelled} <- Inventory.cancel_transfer(scope, transfer) do
      render(conn, :transfer, transfer: cancelled)
    end
  end

  # --- Counts ----------------------------------------------------------------

  def index_counts(conn, params) do
    counts = Inventory.list_counts(conn.assigns.scope, Map.take(params, ~w(status branch_id)))

    render(conn, :counts, counts: counts)
  end

  def show_count(conn, %{"id" => id}) do
    with {:ok, count} <- Inventory.fetch_count(conn.assigns.scope, id) do
      render(conn, :count, count: count)
    end
  end

  @doc """
  Opens a count, snapshotting what the system currently believes.

  Freezing the expected quantities here is what stops a sale rung up during the
  count becoming a phantom discrepancy.
  """
  def create_count(conn, params) do
    with {:ok, count} <- Inventory.create_count(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:count, count: count)
    end
  end

  @doc "Records what was found on one line."
  def record_count(conn, %{"id" => id, "item_id" => item_id} = params) do
    scope = conn.assigns.scope

    with {:ok, count} <- Inventory.fetch_count(scope, id),
         {:ok, item} <- find_count_item(count, item_id),
         {:ok, _updated} <- Inventory.record_count(scope, item, params),
         {:ok, reloaded} <- Inventory.fetch_count(scope, id) do
      render(conn, :count, count: reloaded)
    end
  end

  @doc "Submits a finished count for approval, with its variance summarised."
  def submit_count(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, count} <- Inventory.fetch_count(scope, id),
         {:ok, submitted} <- Inventory.submit_count(scope, count) do
      render(conn, :count, count: submitted)
    end
  end

  @doc """
  Approves a count, posting one move per differing line.

  Separate permission from counting: the person who counted should not be the
  one who accepts their own correction.
  """
  def approve_count(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, count} <- Inventory.fetch_count(scope, id),
         {:ok, approved} <- Inventory.approve_count(scope, count) do
      render(conn, :count, count: approved)
    end
  end

  def cancel_count(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, count} <- Inventory.fetch_count(scope, id),
         {:ok, cancelled} <- Inventory.cancel_count(scope, count) do
      render(conn, :count, count: cancelled)
    end
  end

  defp find_count_item(count, item_id) do
    case Enum.find(count.items, &(&1.id == item_id)) do
      nil -> {:error, :not_found}
      item -> {:ok, Repo.preload(item, variant: :product)}
    end
  end
end
