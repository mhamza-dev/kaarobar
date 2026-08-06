defmodule KaarobarWeb.V1.BookableResourceController do
  use KaarobarWeb, :controller

  alias Kaarobar.Appointments

  def index(conn, params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_required"})
    else
      opts = [
        branch_id: params["branch_id"] || conn.assigns[:branch_id],
        kind: params["kind"],
        active_only: params["active_only"] != "false"
      ]

      data =
        Appointments.list_bookable_resources(business_id, owner_id, opts)
        |> Enum.map(&Appointments.serialize_bookable_resource/1)

      json(conn, %{data: data})
    end
  end

  def create(conn, params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    if is_nil(business_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_branch_required"})
    else
      attrs = Map.put(params, "branch_id", branch_id)

      case Appointments.create_bookable_resource(business_id, owner_id, attrs) do
        {:ok, resource} ->
          conn
          |> put_status(:created)
          |> json(%{data: Appointments.serialize_bookable_resource(resource)})

        {:error, %Ecto.Changeset{} = cs} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "validation_failed", details: translate_errors(cs)})

        {:error, reason} ->
          error_response(conn, reason)
      end
    end
  end

  def show(conn, %{"id" => id}) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Appointments.get_bookable_resource(id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      resource ->
        json(conn, %{data: Appointments.serialize_bookable_resource(resource)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Appointments.get_bookable_resource(id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      resource ->
        case Appointments.update_bookable_resource(resource, Map.drop(params, ["id"])) do
          {:ok, updated} ->
            json(conn, %{data: Appointments.serialize_bookable_resource(updated)})

          {:error, %Ecto.Changeset{} = cs} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: "validation_failed", details: translate_errors(cs)})

          {:error, reason} ->
            error_response(conn, reason)
        end
    end
  end

  def delete(conn, %{"id" => id}) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Appointments.get_bookable_resource(id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      resource ->
        case Appointments.deactivate_bookable_resource(resource) do
          {:ok, updated} ->
            json(conn, %{data: Appointments.serialize_bookable_resource(updated)})

          {:error, reason} ->
            error_response(conn, reason)
        end
    end
  end

  defp error_response(conn, :appointments_disabled),
    do: conn |> put_status(:forbidden) |> json(%{error: "appointments_disabled"})

  defp error_response(conn, :branch_not_found),
    do: conn |> put_status(:not_found) |> json(%{error: "branch_not_found"})

  defp error_response(conn, reason),
    do: conn |> put_status(:unprocessable_entity) |> json(%{error: to_string(reason)})

  defp translate_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
