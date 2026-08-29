defmodule KaarobarWeb.StaffController do
  @moduledoc """
  Staff: who works here, in what role, at which branches.

  Every mutation here is audited without exception. Role changes are the single
  most consequential thing anyone does in this system — everything else is
  bounded by them — and "who gave the new cashier refund approval" is a question
  that only ever gets asked after something has gone wrong.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.AccessControl
  alias Kaarobar.Audit
  alias Kaarobar.Staffing

  plug KaarobarWeb.Plugs.Authorize, [permission: "staff:view"] when action in [:index, :show]
  plug KaarobarWeb.Plugs.Authorize, [permission: "staff:edit"] when action in [:update, :set_pin]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "staff:deactivate"] when action in [:set_status, :delete]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "staff:assign_roles"] when action in [:assign_roles, :assign_branches]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "permission:grant"] when action in [:put_grant, :delete_grant]

  @doc "Lists staff."
  def index(conn, _params) do
    render(conn, :index, memberships: Staffing.list_staff(conn.assigns.scope))
  end

  @doc "One staff member, with their roles, branches and permission overrides."
  def show(conn, %{"id" => id}) do
    with {:ok, membership} <- Staffing.fetch_membership(conn.assigns.scope, id) do
      render(conn, :show,
        membership: membership,
        grants: AccessControl.list_grants(membership)
      )
    end
  end

  @doc "Updates a staff member's employment details."
  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, membership} <- Staffing.fetch_membership(scope, id),
         {:ok, updated} <- Staffing.update_membership(scope, membership, params) do
      Audit.log(scope, "membership.updated", updated,
        entity_type: "membership",
        label: staff_label(updated)
      )

      render(conn, :show, membership: updated, grants: AccessControl.list_grants(updated))
    end
  end

  @doc """
  Suspends, reinstates or ends a staff member.

  Suspending revokes their sign-in tokens, so a dismissal takes effect at the
  counter immediately rather than at their next sign-in.
  """
  def set_status(conn, %{"id" => id, "status" => status}) do
    scope = conn.assigns.scope

    with {:ok, membership} <- Staffing.fetch_membership(scope, id),
         {:ok, updated} <- Staffing.set_membership_status(scope, membership, status) do
      Audit.log(scope, "membership.status_changed", updated,
        entity_type: "membership",
        label: staff_label(updated),
        summary: "Status set to #{status}",
        changes: %{before: %{status: membership.status}, after: %{status: status}}
      )

      render(conn, :show, membership: updated, grants: AccessControl.list_grants(updated))
    end
  end

  def set_status(_conn, _params), do: {:error, :unprocessable_entity}

  @doc "Removes a staff member. Their history is retained."
  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, membership} <- Staffing.fetch_membership(scope, id),
         {:ok, removed} <- Staffing.remove_membership(scope, membership) do
      Audit.log(scope, "membership.removed", removed,
        entity_type: "membership",
        label: staff_label(removed)
      )

      send_resp(conn, :no_content, "")
    end
  end

  @doc """
  Replaces a staff member's roles.

  Rejected when any requested role outranks the caller's own — otherwise
  `staff:assign_roles` would be a route to full control.
  """
  def assign_roles(conn, %{"id" => id, "role_ids" => role_ids}) when is_list(role_ids) do
    scope = conn.assigns.scope

    with {:ok, membership} <- Staffing.fetch_membership(scope, id),
         {:ok, roles} <- AccessControl.assign_roles(scope, membership, role_ids),
         {:ok, reloaded} <- Staffing.fetch_membership(scope, id) do
      Audit.log(scope, "membership.roles_assigned", reloaded,
        entity_type: "membership",
        label: staff_label(reloaded),
        summary: "Roles set to #{Enum.map_join(roles, ", ", & &1.name)}",
        changes: %{after: %{roles: Enum.map(roles, & &1.key)}}
      )

      render(conn, :show, membership: reloaded, grants: AccessControl.list_grants(reloaded))
    end
  end

  def assign_roles(_conn, _params), do: {:error, :unprocessable_entity}

  @doc """
  Replaces a staff member's branch scoping.

  An empty list means every branch of their business.
  """
  def assign_branches(conn, %{"id" => id, "branch_ids" => branch_ids})
      when is_list(branch_ids) do
    scope = conn.assigns.scope

    with {:ok, membership} <- Staffing.fetch_membership(scope, id),
         {:ok, updated} <- Staffing.assign_branches(scope, membership, branch_ids) do
      Audit.log(scope, "membership.branches_assigned", updated,
        entity_type: "membership",
        label: staff_label(updated),
        changes: %{after: %{branch_ids: branch_ids}}
      )

      render(conn, :show, membership: updated, grants: AccessControl.list_grants(updated))
    end
  end

  def assign_branches(_conn, _params), do: {:error, :unprocessable_entity}

  @doc "Sets or clears a staff member's register PIN."
  def set_pin(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, membership} <- Staffing.fetch_membership(scope, id),
         {:ok, updated} <- Staffing.set_pin(scope, membership, params["pin"]) do
      # The PIN itself is never logged, only that one was set or cleared.
      Audit.log(scope, "membership.pin_changed", updated,
        entity_type: "membership",
        label: staff_label(updated),
        summary: if(params["pin"], do: "Register PIN set", else: "Register PIN cleared")
      )

      render(conn, :show, membership: updated, grants: AccessControl.list_grants(updated))
    end
  end

  @doc """
  Adds a per-person permission override.

  A caller may only `allow` a permission they hold themselves. `deny` is always
  permitted — taking access away is never an escalation.
  """
  def put_grant(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, membership} <- Staffing.fetch_membership(scope, id),
         {:ok, grant} <- AccessControl.put_grant(scope, membership, params) do
      Audit.log(scope, "membership.permission_granted", membership,
        entity_type: "membership",
        label: staff_label(membership),
        summary: "#{grant.effect} #{grant.permission_key}",
        metadata: %{reason: grant.reason}
      )

      conn
      |> put_status(:created)
      |> render(:grant, grant: grant)
    end
  end

  @doc "Removes a per-person override, returning the member to their roles."
  def delete_grant(conn, %{"id" => id, "permission_key" => permission_key}) do
    scope = conn.assigns.scope

    with {:ok, membership} <- Staffing.fetch_membership(scope, id),
         :ok <- AccessControl.delete_grant(scope, membership, permission_key) do
      Audit.log(scope, "membership.permission_revoked", membership,
        entity_type: "membership",
        label: staff_label(membership),
        summary: "Removed override for #{permission_key}"
      )

      send_resp(conn, :no_content, "")
    end
  end

  defp staff_label(membership) do
    case membership.user do
      %{name: name} -> name
      _not_loaded -> nil
    end
  end
end
