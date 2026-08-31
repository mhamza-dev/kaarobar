defmodule KaarobarWeb.DeliveryController do
  @moduledoc """
  Orders going out on bikes.

  Assigning a rider is gated apart from updating a status, because they are
  different jobs: a rider marks their own drop delivered from a phone; deciding
  whose round an order joins is the counter's call.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Deliveries

  plug KaarobarWeb.Plugs.Authorize, module: "delivery"

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "delivery:view"] when action in [:index, :show, :rider_board]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "delivery:assign"] when action in [:create, :assign]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "delivery:update"]
       when action in [:pick_up, :deliver, :fail, :cancel]

  def index(conn, params) do
    opts =
      []
      |> maybe_put(:status, params["status"])
      |> maybe_put(:rider_user_id, params["rider_user_id"])

    render(conn, :deliveries, deliveries: Deliveries.live(conn.assigns.scope, opts))
  end

  @doc "What each rider is carrying. The question a shop asks on a Friday night."
  def rider_board(conn, _params) do
    render(conn, :rider_board, rounds: Deliveries.rider_board(conn.assigns.scope))
  end

  def show(conn, %{"id" => id}) do
    with {:ok, delivery} <- Deliveries.fetch(conn.assigns.scope, id) do
      render(conn, :delivery, delivery: delivery)
    end
  end

  def create(conn, params) do
    with {:ok, delivery} <- Deliveries.create(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:delivery, delivery: delivery)
    end
  end

  def assign(conn, %{"id" => id, "rider_user_id" => rider_id}) do
    scope = conn.assigns.scope

    with {:ok, delivery} <- Deliveries.fetch(scope, id),
         {:ok, assigned} <- Deliveries.assign(scope, delivery, rider_id) do
      render(conn, :delivery, delivery: assigned)
    end
  end

  def pick_up(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, delivery} <- Deliveries.fetch(scope, id),
         {:ok, out} <- Deliveries.pick_up(scope, delivery) do
      render(conn, :delivery, delivery: out)
    end
  end

  @doc "Delivered, with whatever the rider collected at the door."
  def deliver(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, delivery} <- Deliveries.fetch(scope, id),
         {:ok, done} <- Deliveries.deliver(scope, delivery, parse_money(params["collected"])) do
      render(conn, :delivery, delivery: done)
    end
  end

  def fail(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, delivery} <- Deliveries.fetch(scope, id),
         {:ok, failed} <- Deliveries.fail(scope, delivery, params["reason"]) do
      render(conn, :delivery, delivery: failed)
    end
  end

  def cancel(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, delivery} <- Deliveries.fetch(scope, id),
         {:ok, cancelled} <- Deliveries.cancel(scope, delivery) do
      render(conn, :delivery, delivery: cancelled)
    end
  end

  defp parse_money(nil), do: nil

  defp parse_money(value) do
    case Kaarobar.Money.cast(value) do
      {:ok, amount} -> amount
      :error -> nil
    end
  end

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)
end
