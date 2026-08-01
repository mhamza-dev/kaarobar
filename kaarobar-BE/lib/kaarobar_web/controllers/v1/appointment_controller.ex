defmodule KaarobarWeb.V1.AppointmentController do
  use KaarobarWeb, :controller

  alias Kaarobar.{Appointments, Guardian, Hr}
  alias KaarobarWeb.Controllers.Helpers.ListFilters

  def index(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_required"})
    else
      opts =
        ListFilters.parse(params, [:from, :to, :status])
        |> maybe_put(:staff_id, params["staff_id"])
        |> maybe_put(:customer_id, params["customer_id"])
        |> maybe_put(:branch_id, params["branch_id"] || conn.assigns[:branch_id])

      data =
        Appointments.list_appointments(business_id, owner_id, opts)
        |> Enum.map(&Appointments.serialize/1)

      json(conn, %{data: data})
    end
  end

  def slots(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    if is_nil(business_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_branch_required"})
    else
      case Appointments.list_slots(business_id, owner_id, Map.put(params, "branch_id", branch_id)) do
        {:ok, slots} ->
          json(conn, %{data: slots})

        {:error, reason} ->
          error_response(conn, reason)
      end
    end
  end

  def schedule(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    staff_id =
      params["staff_id"] ||
        case Hr.find_employee_for_user(user.id, business_id, owner_id) do
          nil -> nil
          emp -> emp.id
        end

    date =
      case params["date"] do
        nil -> Date.utc_today()
        str ->
          case Date.from_iso8601(str) do
            {:ok, d} -> d
            _ -> nil
          end
      end

    cond do
      is_nil(business_id) ->
        conn |> put_status(:bad_request) |> json(%{error: "business_required"})

      is_nil(staff_id) ->
        conn |> put_status(:bad_request) |> json(%{error: "staff_required"})

      is_nil(date) ->
        conn |> put_status(:bad_request) |> json(%{error: "invalid_date"})

      true ->
        data =
          Appointments.staff_day_schedule(business_id, owner_id, staff_id, date)
          |> Enum.map(&Appointments.serialize/1)

        json(conn, %{data: data, meta: %{staff_id: staff_id, date: Date.to_iso8601(date)}})
    end
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    if is_nil(business_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_branch_required"})
    else
      attrs = Map.merge(params, %{"branch_id" => branch_id, "booked_by" => "staff"})

      case Appointments.book(business_id, owner_id, attrs) do
        {:ok, appt} ->
          conn |> put_status(:created) |> json(%{data: Appointments.serialize(appt)})

        {:error, reason} ->
          error_response(conn, reason)
      end
    end
  end

  def show(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Appointments.get_appointment(id, owner_id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      appt -> json(conn, %{data: Appointments.serialize(appt)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Appointments.get_appointment(id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      appt ->
        cond do
          is_binary(params["status"]) and params["status"] != "" ->
            case Appointments.transition(appt, params["status"]) do
              {:ok, updated} -> json(conn, %{data: Appointments.serialize(updated)})
              {:error, reason} -> error_response(conn, reason)
            end

          is_binary(params["starts_at"]) ->
            case Appointments.reschedule(appt, params) do
              {:ok, updated} -> json(conn, %{data: Appointments.serialize(updated)})
              {:error, reason} -> error_response(conn, reason)
            end

          true ->
            conn |> put_status(:bad_request) |> json(%{error: "status_or_starts_at_required"})
        end
    end
  end

  def cancel(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Appointments.get_appointment(id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      appt ->
        case Appointments.cancel(appt) do
          {:ok, updated} -> json(conn, %{data: Appointments.serialize(updated)})
          {:error, reason} -> error_response(conn, reason)
        end
    end
  end

  def complete(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Appointments.get_appointment(id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      %{status: "InProgress"} = appt ->
        case Appointments.transition(appt, "Completed") do
          {:ok, updated} -> json(conn, %{data: Appointments.serialize(updated)})
          {:error, reason} -> error_response(conn, reason)
        end

      %{status: "CheckedIn"} = appt ->
        with {:ok, in_progress} <- Appointments.transition(appt, "InProgress"),
             {:ok, updated} <- Appointments.transition(in_progress, "Completed") do
          json(conn, %{data: Appointments.serialize(updated)})
        else
          {:error, reason} -> error_response(conn, reason)
        end

      %{status: "Booked"} = appt ->
        with {:ok, checked} <- Appointments.transition(appt, "CheckedIn"),
             {:ok, in_progress} <- Appointments.transition(checked, "InProgress"),
             {:ok, updated} <- Appointments.transition(in_progress, "Completed") do
          json(conn, %{data: Appointments.serialize(updated)})
        else
          {:error, reason} -> error_response(conn, reason)
        end

      _ ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid_transition"})
    end
  end

  defp error_response(conn, :appointments_disabled),
    do: conn |> put_status(:forbidden) |> json(%{error: "appointments_disabled"})

  defp error_response(conn, :conflict),
    do: conn |> put_status(:conflict) |> json(%{error: "staff_conflict"})

  defp error_response(conn, :invalid_transition),
    do: conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid_transition"})

  defp error_response(conn, :invalid_status),
    do: conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid_status"})

  defp error_response(conn, :invalid_service),
    do: conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid_service"})

  defp error_response(conn, :product_not_found),
    do: conn |> put_status(:not_found) |> json(%{error: "product_not_found"})

  defp error_response(conn, :staff_not_found),
    do: conn |> put_status(:not_found) |> json(%{error: "staff_not_found"})

  defp error_response(conn, :branch_not_found),
    do: conn |> put_status(:not_found) |> json(%{error: "branch_not_found"})

  defp error_response(conn, :customer_not_found),
    do: conn |> put_status(:not_found) |> json(%{error: "customer_not_found"})

  defp error_response(conn, :invalid_date),
    do: conn |> put_status(:bad_request) |> json(%{error: "invalid_date"})

  defp error_response(conn, :invalid_datetime),
    do: conn |> put_status(:bad_request) |> json(%{error: "invalid_datetime"})

  defp error_response(conn, %Ecto.Changeset{} = cs),
    do: conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})

  defp error_response(conn, reason),
    do: conn |> put_status(:unprocessable_entity) |> json(%{error: to_string(reason)})

  defp maybe_put(opts, _k, nil), do: opts
  defp maybe_put(opts, _k, ""), do: opts
  defp maybe_put(opts, k, v), do: Keyword.put(opts, k, v)
end
