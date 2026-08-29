defmodule KaarobarWeb.BranchController do
  @moduledoc """
  The branches of the currently selected business.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Audit
  alias Kaarobar.Tenancy

  plug KaarobarWeb.Plugs.Authorize, [permission: "branch:view"] when action in [:index, :show]
  plug KaarobarWeb.Plugs.Authorize, [permission: "branch:create"] when action in [:create]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "branch:edit"] when action in [:update, :set_main]

  plug KaarobarWeb.Plugs.Authorize, [permission: "branch:archive"] when action in [:delete]

  @doc "Lists the branches the caller can act on."
  def index(conn, _params) do
    render(conn, :index, branches: Tenancy.list_branches(conn.assigns.scope))
  end

  @doc "One branch."
  def show(conn, %{"id" => id}) do
    with {:ok, branch} <- Tenancy.fetch_branch(conn.assigns.scope, id) do
      render(conn, :show, branch: branch)
    end
  end

  @doc "Creates a branch."
  def create(conn, params) do
    scope = conn.assigns.scope

    with {:ok, branch} <- Tenancy.create_branch(scope, params) do
      Audit.log(scope, "branch.created", branch, summary: "Created branch #{branch.name}")

      conn
      |> put_status(:created)
      |> render(:show, branch: branch)
    end
  end

  @doc "Updates a branch."
  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, branch} <- Tenancy.fetch_branch(scope, id),
         {:ok, updated} <- Tenancy.update_branch(scope, branch, params) do
      Audit.log(scope, "branch.updated", updated)
      render(conn, :show, branch: updated)
    end
  end

  @doc """
  Makes this the main branch, demoting the current one.

  Separate from `update` because it changes another record too, and because a
  business must have exactly one main branch at every moment.
  """
  def set_main(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, branch} <- Tenancy.fetch_branch(scope, id),
         {:ok, promoted} <- Tenancy.set_main_branch(scope, branch) do
      Audit.log(scope, "branch.promoted", promoted,
        summary: "#{promoted.name} is now the main branch"
      )

      render(conn, :show, branch: promoted)
    end
  end

  @doc """
  Archives a branch.

  The main branch cannot be archived — every till in the business defaults to
  it, and removing it stops them all.
  """
  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, branch} <- Tenancy.fetch_branch(scope, id),
         {:ok, archived} <- Tenancy.archive_branch(scope, branch) do
      Audit.log(scope, "branch.archived", archived)
      send_resp(conn, :no_content, "")
    end
  end
end
