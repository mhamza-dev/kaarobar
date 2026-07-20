defmodule KaarobarWeb.V1.ProductController do
  use KaarobarWeb, :controller
  alias Kaarobar.Inventory
  alias Kaarobar.Guardian
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{ProductBranchPrice, InventoryRecord}

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "x-business-id required"})
    else
      products = Inventory.list_products(business_id, conn.assigns.current_owner_id || user.id)
      branch_id = conn.assigns[:current_branch_id]

      data =
        Enum.map(products, fn p ->
          price =
            if branch_id do
              case Repo.get_by(ProductBranchPrice, product_id: p.id, branch_id: branch_id) do
                nil -> nil
                row -> to_string(row.price)
              end
            end

          %{
            id: p.id,
            business_id: p.business_id,
            sku: p.sku,
            name: p.name,
            category: p.category,
            tax_rate: to_string(p.tax_rate || "0.18"),
            is_active: p.is_active,
            price: price
          }
        end)

      json(conn, %{data: data})
    end
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    branch_id = conn.assigns[:current_branch_id]

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "x-business-id required"})
    else
      attrs = %{
        sku: params["sku"],
        name: params["name"],
        category: params["category"],
        tax_rate: params["tax_rate"] || "0.18",
        is_active: true
      }

      with {:ok, product} <- Inventory.create_product(business_id, owner_id, attrs),
           :ok <- maybe_price(product, branch_id, owner_id, business_id, params["price"]),
           :ok <- maybe_stock(product, branch_id, owner_id, business_id, params["opening_qty"] || "100") do
        conn |> put_status(:created) |> json(%{data: product})
      else
        {:error, reason} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
      end
    end
  end

  defp maybe_price(_product, nil, _, _, _), do: :ok
  defp maybe_price(_product, _, _, _, nil), do: :ok
  defp maybe_price(_product, _, _, _, ""), do: :ok

  defp maybe_price(product, branch_id, owner_id, business_id, price) do
    case Inventory.set_branch_price(product.id, branch_id, owner_id, business_id, price) do
      {:ok, _} -> :ok
      error -> error
    end
  end

  defp maybe_stock(_product, nil, _, _, _), do: :ok

  defp maybe_stock(product, branch_id, owner_id, business_id, qty) do
    %InventoryRecord{}
    |> InventoryRecord.changeset(%{
      product_id: product.id,
      branch_id: branch_id,
      owner_id: owner_id,
      business_id: business_id,
      quantity_on_hand: qty,
      avg_cost: "0"
    })
    |> Repo.insert()
    |> case do
      {:ok, _} -> :ok
      {:error, _} = err -> err
    end
  end
end
