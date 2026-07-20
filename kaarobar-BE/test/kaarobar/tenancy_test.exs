defmodule Kaarobar.TenancyTest do
  use Kaarobar.DataCase

  alias Kaarobar.{Accounts, Audit, Roles, Tenancy}
  alias Kaarobar.Schemas.AuditLog
  alias Kaarobar.Repo

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "owner-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner"
      })

    {:ok, business} = Tenancy.create_business(owner.id, %{name: "Biz One"})
    {:ok, branch} = Tenancy.create_branch(business.id, owner, %{name: "Main"})

    %{owner: owner, business: business, branch: branch}
  end

  test "TEN-FR-001/002 owner can create multiple businesses and branches", %{owner: owner} do
    {:ok, b2} = Tenancy.create_business(owner.id, %{name: "Biz Two"})
    {:ok, _br2} = Tenancy.create_branch(b2.id, owner, %{name: "Outlet 2"})

    businesses = Tenancy.list_businesses_for_user(owner.id)
    assert length(businesses) == 2
  end

  test "TEN-FR-003/004 staff membership is scoped to branch", %{
    owner: owner,
    business: business,
    branch: branch
  } do
    {:ok, cashier} =
      Accounts.register(%{
        email: "cashier-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Cashier"
      })

    {:ok, other_branch} = Tenancy.create_branch(business.id, owner, %{name: "Other"})

    {:ok, _} =
      Tenancy.create_membership(owner, %{
        user_id: cashier.id,
        business_id: business.id,
        branch_id: branch.id,
        roles: ["cashier"]
      })

    assert Tenancy.user_can_access_business?(cashier, business.id)
    assert Tenancy.user_can_access_branch?(cashier, business.id, branch.id)
    refute Tenancy.user_can_access_branch?(cashier, business.id, other_branch.id)
    assert Tenancy.user_has_any_role?(cashier, business.id, branch.id, ["cashier"])
    refute Tenancy.user_has_any_role?(cashier, business.id, branch.id, ["accountant"])
  end

  test "TEN-FR-004 cross-tenant isolation", %{owner: owner, business: business} do
    {:ok, other} =
      Accounts.register(%{
        email: "other-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Other"
      })

    refute Tenancy.user_can_access_business?(other, business.id)
    assert Tenancy.user_is_owner?(owner, business.id)
  end

  test "TEN-FR-006 MFA setup and verify", %{owner: owner} do
    assert owner.mfa_required

    {:ok, %{secret: secret}} = Accounts.begin_mfa_setup(owner)
    owner = Accounts.get_user!(owner.id)
    {:ok, bin} = Base.decode32(secret, padding: false)
    code = NimbleTOTP.verification_code(bin)

    assert {:ok, enabled} = Accounts.confirm_mfa(owner, code)
    assert Accounts.mfa_enabled?(enabled)
    assert :ok = Accounts.verify_totp(enabled, code)
  end

  test "TEN-FR-008 audit log is written and immutable", %{owner: owner, business: business} do
    logs = Audit.list_for_owner(owner.id)
    assert Enum.any?(logs, &(&1.action == "business.create"))

    entry = Repo.get_by!(AuditLog, entity_id: business.id, action: "business.create")

    assert_raise Postgrex.Error, fn ->
      Repo.delete!(entry)
    end
  end

  test "TEN-FR-009 deactivate preserves row and blocks access", %{
    owner: owner,
    business: business,
    branch: branch
  } do
    assert {:ok, inactive_branch} = Tenancy.deactivate_branch(branch.id, owner)
    refute inactive_branch.is_active

    assert {:ok, inactive_biz} = Tenancy.deactivate_business(business.id, owner)
    refute inactive_biz.is_active
    refute Tenancy.user_can_access_business?(owner, business.id)

    # History still present
    assert Tenancy.get_business(business.id, owner.id)
    assert Tenancy.get_branch(branch.id, owner.id)
  end

  test "roles allowlist rejects unknown roles" do
    assert {:error, {:invalid_roles, ["superadmin"]}} =
             Roles.validate_roles(["cashier", "superadmin"])

    assert :ok = Roles.validate_roles(["owner", "accountant"])
  end
end
