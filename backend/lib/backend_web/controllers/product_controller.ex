defmodule KaarobarWeb.ProductController do
  @moduledoc """
  The catalog.

  `scan/2` is the endpoint the POS calls on every barcode read, so it is a
  plain `GET` with the code in the path: cacheable, retryable, and cheap enough
  that a scanner firing bursts does not queue behind anything.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Audit
  alias Kaarobar.Catalog
  alias KaarobarWeb.Pagination

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "product:view"] when action in [:index, :show, :scan]

  plug KaarobarWeb.Plugs.Authorize, [permission: "product:create"] when action in [:create]
  plug KaarobarWeb.Plugs.Authorize, [permission: "product:edit"] when action in [:update]
  plug KaarobarWeb.Plugs.Authorize, [permission: "product:archive"] when action in [:delete]

  @filter_keys ~w(q category_id brand_id kind active in_category_tree)

  @doc """
  Lists products.

  Filterable by `q` (name, SKU or barcode), `category_id`, `in_category_tree`,
  `brand_id`, `kind` and `active`. Cursor-paginated.
  """
  def index(conn, params) do
    {products, meta} =
      conn.assigns.scope
      |> Catalog.product_query(Map.take(params, @filter_keys))
      |> Pagination.page(params)

    render(conn, :index, products: products, meta: meta)
  end

  @doc "One product with its variants, category, brand and tax group."
  def show(conn, %{"id" => id}) do
    with {:ok, product} <- Catalog.fetch_product(conn.assigns.scope, id) do
      render(conn, :show, product: product)
    end
  end

  @doc """
  Creates a product and its default variant.

  Price, SKU, barcode and cost may be given at the top level; they belong to
  the variant, but a client creating a simple product should not have to know
  that variants exist.
  """
  def create(conn, params) do
    scope = conn.assigns.scope

    with {:ok, product} <- Catalog.create_product(scope, params) do
      Audit.log(scope, "product.created", product,
        summary: "Created #{product.name}",
        metadata: %{kind: product.kind}
      )

      conn
      |> put_status(:created)
      |> render(:show, product: product)
    end
  end

  @doc "Updates a product."
  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, product} <- Catalog.fetch_product(scope, id),
         {:ok, updated} <- Catalog.update_product(scope, product, params) do
      Audit.log(scope, "product.updated", updated)
      render(conn, :show, product: updated)
    end
  end

  @doc """
  Archives a product and its variants.

  Soft-deleted: sale lines reference variants, and a receipt reprinted next
  year still has to name what was sold.
  """
  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, product} <- Catalog.fetch_product(scope, id),
         {:ok, archived} <- Catalog.archive_product(scope, product) do
      Audit.log(scope, "product.archived", archived)
      send_resp(conn, :no_content, "")
    end
  end

  @doc """
  Resolves a barcode to a variant.

  The hot path at the counter. Returns the variant with its product attached,
  which is everything the till needs to add a line.
  """
  def scan(conn, %{"barcode" => barcode}) do
    with {:ok, variant} <- Catalog.scan(conn.assigns.scope, barcode) do
      render(conn, :scanned, variant: variant)
    end
  end
end
