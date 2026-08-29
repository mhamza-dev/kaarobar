defmodule KaarobarWeb.VariantController do
  @moduledoc """
  A product's variants — the things that carry price, barcode and stock.

  `matrix/2` exists because a clothing shop entering three sizes and four
  colours wants twelve variants, not twelve forms. It skips combinations that
  already exist, so running it again after adding a colour creates only the new
  column.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Audit
  alias Kaarobar.Catalog

  plug KaarobarWeb.Plugs.Authorize, [permission: "product:view"] when action in [:index]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "variant:manage"] when action in [:create, :update, :delete, :matrix]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "barcode:manage"] when action in [:add_barcode, :delete_barcode]

  @doc "Lists a product's variants."
  def index(conn, %{"product_id" => product_id}) do
    scope = conn.assigns.scope

    with {:ok, product} <- Catalog.fetch_product(scope, product_id) do
      render(conn, :index, variants: Catalog.list_variants(scope, product))
    end
  end

  @doc "Adds a variant, optionally placing it in the option matrix."
  def create(conn, %{"product_id" => product_id} = params) do
    scope = conn.assigns.scope

    with {:ok, product} <- Catalog.fetch_product(scope, product_id),
         {:ok, variant} <- Catalog.create_variant(scope, product, params) do
      Audit.log(scope, "variant.created", variant,
        entity_type: "product_variant",
        label: variant.name || product.name
      )

      conn
      |> put_status(:created)
      |> render(:show, variant: variant)
    end
  end

  @doc "Updates a variant."
  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, variant} <- Catalog.fetch_variant(scope, id),
         {:ok, updated} <- Catalog.update_variant(scope, variant, params) do
      Audit.log(scope, "variant.updated", updated, entity_type: "product_variant")
      render(conn, :show, variant: updated)
    end
  end

  @doc """
  Archives a variant.

  The default variant is refused: a product with none cannot be sold.
  """
  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, variant} <- Catalog.fetch_variant(scope, id),
         {:ok, archived} <- Catalog.archive_variant(scope, variant) do
      Audit.log(scope, "variant.archived", archived, entity_type: "product_variant")
      send_resp(conn, :no_content, "")
    end
  end

  @doc """
  Builds every combination of the given option values.

  Expects `option_groups` as a list of lists of option value ids — one list per
  option type. Any other attributes are applied to every variant created.
  """
  def matrix(conn, %{"product_id" => product_id, "option_groups" => groups} = params)
      when is_list(groups) do
    scope = conn.assigns.scope
    attrs = Map.drop(params, ["product_id", "option_groups"])

    with {:ok, product} <- Catalog.fetch_product(scope, product_id),
         {:ok, variants} <- Catalog.generate_matrix(scope, product, groups, attrs) do
      Audit.log(scope, "variant.matrix_generated", product,
        summary: "Generated #{length(variants)} variants"
      )

      conn
      |> put_status(:created)
      |> render(:index, variants: variants)
    end
  end

  def matrix(_conn, _params), do: {:error, :unprocessable_entity}

  @doc "Adds an alternate barcode to a variant."
  def add_barcode(conn, %{"variant_id" => variant_id} = params) do
    scope = conn.assigns.scope

    with {:ok, variant} <- Catalog.fetch_variant(scope, variant_id),
         {:ok, barcode} <- Catalog.add_barcode(scope, variant, params) do
      conn
      |> put_status(:created)
      |> render(:barcode, barcode: barcode)
    end
  end

  @doc "Removes an alternate barcode."
  def delete_barcode(conn, %{"id" => id}) do
    :ok = Catalog.delete_barcode(conn.assigns.scope, id)
    send_resp(conn, :no_content, "")
  end
end
