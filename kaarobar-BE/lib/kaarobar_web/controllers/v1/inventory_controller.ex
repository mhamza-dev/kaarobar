defmodule KaarobarWeb.V1.InventoryController do
  use KaarobarWeb, :controller
  alias Kaarobar.Inventory
  alias Kaarobar.Guardian

  def adjust(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:current_branch_id]

    case Inventory.adjust_stock(branch_id, owner_id, business_id, user.id, params) do
      {:ok, adj} -> conn |> put_status(:created) |> json(%{data: adj})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def transfer(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id

    case Inventory.create_transfer(business_id, owner_id, params) do
      {:ok, transfer} -> conn |> put_status(:created) |> json(%{data: transfer})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def confirm_transfer(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Inventory.confirm_transfer(id, owner_id) do
      {:ok, transfer} -> json(conn, %{data: transfer})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = conn.assigns[:branch_id]

    if is_nil(business_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_branch_required"})
    else
      data =
        branch_id
        |> Inventory.list_inventory_for_branch(owner_id, business_id)
        |> Enum.map(fn row ->
          %{
            product_id: row.product_id,
            sku: row.product && row.product.sku,
            name: row.product && row.product.name,
            quantity_on_hand: to_string(row.quantity_on_hand),
            avg_cost: to_string(row.avg_cost || 0)
          }
        end)

      json(conn, %{data: data})
    end
  end

  def set_price(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    case Inventory.set_branch_price(
           params["product_id"],
           branch_id,
           owner_id,
           business_id,
           params["price"]
         ) do
      {:ok, price} ->
        json(conn, %{
          data: %{
            id: price.id,
            product_id: price.product_id,
            branch_id: price.branch_id,
            price: to_string(price.price)
          }
        })

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def create_po(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:current_branch_id]

    case Inventory.create_purchase_order(business_id, branch_id, owner_id, atomize(params)) do
      {:ok, %{po: po}} -> conn |> put_status(:created) |> json(%{data: po})
      {:ok, po} -> conn |> put_status(:created) |> json(%{data: po})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def receive_grn(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:current_branch_id]

    case Inventory.receive_goods(params["purchase_order_id"], branch_id, owner_id, business_id, user.id, atomize(params)) do
      {:ok, grn} -> conn |> put_status(:created) |> json(%{data: grn})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp atomize(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) ->
        key =
          try do
            String.to_existing_atom(k)
          rescue
            ArgumentError -> String.to_atom(k)
          end

        {key, maybe_atomize_list(v)}

      {k, v} ->
        {k, maybe_atomize_list(v)}
    end)
  end

  defp maybe_atomize_list(list) when is_list(list), do: Enum.map(list, &atomize_item/1)
  defp maybe_atomize_list(v), do: v
  defp atomize_item(map) when is_map(map), do: atomize(map)
  defp atomize_item(v), do: v
end
