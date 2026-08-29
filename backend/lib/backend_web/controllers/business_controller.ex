defmodule KaarobarWeb.BusinessController do
  @moduledoc """
  The businesses inside an organization.

  Creating one also creates its main branch: a business with no branch cannot
  hold stock or take a sale, and handing a client a half-built tenant only
  means the next request fails somewhere less obvious.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Audit
  alias Kaarobar.Tenancy
  alias Kaarobar.Verticals

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "business:view"] when action in [:index, :show]

  plug KaarobarWeb.Plugs.Authorize, [permission: "business:create"] when action in [:create]
  plug KaarobarWeb.Plugs.Authorize, [permission: "business:edit"] when action in [:update]
  plug KaarobarWeb.Plugs.Authorize, [permission: "business:archive"] when action in [:delete]

  @doc "Lists the businesses the caller can see."
  def index(conn, _params) do
    render(conn, :index, businesses: Tenancy.list_businesses(conn.assigns.scope))
  end

  @doc "One business."
  def show(conn, %{"id" => id}) do
    with {:ok, business} <- Tenancy.fetch_business(conn.assigns.scope, id) do
      render(conn, :show, business: business)
    end
  end

  @doc "Creates a business and its main branch."
  def create(conn, params) do
    scope = conn.assigns.scope

    case Tenancy.create_business(scope, params) do
      {:ok, %{business: business, branch: branch}} ->
        Audit.log(scope, "business.created", business,
          summary: "Created #{business.name} (#{business.business_type})"
        )

        conn
        |> put_status(:created)
        |> render(:created, business: business, branch: branch)

      {:error, _step, changeset} ->
        {:error, changeset}
    end
  end

  @doc "Updates a business."
  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, business} <- Tenancy.fetch_business(scope, id),
         {:ok, updated} <- Tenancy.update_business(scope, business, params) do
      Audit.log(scope, "business.updated", updated)
      render(conn, :show, business: updated)
    end
  end

  @doc """
  Archives a business.

  Its sales, stock history and audit trail are retained — a shop that closed
  still has to be reportable and, in most jurisdictions, auditable for years.
  """
  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, business} <- Tenancy.fetch_business(scope, id),
         {:ok, archived} <- Tenancy.archive_business(scope, business) do
      Audit.log(scope, "business.archived", archived)
      send_resp(conn, :no_content, "")
    end
  end

  @doc """
  The kinds of business the platform supports, grouped for a setup screen.

  Public and unscoped: it is a static catalogue, and the signup form needs it
  before an account exists.
  """
  def types(conn, _params) do
    json(conn, %{
      data: %{
        groups: Verticals.grouped(),
        modules: Verticals.modules(),
        product_kinds: Verticals.product_kinds()
      }
    })
  end
end
