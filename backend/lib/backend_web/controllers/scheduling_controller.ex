defmodule KaarobarWeb.SchedulingController do
  @moduledoc """
  The diary, the resources it books, and the bench of people waiting.

  Booking and cancelling are separate grants. A receptionist books all day; a
  cancellation costs the shop a slot it could have sold, and salons routinely
  want that to be somebody else's decision.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Scheduling

  plug KaarobarWeb.Plugs.Authorize, module: "appointments"

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "resource:view"] when action in [:resources, :availability, :diary]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "resource:manage"]
       when action in [:create_resource, :update_resource, :delete_resource]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "appointment:view"] when action in [:index, :show]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "appointment:manage"]
       when action in [:book, :advance, :reschedule, :seat_from_queue]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "appointment:cancel"] when action in [:cancel, :no_show]

  plug KaarobarWeb.Plugs.Authorize, [permission: "queue:view"] when action in [:queue]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "queue:manage"] when action in [:join_queue, :call_from_queue, :leave_queue]

  # --- Resources --------------------------------------------------------------

  def resources(conn, _params) do
    render(conn, :resources, resources: Scheduling.list_resources(conn.assigns.scope))
  end

  def create_resource(conn, params) do
    with {:ok, resource} <- Scheduling.create_resource(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:resource, resource: resource)
    end
  end

  def update_resource(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, resource} <- Scheduling.fetch_resource(scope, id),
         {:ok, updated} <- Scheduling.update_resource(scope, resource, params) do
      render(conn, :resource, resource: updated)
    end
  end

  def delete_resource(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, resource} <- Scheduling.fetch_resource(scope, id),
         {:ok, deleted} <- Scheduling.delete_resource(scope, resource) do
      render(conn, :resource, resource: deleted)
    end
  end

  @doc """
  Free slots for a resource on a day.

  `duration_minutes` is the length being looked for — a 90-minute colour needs
  90 free minutes, not a 15-minute gap.
  """
  def availability(conn, %{"resource_id" => resource_id, "date" => date} = params) do
    scope = conn.assigns.scope

    with {:ok, resource} <- Scheduling.fetch_resource(scope, resource_id),
         {:ok, on} <- parse_date(date) do
      opts =
        case parse_int(params["duration_minutes"]) do
          nil -> []
          minutes -> [duration_minutes: minutes]
        end

      render(conn, :availability, slots: Scheduling.availability(scope, resource, on, opts))
    end
  end

  @doc "The day's diary: every resource with its bookings."
  def diary(conn, %{"date" => date}) do
    with {:ok, on} <- parse_date(date) do
      render(conn, :diary, columns: Scheduling.day_view(conn.assigns.scope, on))
    end
  end

  # --- Appointments -----------------------------------------------------------

  def index(conn, params) do
    opts =
      []
      |> maybe_put(:from, parse_datetime(params["from"]))
      |> maybe_put(:to, parse_datetime(params["to"]))
      |> maybe_put(:status, params["status"])
      |> maybe_put(:customer_id, params["customer_id"])

    render(conn, :appointments, appointments: Scheduling.list_appointments(conn.assigns.scope, opts))
  end

  def show(conn, %{"id" => id}) do
    with {:ok, appointment} <- Scheduling.fetch_appointment(conn.assigns.scope, id) do
      render(conn, :appointment, appointment: appointment)
    end
  end

  def book(conn, params) do
    with {:ok, appointment} <- Scheduling.book(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:appointment, appointment: appointment)
    end
  end

  @doc "Confirms, marks arrived, starts or completes a booking."
  def advance(conn, %{"id" => id, "step" => step}) do
    scope = conn.assigns.scope

    with {:ok, appointment} <- Scheduling.fetch_appointment(scope, id),
         {:ok, parsed} <- parse_step(step),
         {:ok, _updated} <- Scheduling.advance(scope, appointment, parsed),
         {:ok, reloaded} <- Scheduling.fetch_appointment(scope, id) do
      render(conn, :appointment, appointment: reloaded)
    end
  end

  def reschedule(conn, %{"id" => id, "starts_at" => starts_at}) do
    scope = conn.assigns.scope

    with {:ok, appointment} <- Scheduling.fetch_appointment(scope, id),
         {:ok, at} <- require_datetime(starts_at),
         {:ok, moved} <- Scheduling.reschedule(scope, appointment, at) do
      render(conn, :appointment, appointment: moved)
    end
  end

  def cancel(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, appointment} <- Scheduling.fetch_appointment(scope, id),
         {:ok, cancelled} <- Scheduling.cancel(scope, appointment, params["reason"]) do
      render(conn, :appointment, appointment: cancelled)
    end
  end

  def no_show(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, appointment} <- Scheduling.fetch_appointment(scope, id),
         {:ok, marked} <- Scheduling.no_show(scope, appointment) do
      render(conn, :appointment, appointment: marked)
    end
  end

  # --- The walk-in queue ------------------------------------------------------

  def queue(conn, _params) do
    render(conn, :queue, entries: Scheduling.queue(conn.assigns.scope))
  end

  def join_queue(conn, params) do
    with {:ok, entry} <- Scheduling.join_queue(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:queue_entry, entry: entry)
    end
  end

  def call_from_queue(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, entry} <- Scheduling.fetch_queue_entry(scope, id),
         {:ok, called} <- Scheduling.call_from_queue(scope, entry) do
      render(conn, :queue_entry, entry: called)
    end
  end

  @doc "Seats somebody from the bench, turning their wait into a booking."
  def seat_from_queue(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, entry} <- Scheduling.fetch_queue_entry(scope, id),
         {:ok, result} <- Scheduling.seat_from_queue(scope, entry, params) do
      conn |> put_status(:created) |> render(:appointment, appointment: result.appointment)
    end
  end

  def leave_queue(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope
    status = if params["status"] == "no_show", do: "no_show", else: "left"

    with {:ok, entry} <- Scheduling.fetch_queue_entry(scope, id),
         {:ok, left} <- Scheduling.leave_queue(scope, entry, status) do
      render(conn, :queue_entry, entry: left)
    end
  end

  # --- Parsing ----------------------------------------------------------------

  defp parse_step("confirm"), do: {:ok, :confirm}
  defp parse_step("arrive"), do: {:ok, :arrive}
  defp parse_step("start"), do: {:ok, :start}
  defp parse_step("complete"), do: {:ok, :complete}
  defp parse_step(_other), do: {:error, :invalid_step}

  defp parse_date(value) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, date} -> {:ok, date}
      {:error, _reason} -> {:error, :invalid_date}
    end
  end

  defp parse_date(_value), do: {:error, :invalid_date}

  defp require_datetime(value) do
    case parse_datetime(value) do
      nil -> {:error, :invalid_starts_at}
      at -> {:ok, at}
    end
  end

  defp parse_datetime(nil), do: nil

  defp parse_datetime(value) when is_binary(value) do
    case DateTime.from_iso8601(value) do
      {:ok, datetime, _offset} -> datetime
      {:error, _reason} -> nil
    end
  end

  defp parse_datetime(_value), do: nil

  defp parse_int(nil), do: nil
  defp parse_int(value) when is_integer(value), do: value

  defp parse_int(value) when is_binary(value) do
    case Integer.parse(value) do
      {number, ""} -> number
      _other -> nil
    end
  end

  defp parse_int(_value), do: nil

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)
end
