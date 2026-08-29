defmodule KaarobarWeb.FollowUpController do
  @moduledoc """
  Things somebody has to do about a customer, by a date.

  The list defaults to what is still open, because a list of finished tasks is
  not what anyone opens this for. `due_before=today` is the query a collections
  round actually starts with.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Customers

  plug KaarobarWeb.Plugs.Authorize, [permission: "follow_up:view"] when action in [:index, :show]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "follow_up:manage"] when action in [:create, :update, :complete, :cancel]

  def index(conn, params) do
    tasks = Customers.list_follow_ups(conn.assigns.scope, filters(params))
    render(conn, :follow_ups, follow_ups: tasks)
  end

  def show(conn, %{"id" => id}) do
    with {:ok, task} <- Customers.fetch_follow_up(conn.assigns.scope, id) do
      render(conn, :follow_up, follow_up: task)
    end
  end

  def create(conn, %{"customer_id" => customer_id} = params) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id),
         {:ok, task} <- Customers.create_follow_up(scope, customer, params) do
      conn |> put_status(:created) |> render(:follow_up, follow_up: task)
    end
  end

  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, task} <- Customers.fetch_follow_up(scope, id),
         {:ok, updated} <- Customers.update_follow_up(scope, task, params) do
      render(conn, :follow_up, follow_up: updated)
    end
  end

  @doc "Closes it with what came of it. The outcome is required."
  def complete(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, task} <- Customers.fetch_follow_up(scope, id),
         {:ok, done} <- Customers.complete_follow_up(scope, task, params["outcome"]) do
      render(conn, :follow_up, follow_up: done)
    end
  end

  def cancel(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, task} <- Customers.fetch_follow_up(scope, id),
         {:ok, cancelled} <- Customers.cancel_follow_up(scope, task, params["reason"]) do
      render(conn, :follow_up, follow_up: cancelled)
    end
  end

  defp filters(params) do
    params
    |> Map.take(["status", "customer_id", "assigned_to_id"])
    |> put_due_before(params["due_before"])
  end

  defp put_due_before(filters, nil), do: filters

  defp put_due_before(filters, value) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, date} -> Map.put(filters, "due_before", date)
      {:error, _reason} -> filters
    end
  end

  defp put_due_before(filters, _value), do: filters
end
