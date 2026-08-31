defmodule KaarobarWeb.RentalController do
  @moduledoc """
  Hiring things out and getting them back.

  `available` is the endpoint that matters: a hire shop asks whether a
  particular thing is free between two dates, and a stock level cannot answer
  that.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Rentals

  plug KaarobarWeb.Plugs.Authorize, module: "rentals"

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "rental:view"] when action in [:units, :available, :index, :show, :overdue]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "rental:manage"]
       when action in [
              :create_unit,
              :update_unit,
              :delete_unit,
              :book,
              :issue,
              :take_back,
              :cancel
            ]

  # --- The fleet --------------------------------------------------------------

  def units(conn, params) do
    opts = if params["status"], do: [status: params["status"]], else: []
    render(conn, :units, units: Rentals.list_units(conn.assigns.scope, opts))
  end

  @doc "What is free for a whole period. The question a hire shop actually asks."
  def available(conn, %{"from" => from, "to" => to}) do
    with {:ok, from_at} <- parse_datetime(from),
         {:ok, to_at} <- parse_datetime(to) do
      render(conn, :units, units: Rentals.available_between(conn.assigns.scope, from_at, to_at))
    end
  end

  def create_unit(conn, params) do
    with {:ok, unit} <- Rentals.create_unit(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:unit, unit: unit)
    end
  end

  def update_unit(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, unit} <- Rentals.fetch_unit(scope, id),
         {:ok, updated} <- Rentals.update_unit(scope, unit, params) do
      render(conn, :unit, unit: updated)
    end
  end

  def delete_unit(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, unit} <- Rentals.fetch_unit(scope, id),
         {:ok, deleted} <- Rentals.delete_unit(scope, unit) do
      render(conn, :unit, unit: deleted)
    end
  end

  # --- Agreements -------------------------------------------------------------

  def index(conn, params) do
    opts =
      []
      |> maybe_put(:status, params["status"])
      |> maybe_put(:customer_id, params["customer_id"])

    render(conn, :agreements, agreements: Rentals.list_agreements(conn.assigns.scope, opts))
  end

  @doc "Hires past their return date and still out. The chase list."
  def overdue(conn, _params) do
    render(conn, :agreements, agreements: Rentals.overdue(conn.assigns.scope))
  end

  def show(conn, %{"id" => id}) do
    with {:ok, agreement} <- Rentals.fetch_agreement(conn.assigns.scope, id) do
      render(conn, :agreement, agreement: agreement)
    end
  end

  def book(conn, params) do
    with {:ok, agreement} <- Rentals.book(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:agreement, agreement: agreement)
    end
  end

  def issue(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, agreement} <- Rentals.fetch_agreement(scope, id),
         {:ok, issued} <- Rentals.issue(scope, agreement) do
      render(conn, :agreement, agreement: issued)
    end
  end

  @doc "Takes everything back, working out the late and damage fees."
  def take_back(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, agreement} <- Rentals.fetch_agreement(scope, id),
         {:ok, returned} <- Rentals.take_back(scope, agreement, params) do
      render(conn, :agreement, agreement: returned)
    end
  end

  def cancel(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, agreement} <- Rentals.fetch_agreement(scope, id),
         {:ok, cancelled} <- Rentals.cancel(scope, agreement, params["reason"]) do
      render(conn, :agreement, agreement: cancelled)
    end
  end

  defp parse_datetime(value) when is_binary(value) do
    case DateTime.from_iso8601(value) do
      {:ok, datetime, _offset} -> {:ok, datetime}
      {:error, _reason} -> {:error, :invalid_period}
    end
  end

  defp parse_datetime(_value), do: {:error, :invalid_period}

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)
end
