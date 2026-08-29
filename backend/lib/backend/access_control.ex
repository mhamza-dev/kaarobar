defmodule Kaarobar.AccessControl do
  @moduledoc """
  Roles, permissions, and the resolution that turns them into an answer.

  ## Resolution order

  For a given membership, the effective permission set is built once per
  request and in this order:

  1. the union of every role the membership holds
  2. plus every in-force `allow` grant
  3. minus every in-force `deny` grant

  **Deny wins.** Revoking one dangerous permission from one person must not
  depend on getting a role edit right, and must not be silently undone when
  somebody adds a second role later.

  The organization owner is handled above this, in `Kaarobar.Scope`: they hold
  everything unconditionally and cannot lock themselves out of their own
  account.

  ## Why resolve eagerly

  The alternative — querying roles on each permission check — would put three
  joins in front of every authorization decision, and there is at least one on
  every request. Resolving once into a `MapSet` makes a check a set lookup.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.AccessControl.MembershipRole
  alias Kaarobar.AccessControl.Permission
  alias Kaarobar.AccessControl.PermissionGrant
  alias Kaarobar.AccessControl.Permissions
  alias Kaarobar.AccessControl.Role
  alias Kaarobar.AccessControl.RolePermission
  alias Kaarobar.AccessControl.RoleTemplates
  alias Kaarobar.Repo
  alias Kaarobar.Scope
  alias Kaarobar.Tenancy.Membership

  # --- Resolution -------------------------------------------------------------

  @doc """
  Resolves a membership's effective permissions and role keys.

  Returns `{permissions, role_keys}` where `permissions` is a `MapSet` of keys.
  One query for roles, one for grants; nothing downstream touches these tables
  again for the life of the request.
  """
  @spec resolve(Membership.t() | nil) :: {MapSet.t(String.t()), [String.t()]}
  def resolve(nil), do: {MapSet.new(), []}

  def resolve(%Membership{} = membership) do
    {role_keys, role_permissions} = role_permissions(membership.id)
    {allows, denies} = grant_permissions(membership.id)

    permissions =
      role_permissions
      |> MapSet.union(allows)
      |> MapSet.difference(denies)

    {permissions, role_keys}
  end

  @doc """
  The rank of the most powerful role a membership holds.

  Used to stop a member from assigning a role above their own — without it,
  `staff:assign_roles` would amount to full control.
  """
  @spec rank_of(Membership.t() | nil) :: non_neg_integer()
  def rank_of(nil), do: 1_000

  def rank_of(%Membership{} = membership) do
    query =
      from membership_role in MembershipRole,
        join: role in assoc(membership_role, :role),
        where: membership_role.membership_id == ^membership.id,
        where: is_nil(role.deleted_at),
        select: min(role.rank)

    Repo.one(query) || 1_000
  end

  @doc """
  True when the scope may assign the given role.

  The owner may assign anything. Everyone else is limited to roles at or below
  their own rank.
  """
  @spec can_assign_role?(Scope.t(), Role.t()) :: boolean()
  def can_assign_role?(%Scope{owner?: true}, %Role{}), do: true

  def can_assign_role?(%Scope{} = scope, %Role{} = role) do
    Scope.can?(scope, "staff:assign_roles") and rank_of(scope.membership) <= role.rank
  end

  defp role_permissions(membership_id) do
    rows =
      from(membership_role in MembershipRole,
        join: role in assoc(membership_role, :role),
        left_join: role_permission in RolePermission,
        on: role_permission.role_id == role.id,
        where: membership_role.membership_id == ^membership_id,
        where: is_nil(role.deleted_at),
        select: {role.key, role_permission.permission_key}
      )
      |> Repo.all()

    role_keys = rows |> Enum.map(&elem(&1, 0)) |> Enum.uniq()

    permissions =
      rows
      |> Enum.map(&elem(&1, 1))
      |> Enum.reject(&is_nil/1)
      |> MapSet.new()

    {role_keys, permissions}
  end

  defp grant_permissions(membership_id) do
    now = DateTime.utc_now()

    grants =
      from(grant in PermissionGrant,
        where: grant.membership_id == ^membership_id,
        where: is_nil(grant.expires_at) or grant.expires_at > ^now,
        select: {grant.effect, grant.permission_key}
      )
      |> Repo.all()

    allows = for {"allow", key} <- grants, into: MapSet.new(), do: key
    denies = for {"deny", key} <- grants, into: MapSet.new(), do: key

    {allows, denies}
  end

  # --- Permissions catalogue --------------------------------------------------

  @doc "Every permission in the catalogue, from the database."
  @spec list_permissions() :: [Permission.t()]
  def list_permissions do
    Repo.all(from permission in Permission, order_by: [asc: permission.group, asc: permission.key])
  end

  @doc """
  Writes the code catalogue into the database.

  Idempotent, and run by the seed. Permissions that no longer exist in code are
  deleted, which cascades to any role that still referenced them — a permission
  removed from the product must not linger as a grant nobody can see the
  meaning of.
  """
  @spec sync_permissions() :: {:ok, %{inserted: non_neg_integer(), deleted: non_neg_integer()}}
  def sync_permissions do
    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    entries =
      Enum.map(Permissions.all(), fn permission ->
        %{
          key: permission.key,
          group: to_string(permission.group),
          label: permission.label,
          inserted_at: now,
          updated_at: now
        }
      end)

    {inserted, _returning} =
      Repo.insert_all(Permission, entries,
        on_conflict: {:replace, [:group, :label, :updated_at]},
        conflict_target: :key
      )

    {deleted, _returning} =
      Repo.delete_all(from permission in Permission, where: permission.key not in ^Permissions.keys())

    {:ok, %{inserted: inserted, deleted: deleted}}
  end

  @doc """
  Writes the system role templates into the database.

  Idempotent. A template's permission set is replaced wholesale rather than
  merged, so removing a permission from a template in code actually removes it
  everywhere.
  """
  @spec sync_system_roles() :: {:ok, non_neg_integer()}
  def sync_system_roles do
    Repo.transaction(fn ->
      Enum.each(RoleTemplates.all(), &upsert_system_role/1)
      length(RoleTemplates.all())
    end)
  end

  defp upsert_system_role(template) do
    role = fetch_system_role_struct(template.key) || %Role{}

    {:ok, role} =
      role
      |> Role.system_changeset(%{
        key: template.key,
        name: template.name,
        description: template.description,
        rank: template.rank
      })
      |> Repo.insert_or_update()

    replace_role_permissions(role, template.permissions)
  end

  defp replace_role_permissions(%Role{} = role, permission_keys) do
    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    Repo.delete_all(from rp in RolePermission, where: rp.role_id == ^role.id)

    entries =
      Enum.map(permission_keys, fn key ->
        %{
          id: Kaarobar.Ecto.UUIDv7.generate(),
          role_id: role.id,
          permission_key: key,
          inserted_at: now
        }
      end)

    Repo.insert_all(RolePermission, entries)
  end

  # --- Roles ------------------------------------------------------------------

  @doc """
  Lists the roles available to a scope: the shared system templates plus the
  organization's own.
  """
  @spec list_roles(Scope.t()) :: [Role.t()]
  def list_roles(%Scope{} = scope) do
    organization_id = Scope.organization_id(scope)

    from(role in Role,
      where: is_nil(role.deleted_at),
      where: is_nil(role.organization_id) or role.organization_id == ^organization_id,
      order_by: [asc: role.rank, asc: role.name],
      preload: [:role_permissions]
    )
    |> Repo.all()
  end

  @doc "Fetches a role visible to the scope."
  @spec fetch_role(Scope.t(), Ecto.UUID.t()) :: {:ok, Role.t()} | {:error, :not_found}
  def fetch_role(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id), do: do_fetch_role(scope, id), else: {:error, :not_found}
  end

  defp do_fetch_role(%Scope{} = scope, id) do
    organization_id = Scope.organization_id(scope)

    query =
      from role in Role,
        where: role.id == ^id,
        where: is_nil(role.deleted_at),
        where: is_nil(role.organization_id) or role.organization_id == ^organization_id,
        preload: [:role_permissions]

    case Repo.one(query) do
      nil -> {:error, :not_found}
      role -> {:ok, role}
    end
  end

  @doc "Fetches a system role template by key."
  @spec fetch_system_role(String.t()) :: {:ok, Role.t()} | {:error, :not_found}
  def fetch_system_role(key) do
    case fetch_system_role_struct(key) do
      nil -> {:error, :not_found}
      role -> {:ok, role}
    end
  end

  # A system role is identified by a NULL organization_id. Ecto refuses `nil`
  # in `get_by`, because `= NULL` is never true and silently matching nothing
  # is worse than an error — so the comparison is spelled out with is_nil/1.
  defp fetch_system_role_struct(key) do
    Repo.one(
      from role in Role,
        where: role.key == ^key,
        where: is_nil(role.organization_id),
        where: is_nil(role.deleted_at)
    )
  end

  @doc """
  Creates a custom role for the scope's organization.

  The requested permissions are filtered against what the caller themselves
  holds. Otherwise `role:create` would be a privilege escalation: a manager
  could mint a role containing `organization:billing` and assign it to
  themselves.
  """
  @spec create_role(Scope.t(), map()) :: {:ok, Role.t()} | {:error, Ecto.Changeset.t()}
  def create_role(%Scope{} = scope, attrs) do
    permission_keys = permitted_keys(scope, attrs)

    changeset =
      %Role{organization_id: Scope.organization_id(scope)}
      |> Role.create_changeset(attrs)
      |> put_rank_floor(scope)

    Repo.transaction(fn ->
      case Repo.insert(changeset) do
        {:ok, role} ->
          replace_role_permissions(role, permission_keys)
          Repo.preload(role, :role_permissions, force: true)

        {:error, failed} ->
          Repo.rollback(failed)
      end
    end)
  end

  @doc """
  Updates a custom role. System roles are refused.
  """
  @spec update_role(Scope.t(), Role.t(), map()) ::
          {:ok, Role.t()} | {:error, Ecto.Changeset.t() | :forbidden}
  def update_role(_scope, %Role{is_system: true}, _attrs), do: {:error, :forbidden}

  def update_role(%Scope{} = scope, %Role{} = role, attrs) do
    changeset =
      role
      |> Role.update_changeset(attrs)
      |> put_rank_floor(scope)

    Repo.transaction(fn ->
      case Repo.update(changeset) do
        {:ok, updated} ->
          if Map.has_key?(attrs, "permissions") or Map.has_key?(attrs, :permissions) do
            replace_role_permissions(updated, permitted_keys(scope, attrs))
          end

          Repo.preload(updated, :role_permissions, force: true)

        {:error, failed} ->
          Repo.rollback(failed)
      end
    end)
  end

  @doc "Soft-deletes a custom role. System roles are refused."
  @spec delete_role(Scope.t(), Role.t()) :: {:ok, Role.t()} | {:error, term()}
  def delete_role(_scope, %Role{is_system: true}), do: {:error, :forbidden}

  def delete_role(%Scope{}, %Role{} = role) do
    if role_in_use?(role) do
      {:error, :conflict}
    else
      role |> Role.soft_delete_changeset() |> Repo.update()
    end
  end

  defp role_in_use?(%Role{} = role) do
    Repo.exists?(from mr in MembershipRole, where: mr.role_id == ^role.id)
  end

  # A caller may only put permissions into a role that they hold themselves.
  # The owner holds everything, so this is a no-op for them.
  defp permitted_keys(%Scope{} = scope, attrs) do
    attrs
    |> Map.get("permissions", Map.get(attrs, :permissions, []))
    |> List.wrap()
    |> Enum.filter(&Permissions.known?/1)
    |> Enum.filter(&Scope.can?(scope, &1))
  end

  # A custom role can never outrank the person creating it.
  defp put_rank_floor(changeset, %Scope{owner?: true}), do: changeset

  defp put_rank_floor(changeset, %Scope{} = scope) do
    floor = rank_of(scope.membership)

    case Ecto.Changeset.get_field(changeset, :rank) do
      rank when is_integer(rank) and rank < floor ->
        Ecto.Changeset.put_change(changeset, :rank, floor)

      _rank ->
        changeset
    end
  end

  # --- Assignment -------------------------------------------------------------

  @doc """
  Replaces a membership's roles.

  Every requested role is checked against the caller's rank, so a manager
  cannot promote anyone — including themselves — to administrator.
  """
  @spec assign_roles(Scope.t(), Membership.t(), [Ecto.UUID.t()]) ::
          {:ok, [Role.t()]} | {:error, :forbidden | :not_found}
  def assign_roles(%Scope{} = scope, %Membership{} = membership, role_ids) do
    roles = list_roles_by_ids(scope, role_ids)

    cond do
      length(roles) != length(Enum.uniq(role_ids)) ->
        {:error, :not_found}

      Enum.any?(roles, &(not can_assign_role?(scope, &1))) ->
        {:error, :forbidden}

      true ->
        do_assign_roles(scope, membership, roles)
    end
  end

  defp do_assign_roles(%Scope{} = scope, %Membership{} = membership, roles) do
    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    entries =
      Enum.map(roles, fn role ->
        %{
          id: Kaarobar.Ecto.UUIDv7.generate(),
          membership_id: membership.id,
          role_id: role.id,
          assigned_by_id: Scope.user_id(scope),
          inserted_at: now
        }
      end)

    Repo.transaction(fn ->
      Repo.delete_all(from mr in MembershipRole, where: mr.membership_id == ^membership.id)
      Repo.insert_all(MembershipRole, entries)
      roles
    end)
  end

  defp list_roles_by_ids(%Scope{} = scope, role_ids) do
    organization_id = Scope.organization_id(scope)

    from(role in Role,
      where: role.id in ^role_ids,
      where: is_nil(role.deleted_at),
      where: is_nil(role.organization_id) or role.organization_id == ^organization_id
    )
    |> Repo.all()
  end

  # --- Per-person grants ------------------------------------------------------

  @doc """
  Adds or replaces a per-person permission override.

  A caller may only `allow` a permission they hold themselves; `deny` is always
  permitted, because taking access away is never an escalation.
  """
  @spec put_grant(Scope.t(), Membership.t(), map()) ::
          {:ok, PermissionGrant.t()} | {:error, Ecto.Changeset.t() | :forbidden}
  def put_grant(%Scope{} = scope, %Membership{} = membership, attrs) do
    effect = attrs["effect"] || attrs[:effect]
    key = attrs["permission_key"] || attrs[:permission_key]

    if effect == "allow" and not Scope.can?(scope, key) do
      {:error, :forbidden}
    else
      attrs =
        attrs
        |> stringify()
        |> Map.put("membership_id", membership.id)
        |> Map.put("granted_by_id", Scope.user_id(scope))

      %PermissionGrant{}
      |> PermissionGrant.changeset(attrs)
      |> Repo.insert(
        on_conflict: {:replace, [:effect, :reason, :expires_at, :granted_by_id, :updated_at]},
        conflict_target: [:membership_id, :permission_key]
      )
    end
  end

  @doc "Removes a per-person override, returning the membership to its roles."
  @spec delete_grant(Scope.t(), Membership.t(), String.t()) :: :ok
  def delete_grant(%Scope{}, %Membership{} = membership, permission_key) do
    Repo.delete_all(
      from grant in PermissionGrant,
        where: grant.membership_id == ^membership.id,
        where: grant.permission_key == ^permission_key
    )

    :ok
  end

  @doc "Lists a membership's overrides."
  @spec list_grants(Membership.t()) :: [PermissionGrant.t()]
  def list_grants(%Membership{} = membership) do
    Repo.all(
      from grant in PermissionGrant,
        where: grant.membership_id == ^membership.id,
        order_by: [asc: grant.permission_key]
    )
  end

  defp stringify(attrs) do
    Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
  end
end
