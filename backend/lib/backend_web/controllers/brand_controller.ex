defmodule KaarobarWeb.BrandController do
  @moduledoc """
  Manufacturers and labels.

  Separate from category because they answer different questions: a category is
  where a shopper looks, a brand is who made it.
  """

  use KaarobarWeb, :controller

  # Four controllers share one view module; Phoenix would otherwise look for
  # a XxxJSON per controller.
  plug :put_view, json: KaarobarWeb.TaxonomyJSON

  alias Kaarobar.Audit
  alias Kaarobar.Catalog

  plug KaarobarWeb.Plugs.Authorize, [permission: "product:view"] when action in [:index]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "brand:manage"] when action in [:create, :update, :delete]

  def index(conn, _params) do
    render(conn, :index, brands: Catalog.list_brands(conn.assigns.scope))
  end

  def create(conn, params) do
    scope = conn.assigns.scope

    with {:ok, brand} <- Catalog.create_brand(scope, params) do
      Audit.log(scope, "brand.created", brand)

      conn
      |> put_status(:created)
      |> render(:show, brand: brand)
    end
  end

  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, brand} <- Catalog.fetch_brand(scope, id),
         {:ok, updated} <- Catalog.update_brand(scope, brand, params) do
      Audit.log(scope, "brand.updated", updated)
      render(conn, :show, brand: updated)
    end
  end

  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, brand} <- Catalog.fetch_brand(scope, id),
         {:ok, archived} <- Catalog.archive_brand(scope, brand) do
      Audit.log(scope, "brand.archived", archived)
      send_resp(conn, :no_content, "")
    end
  end
end
