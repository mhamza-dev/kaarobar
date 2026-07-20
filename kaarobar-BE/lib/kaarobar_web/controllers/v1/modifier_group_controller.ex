defmodule KaarobarWeb.V1.ModifierGroupController do
  use KaarobarWeb, :controller
  alias Kaarobar.{Catalog, Guardian}

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns.current_owner_id || user.id

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "x-business-id required"})
    else
      data =
        Catalog.list_modifier_groups(business_id, owner_id)
        |> Enum.map(&serialize_group/1)

      json(conn, %{data: data})
    end
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns.current_owner_id || user.id

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "x-business-id required"})
    else
      case Catalog.create_modifier_group(business_id, owner_id, params) do
        {:ok, group} ->
          conn |> put_status(:created) |> json(%{data: serialize_group(group)})

        {:error, reason} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
      end
    end
  end

  def attach(conn, %{"product_id" => product_id, "modifier_group_id" => group_id}) do
    case Catalog.attach_modifier_group(product_id, group_id) do
      {:ok, _} -> json(conn, %{ok: true})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp serialize_group(g) do
    %{
      id: g.id,
      name: g.name,
      min_select: g.min_select,
      max_select: g.max_select,
      required: g.required,
      modifiers:
        Enum.map(g.modifiers || [], fn m ->
          %{
            id: m.id,
            name: m.name,
            price_delta: to_string(m.price_delta || 0),
            is_active: m.is_active
          }
        end)
    }
  end
end
