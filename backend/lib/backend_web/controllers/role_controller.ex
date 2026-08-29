defmodule KaarobarWeb.RoleController do
  @moduledoc """
  Roles and the permission catalogue.

  System roles are visible to every organization and editable by none. Custom
  roles belong to one organization, and can only ever contain permissions the
  person creating them already holds — otherwise `role:create` would be the
  simplest privilege escalation in the product.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.AccessControl
  alias Kaarobar.AccessControl.Permissions
  alias Kaarobar.Audit

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "role:view"] when action in [:index, :show, :permissions]

  plug KaarobarWeb.Plugs.Authorize, [permission: "role:create"] when action in [:create]
  plug KaarobarWeb.Plugs.Authorize, [permission: "role:edit"] when action in [:update]
  plug KaarobarWeb.Plugs.Authorize, [permission: "role:delete"] when action in [:delete]

  @doc "Lists system and custom roles, most powerful first."
  def index(conn, _params) do
    render(conn, :index, roles: AccessControl.list_roles(conn.assigns.scope))
  end

  @doc "One role and everything it grants."
  def show(conn, %{"id" => id}) do
    with {:ok, role} <- AccessControl.fetch_role(conn.assigns.scope, id) do
      render(conn, :show, role: role)
    end
  end

  @doc "Creates a custom role."
  def create(conn, params) do
    scope = conn.assigns.scope

    with {:ok, role} <- AccessControl.create_role(scope, params) do
      Audit.log(scope, "role.created", role,
        summary: "Created role #{role.name}",
        changes: %{after: %{permissions: Kaarobar.AccessControl.Role.permission_keys(role)}}
      )

      conn
      |> put_status(:created)
      |> render(:show, role: role)
    end
  end

  @doc "Updates a custom role. System roles are refused."
  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, role} <- AccessControl.fetch_role(scope, id),
         {:ok, updated} <- AccessControl.update_role(scope, role, params) do
      Audit.log(scope, "role.updated", updated,
        changes: %{after: %{permissions: Kaarobar.AccessControl.Role.permission_keys(updated)}}
      )

      render(conn, :show, role: updated)
    end
  end

  @doc """
  Deletes a custom role.

  Refused while anyone still holds it: deleting a role out from under staff
  would silently remove their access, and the first anyone hears of it is a
  cashier who cannot open the till.
  """
  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, role} <- AccessControl.fetch_role(scope, id),
         {:ok, deleted} <- AccessControl.delete_role(scope, role) do
      Audit.log(scope, "role.deleted", deleted)
      send_resp(conn, :no_content, "")
    end
  end

  @doc """
  The permission catalogue, grouped by module.

  Feeds the role editor. Served from code rather than the database so the list
  is always exactly what the running application enforces.
  """
  def permissions(conn, _params) do
    json(conn, %{
      data: %{
        groups:
          Permissions.by_group()
          |> Map.new(fn {group, permissions} -> {to_string(group), permissions} end),
        order: Enum.map(Permissions.groups(), &to_string/1)
      }
    })
  end
end
