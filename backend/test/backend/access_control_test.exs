defmodule Kaarobar.AccessControlTest do
  use Kaarobar.DataCase, async: true

  alias Kaarobar.AccessControl
  alias Kaarobar.AccessControl.PermissionGrant
  alias Kaarobar.AccessControl.Role
  alias Kaarobar.Scope
  alias Kaarobar.Scopes

  describe "resolve/1" do
    test "returns nothing for no membership" do
      assert {permissions, []} = AccessControl.resolve(nil)
      assert MapSet.size(permissions) == 0
    end

    test "returns the union of every role held" do
      %{scope: owner} = owner_scope()
      %{membership: membership} = staff_scope(owner, "cashier")
      assign_role(membership, "kitchen")

      {permissions, role_keys} = AccessControl.resolve(membership)

      assert Enum.sort(role_keys) == ["cashier", "kitchen"]
      # From cashier
      assert MapSet.member?(permissions, "sales:checkout")
      # From kitchen
      assert MapSet.member?(permissions, "kitchen:bump")
    end

    test "an allow grant adds a permission the roles do not carry" do
      %{scope: owner} = owner_scope()
      %{membership: membership} = staff_scope(owner, "cashier")

      {before, _roles} = AccessControl.resolve(membership)
      refute MapSet.member?(before, "sale:refund_approve")

      {:ok, _grant} =
        AccessControl.put_grant(owner, membership, %{
          "permission_key" => "sale:refund_approve",
          "effect" => "allow",
          "reason" => "Covers the evening shift"
        })

      {after_grant, _roles} = AccessControl.resolve(membership)
      assert MapSet.member?(after_grant, "sale:refund_approve")
    end

    test "a deny grant removes a permission the roles do carry" do
      %{scope: owner} = owner_scope()
      %{membership: membership} = staff_scope(owner, "manager")

      {before, _roles} = AccessControl.resolve(membership)
      assert MapSet.member?(before, "sale:void")

      {:ok, _grant} =
        AccessControl.put_grant(owner, membership, %{
          "permission_key" => "sale:void",
          "effect" => "deny"
        })

      {after_grant, _roles} = AccessControl.resolve(membership)
      refute MapSet.member?(after_grant, "sale:void")
    end

    test "deny wins over an allow for the same permission" do
      # A single membership cannot hold both effects for one key — the unique
      # index forbids it — so this is the case that actually occurs: a deny
      # standing against a role that grants the same thing.
      %{scope: owner} = owner_scope()
      %{membership: membership} = staff_scope(owner, "manager")

      {:ok, _grant} =
        AccessControl.put_grant(owner, membership, %{
          "permission_key" => "purchase_order:approve",
          "effect" => "deny"
        })

      assign_role(membership, "supervisor")

      {permissions, _roles} = AccessControl.resolve(membership)
      refute MapSet.member?(permissions, "purchase_order:approve")
    end

    test "an expired grant no longer applies" do
      %{scope: owner} = owner_scope()
      %{membership: membership} = staff_scope(owner, "cashier")

      # Written directly: the changeset refuses a past expiry, which is correct
      # for the API but is exactly the state we need to test resolution against.
      Repo.insert!(%PermissionGrant{
        membership_id: membership.id,
        permission_key: "sale:refund_approve",
        effect: "allow",
        expires_at: DateTime.add(DateTime.utc_now(), -60, :second)
      })

      {permissions, _roles} = AccessControl.resolve(membership)
      refute MapSet.member?(permissions, "sale:refund_approve")
    end

    test "a grant with a future expiry does apply" do
      %{scope: owner} = owner_scope()
      %{membership: membership} = staff_scope(owner, "cashier")

      {:ok, _grant} =
        AccessControl.put_grant(owner, membership, %{
          "permission_key" => "sale:refund_approve",
          "effect" => "allow",
          "expires_at" => DateTime.add(DateTime.utc_now(), 3600, :second)
        })

      {permissions, _roles} = AccessControl.resolve(membership)
      assert MapSet.member?(permissions, "sale:refund_approve")
    end
  end

  describe "rank and role assignment" do
    setup do
      %{scope: owner} = owner_scope()
      %{owner: owner}
    end

    test "the owner may assign any role", %{owner: owner} do
      {:ok, admin} = AccessControl.fetch_system_role("admin")

      assert AccessControl.can_assign_role?(owner, admin)
    end

    test "a manager may assign a cashier but not an administrator", %{owner: owner} do
      %{scope: manager} = staff_scope(owner, "manager")

      {:ok, cashier_role} = AccessControl.fetch_system_role("cashier")
      {:ok, admin_role} = AccessControl.fetch_system_role("admin")

      assert AccessControl.can_assign_role?(manager, cashier_role)
      refute AccessControl.can_assign_role?(manager, admin_role)
    end

    test "a cashier may assign nothing, having no assign permission", %{owner: owner} do
      %{scope: cashier} = staff_scope(owner, "cashier")
      {:ok, viewer} = AccessControl.fetch_system_role("viewer")

      refute AccessControl.can_assign_role?(cashier, viewer)
    end

    test "assign_roles replaces rather than appends", %{owner: owner} do
      %{membership: membership} = staff_scope(owner, "cashier")
      {:ok, stock_keeper} = AccessControl.fetch_system_role("stock_keeper")

      {:ok, _roles} = AccessControl.assign_roles(owner, membership, [stock_keeper.id])

      {_permissions, role_keys} = AccessControl.resolve(membership)
      assert role_keys == ["stock_keeper"]
    end

    test "assign_roles refuses a role above the caller's rank", %{owner: owner} do
      %{scope: manager} = staff_scope(owner, "manager")
      %{membership: target} = staff_scope(owner, "cashier")
      {:ok, admin} = AccessControl.fetch_system_role("admin")

      assert {:error, :forbidden} = AccessControl.assign_roles(manager, target, [admin.id])
    end

    test "assign_roles refuses an unknown role", %{owner: owner} do
      %{membership: membership} = staff_scope(owner, "cashier")

      assert {:error, :not_found} =
               AccessControl.assign_roles(owner, membership, [Ecto.UUID.generate()])
    end
  end

  describe "custom roles" do
    setup do
      %{scope: owner} = owner_scope()
      %{owner: owner}
    end

    test "an owner can create one with any permission", %{owner: owner} do
      assert {:ok, role} =
               AccessControl.create_role(owner, %{
                 "name" => "Weekend supervisor",
                 "permissions" => ["sales:checkout", "sale:refund_approve"]
               })

      assert role.key == "weekend_supervisor"
      refute role.is_system
      assert Enum.sort(Role.permission_keys(role)) == ["sale:refund_approve", "sales:checkout"]
    end

    test "a role cannot contain permissions its creator lacks", %{owner: owner} do
      %{scope: manager} = staff_scope(owner, "manager")

      {:ok, role} =
        AccessControl.create_role(manager, %{
          "name" => "Helper",
          # A manager holds the first; they do not hold the second.
          "permissions" => ["sales:checkout", "organization:billing"]
        })

      assert Role.permission_keys(role) == ["sales:checkout"]
    end

    test "unknown permission keys are dropped rather than accepted", %{owner: owner} do
      {:ok, role} =
        AccessControl.create_role(owner, %{
          "name" => "Typo role",
          "permissions" => ["sales:checkout", "sales:checkuot"]
        })

      assert Role.permission_keys(role) == ["sales:checkout"]
    end

    test "a custom role can never outrank its creator", %{owner: owner} do
      %{scope: manager} = staff_scope(owner, "manager")

      {:ok, role} =
        AccessControl.create_role(manager, %{
          "name" => "Sneaky",
          "rank" => 0,
          "permissions" => ["sales:checkout"]
        })

      assert role.rank >= AccessControl.rank_of(manager.membership)
    end

    test "a system role cannot be edited", %{owner: owner} do
      {:ok, cashier} = AccessControl.fetch_system_role("cashier")

      assert {:error, :forbidden} =
               AccessControl.update_role(owner, cashier, %{"name" => "Renamed"})
    end

    test "a system role cannot be deleted", %{owner: owner} do
      {:ok, cashier} = AccessControl.fetch_system_role("cashier")

      assert {:error, :forbidden} = AccessControl.delete_role(owner, cashier)
    end

    test "a role still held by staff cannot be deleted", %{owner: owner} do
      {:ok, role} =
        AccessControl.create_role(owner, %{"name" => "Temp", "permissions" => ["sale:view"]})

      %{membership: membership} = staff_scope(owner, "cashier")
      {:ok, _roles} = AccessControl.assign_roles(owner, membership, [role.id])

      assert {:error, :conflict} = AccessControl.delete_role(owner, role)
    end

    test "an unused custom role can be deleted", %{owner: owner} do
      {:ok, role} =
        AccessControl.create_role(owner, %{"name" => "Unused", "permissions" => ["sale:view"]})

      assert {:ok, deleted} = AccessControl.delete_role(owner, role)
      assert deleted.deleted_at
    end

    test "roles from another organization are invisible", %{owner: owner} do
      %{scope: other_owner} = owner_scope()

      {:ok, theirs} =
        AccessControl.create_role(other_owner, %{"name" => "Theirs", "permissions" => []})

      assert {:error, :not_found} = AccessControl.fetch_role(owner, theirs.id)
      refute Enum.any?(AccessControl.list_roles(owner), &(&1.id == theirs.id))
    end

    test "system roles are visible to every organization", %{owner: owner} do
      keys = owner |> AccessControl.list_roles() |> Enum.map(& &1.key)

      assert "owner" in keys
      assert "cashier" in keys
    end
  end

  describe "grants" do
    setup do
      %{scope: owner} = owner_scope()
      %{owner: owner}
    end

    test "a caller cannot allow a permission they do not hold", %{owner: owner} do
      %{scope: manager} = staff_scope(owner, "manager")
      %{membership: target} = staff_scope(owner, "cashier")

      assert {:error, :forbidden} =
               AccessControl.put_grant(manager, target, %{
                 "permission_key" => "organization:billing",
                 "effect" => "allow"
               })
    end

    test "a caller may always deny, since removing access is not escalation", %{owner: owner} do
      %{scope: manager} = staff_scope(owner, "manager")
      %{membership: target} = staff_scope(owner, "cashier")

      assert {:ok, grant} =
               AccessControl.put_grant(manager, target, %{
                 "permission_key" => "organization:billing",
                 "effect" => "deny"
               })

      assert grant.effect == "deny"
    end

    test "putting a grant twice replaces rather than duplicating", %{owner: owner} do
      %{membership: membership} = staff_scope(owner, "cashier")

      {:ok, _first} =
        AccessControl.put_grant(owner, membership, %{
          "permission_key" => "sale:void",
          "effect" => "allow"
        })

      {:ok, second} =
        AccessControl.put_grant(owner, membership, %{
          "permission_key" => "sale:void",
          "effect" => "deny"
        })

      assert second.effect == "deny"
      assert length(AccessControl.list_grants(membership)) == 1
    end

    test "deleting a grant returns the member to their roles", %{owner: owner} do
      %{membership: membership} = staff_scope(owner, "manager")

      {:ok, _grant} =
        AccessControl.put_grant(owner, membership, %{
          "permission_key" => "sale:void",
          "effect" => "deny"
        })

      {denied, _roles} = AccessControl.resolve(membership)
      refute MapSet.member?(denied, "sale:void")

      :ok = AccessControl.delete_grant(owner, membership, "sale:void")

      {restored, _roles} = AccessControl.resolve(membership)
      assert MapSet.member?(restored, "sale:void")
    end
  end

  describe "the owner bypass" do
    test "the owner holds every permission without any role rows" do
      %{scope: owner, organization: organization, user: user} = owner_scope()

      assert owner.owner?
      assert Scope.can?(owner, "organization:delete")
      assert Scope.can?(owner, "data:erase")

      # Even with every role removed.
      Repo.delete_all(Kaarobar.AccessControl.MembershipRole)
      {:ok, rebuilt} = Scopes.build(user, %{organization_id: organization.id})

      assert Scope.can?(rebuilt, "organization:delete")
    end

    test "a non-owner with no roles holds nothing" do
      %{scope: owner} = owner_scope()
      %{scope: staff} = staff_scope(owner, "viewer")

      Repo.delete_all(Kaarobar.AccessControl.MembershipRole)
      {:ok, rebuilt} = Scopes.build(staff.user, %{business_id: owner.business.id})

      refute Scope.can?(rebuilt, "sale:view")
      refute Scope.can?(rebuilt, "sales:checkout")
    end
  end

  describe "sync_permissions/0" do
    test "is idempotent" do
      {:ok, first} = AccessControl.sync_permissions()
      {:ok, second} = AccessControl.sync_permissions()

      assert first.inserted == second.inserted
      assert second.deleted == 0
      assert length(AccessControl.list_permissions()) == length(Kaarobar.AccessControl.Permissions.keys())
    end
  end
end
