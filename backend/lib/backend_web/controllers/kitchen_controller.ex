defmodule KaarobarWeb.KitchenController do
  @moduledoc """
  The kitchen display, and what is sent to it.

  `board` is the endpoint a screen polls all service, so it does the elapsed-
  time arithmetic server-side and returns integers. Every device in a shop has
  a slightly different clock, and the pass and the kitchen disagreeing about
  how long a table has waited is exactly the argument this is meant to end.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Kitchen
  alias Kaarobar.Sales

  plug KaarobarWeb.Plugs.Authorize, module: "kitchen"

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "kitchen:view"] when action in [:board, :stations, :show_ticket]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "kitchen:bump"]
       when action in [:fire, :start, :ready, :bump, :recall, :set_item_status]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "table:manage"]
       when action in [:create_station, :update_station, :delete_station]

  # --- Stations ---------------------------------------------------------------

  def stations(conn, _params) do
    render(conn, :stations, stations: Kitchen.list_stations(conn.assigns.scope))
  end

  def create_station(conn, params) do
    with {:ok, station} <- Kitchen.create_station(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:station, station: station)
    end
  end

  def update_station(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, station} <- Kitchen.fetch_station(scope, id),
         {:ok, updated} <- Kitchen.update_station(scope, station, params) do
      render(conn, :station, station: updated)
    end
  end

  def delete_station(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, station} <- Kitchen.fetch_station(scope, id),
         {:ok, deleted} <- Kitchen.delete_station(scope, station) do
      render(conn, :station, station: deleted)
    end
  end

  # --- The display ------------------------------------------------------------

  @doc "What is live on a screen, most urgent first. Polled all service."
  def board(conn, params) do
    opts =
      []
      |> maybe_put(:station_id, params["station_id"])
      |> maybe_put(:display_group, params["display_group"])

    render(conn, :board, entries: Kitchen.board(conn.assigns.scope, opts))
  end

  def show_ticket(conn, %{"id" => id}) do
    with {:ok, ticket} <- Kitchen.fetch_ticket(conn.assigns.scope, id) do
      render(conn, :ticket, ticket: ticket)
    end
  end

  @doc """
  Sends a course to the kitchen.

  Firing twice is harmless — already-fired lines are skipped — because at a
  busy pass somebody will.
  """
  def fire(conn, %{"order_id" => order_id} = params) do
    scope = conn.assigns.scope

    opts =
      [course: parse_course(params["course"])]
      |> Keyword.put(:priority, params["priority"] == true)
      |> Keyword.put(:notes, params["notes"])

    with {:ok, order} <- Sales.fetch_order(scope, order_id),
         {:ok, tickets} <- Kitchen.fire(scope, order, opts) do
      conn |> put_status(:created) |> render(:tickets, tickets: tickets)
    end
  end

  def start(conn, %{"id" => id}), do: transition(conn, id, &Kitchen.start_ticket/2)
  def ready(conn, %{"id" => id}), do: transition(conn, id, &Kitchen.mark_ready/2)
  def bump(conn, %{"id" => id}), do: transition(conn, id, &Kitchen.bump/2)
  def recall(conn, %{"id" => id}), do: transition(conn, id, &Kitchen.recall/2)

  @doc "Marks one dish done without touching the rest of the ticket."
  def set_item_status(conn, %{"id" => id, "item_id" => item_id, "status" => status}) do
    scope = conn.assigns.scope

    with {:ok, ticket} <- Kitchen.fetch_ticket(scope, id),
         {:ok, _item} <- Kitchen.set_item_status(scope, ticket, item_id, status),
         {:ok, reloaded} <- Kitchen.fetch_ticket(scope, id) do
      render(conn, :ticket, ticket: reloaded)
    end
  end

  defp transition(conn, id, fun) do
    scope = conn.assigns.scope

    with {:ok, ticket} <- Kitchen.fetch_ticket(scope, id),
         {:ok, _updated} <- fun.(scope, ticket),
         {:ok, reloaded} <- Kitchen.fetch_ticket(scope, id) do
      render(conn, :ticket, ticket: reloaded)
    end
  end

  defp parse_course(nil), do: 1
  defp parse_course(value) when is_integer(value), do: value

  defp parse_course(value) when is_binary(value) do
    case Integer.parse(value) do
      {course, ""} -> course
      _other -> 1
    end
  end

  defp parse_course(_value), do: 1

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)
end
