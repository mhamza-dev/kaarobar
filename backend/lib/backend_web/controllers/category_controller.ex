defmodule KaarobarWeb.CategoryController do
  @moduledoc """
  The catalog tree.

  Returned flat, ordered by path, with each node carrying its `ancestor_ids`.
  The client assembles the tree from that in one pass — cheaper than a nested
  JSON document, and it lets a category list be rendered before the tree is
  built.
  """

  use KaarobarWeb, :controller

  # Four controllers share one view module; Phoenix would otherwise look for
  # a XxxJSON per controller.
  plug :put_view, json: KaarobarWeb.TaxonomyJSON

  alias Kaarobar.Audit
  alias Kaarobar.Catalog

  plug KaarobarWeb.Plugs.Authorize, [permission: "product:view"] when action in [:index, :show]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "category:manage"] when action in [:create, :update, :delete]

  @doc "Lists categories, ordered so a tree can be built in one pass."
  def index(conn, _params) do
    render(conn, :index, categories: Catalog.list_categories(conn.assigns.scope))
  end

  @doc "One category."
  def show(conn, %{"id" => id}) do
    with {:ok, category} <- Catalog.fetch_category(conn.assigns.scope, id) do
      render(conn, :show, category: category)
    end
  end

  @doc "Creates a category, optionally under a parent."
  def create(conn, params) do
    scope = conn.assigns.scope

    with {:ok, category} <- Catalog.create_category(scope, params) do
      Audit.log(scope, "category.created", category)

      conn
      |> put_status(:created)
      |> render(:show, category: category)
    end
  end

  @doc """
  Updates a category, moving its subtree when the parent changes.

  Moving under one of its own descendants is refused: that would detach the
  subtree from the tree entirely and it would stop appearing anywhere.
  """
  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, category} <- Catalog.fetch_category(scope, id),
         {:ok, updated} <- Catalog.update_category(scope, category, params) do
      Audit.log(scope, "category.updated", updated)
      render(conn, :show, category: updated)
    end
  end

  @doc "Archives a category. Refused while it still has children."
  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, category} <- Catalog.fetch_category(scope, id),
         {:ok, archived} <- Catalog.archive_category(scope, category) do
      Audit.log(scope, "category.archived", archived)
      send_resp(conn, :no_content, "")
    end
  end
end
