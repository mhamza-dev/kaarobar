defmodule KaarobarWeb.V1.MarketplaceController do
  use KaarobarWeb, :controller

  alias Kaarobar.Marketplace

  def index(conn, params) do
    data =
      Marketplace.list_businesses(q: params["q"])
      |> Enum.map(&Marketplace.serialize_business/1)

    json(conn, %{data: data})
  end

  def show(conn, %{"id" => id}) do
    case Marketplace.get_business(id) do
      {:ok, business} ->
        json(conn, %{data: Marketplace.serialize_business(business)})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})
    end
  end

  def catalog(conn, %{"id" => id}) do
    case Marketplace.catalog(id) do
      {:ok, %{business: business, branch_id: branch_id, products: products}} ->
        json(conn, %{
          data: %{
            business: Marketplace.serialize_business(business),
            branch_id: branch_id,
            products: products
          }
        })

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:error, :online_branch_required} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "online_branch_required"})
    end
  end
end
