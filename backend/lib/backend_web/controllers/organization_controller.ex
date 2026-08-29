defmodule KaarobarWeb.OrganizationController do
  @moduledoc """
  The organizations a user belongs to, and the settings of the current one.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Audit
  alias Kaarobar.Scope
  alias Kaarobar.Tenancy

  plug KaarobarWeb.Plugs.Authorize, [permission: "organization:view"] when action in [:show]
  plug KaarobarWeb.Plugs.Authorize, [permission: "organization:edit"] when action in [:update]

  @doc """
  The organizations the caller belongs to.

  Deliberately unscoped: this is what a client calls to decide which tenant to
  work in, and it filters by membership rather than by a selected tenant.
  """
  def index(conn, _params) do
    render(conn, :index,
      organizations: Tenancy.list_organizations_for_user(conn.assigns.current_user)
    )
  end

  @doc "The currently selected organization."
  def show(conn, _params) do
    case conn.assigns.scope do
      %Scope{organization: nil} -> {:error, :not_found}
      %Scope{organization: organization} -> render(conn, :show, organization: organization)
    end
  end

  @doc "Updates the currently selected organization."
  def update(conn, params) do
    scope = conn.assigns.scope

    with %Scope{organization: organization} when not is_nil(organization) <- scope,
         {:ok, updated} <- Tenancy.update_organization(scope, params) do
      Audit.log(scope, "organization.updated", updated,
        changes: %{after: Map.take(params, ~w(name timezone default_currency default_locale))}
      )

      render(conn, :show, organization: updated)
    else
      %Scope{} -> {:error, :not_found}
      {:error, changeset} -> {:error, changeset}
    end
  end
end
