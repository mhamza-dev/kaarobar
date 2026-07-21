defmodule KaarobarWeb.V1.RoleSettingsController do
  use KaarobarWeb, :controller

  alias Kaarobar.Tenancy

  def show(conn, %{"business_id" => business_id}) do
    actor = Guardian.Plug.current_resource(conn)

    case Tenancy.list_role_settings(business_id, actor) do
      {:ok, settings} ->
        json(conn, %{data: %{business_id: business_id, roles: settings}})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:error, :forbidden} ->
        conn |> put_status(:forbidden) |> json(%{error: "forbidden_role"})

      _ ->
        conn |> put_status(:forbidden) |> json(%{error: "forbidden_role"})
    end
  end

  def update(conn, %{"business_id" => business_id, "roles" => roles}) when is_map(roles) do
    actor = Guardian.Plug.current_resource(conn)

    case Tenancy.update_role_settings(business_id, actor, roles) do
      {:ok, settings} ->
        json(conn, %{data: %{business_id: business_id, roles: settings}})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:error, %Ecto.Changeset{} = changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(changeset.errors)})

      _ ->
        conn |> put_status(:forbidden) |> json(%{error: "forbidden_role"})
    end
  end

  def update(conn, _params) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "invalid_payload"})
  end
end
