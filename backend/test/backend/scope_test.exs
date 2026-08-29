defmodule Kaarobar.ScopeTest do
  use ExUnit.Case, async: true

  alias Kaarobar.Scope

  @user %{id: "user-1"}
  @other_user %{id: "user-2"}
  @organization %{id: "org-1", owner_id: "user-1"}
  @business %{id: "biz-1", business_type: "retail"}
  @branch %{id: "branch-1"}

  defp employee_scope(permissions, opts \\ []) do
    @other_user
    |> Scope.for_user()
    |> Scope.put_organization(@organization)
    |> Scope.put_business(@business)
    |> Scope.put_access(
      permissions: permissions,
      branch_ids: Keyword.get(opts, :branch_ids, :all),
      role_keys: Keyword.get(opts, :role_keys, ["cashier"])
    )
  end

  defp owner_scope do
    @user
    |> Scope.for_user()
    |> Scope.put_organization(@organization)
    |> Scope.put_business(@business)
  end

  describe "authenticated?/1" do
    test "is false without a user and for nil" do
      refute Scope.authenticated?(%Scope{})
      refute Scope.authenticated?(nil)
    end

    test "is true once a user is attached" do
      assert Scope.authenticated?(Scope.for_user(@user))
    end
  end

  describe "can?/2" do
    test "denies everything when unauthenticated" do
      refute Scope.can?(nil, "sales:checkout")
      refute Scope.can?(%Scope{}, "sales:checkout")
    end

    test "grants only the permissions in the resolved set" do
      scope = employee_scope(["sales:checkout", "sales:print"])

      assert Scope.can?(scope, "sales:checkout")
      assert Scope.can?(scope, "sales:print")
      refute Scope.can?(scope, "sales:refund_approve")
      refute Scope.can?(scope, "business:edit")
    end

    test "the organization owner holds every permission" do
      scope = owner_scope()

      assert scope.owner?
      assert Scope.can?(scope, "business:edit")
      assert Scope.can?(scope, "anything:at:all")
    end

    test "a member of someone else's organization is not an owner" do
      refute employee_scope([]).owner?
    end
  end

  describe "authorize/2" do
    test "returns :ok when permitted and {:error, :forbidden} when not" do
      scope = employee_scope(["sales:checkout"])

      assert :ok = Scope.authorize(scope, "sales:checkout")
      assert {:error, :forbidden} = Scope.authorize(scope, "users:manage")
    end
  end

  describe "covers_branch?/2" do
    test "an unrestricted membership covers every branch" do
      scope = employee_scope([], branch_ids: :all)

      assert Scope.covers_branch?(scope, "branch-1")
      assert Scope.covers_branch?(scope, "branch-99")
    end

    test "a branch-restricted membership covers only its branches" do
      scope = employee_scope([], branch_ids: ["branch-1", "branch-2"])

      assert Scope.covers_branch?(scope, "branch-1")
      assert Scope.covers_branch?(scope, "branch-2")
      refute Scope.covers_branch?(scope, "branch-3")
    end

    test "the owner covers every branch regardless of restriction" do
      scope = Scope.put_access(owner_scope(), branch_ids: ["branch-1"])

      assert Scope.covers_branch?(scope, "branch-77")
    end

    test "a nil branch is never covered" do
      refute Scope.covers_branch?(employee_scope([]), nil)
    end
  end

  describe "entitlements" do
    test "an unresolved entitlement set allows everything" do
      assert Scope.entitled?(employee_scope([]), "purchase_orders")
    end

    test "a resolved set allows only its features" do
      scope = Scope.put_entitlements(employee_scope([]), ["pos", "sales"])

      assert Scope.entitled?(scope, "pos")
      refute Scope.entitled?(scope, "purchase_orders")
      assert {:error, :payment_required} = Scope.require_entitlement(scope, "purchase_orders")
    end

    test "the owner does not bypass entitlements — billing is not a permission" do
      scope = Scope.put_entitlements(owner_scope(), ["pos"])

      assert Scope.can?(scope, "purchase_orders:write")
      refute Scope.entitled?(scope, "purchase_orders")
    end
  end

  describe "identity accessors" do
    test "read ids through the attached records" do
      scope =
        owner_scope()
        |> Scope.put_branch(@branch)

      assert Scope.user_id(scope) == "user-1"
      assert Scope.organization_id(scope) == "org-1"
      assert Scope.business_id(scope) == "biz-1"
      assert Scope.branch_id(scope) == "branch-1"
    end

    test "return nil when the record is absent" do
      scope = Scope.for_user(@user)

      assert Scope.organization_id(scope) == nil
      assert Scope.business_id(scope) == nil
      assert Scope.branch_id(scope) == nil
    end
  end

  describe "logger_metadata/1" do
    test "includes only the ids that are present" do
      metadata = Scope.logger_metadata(Scope.for_user(@user))

      assert metadata[:user_id] == "user-1"
      refute Keyword.has_key?(metadata, :business_id)
    end

    test "includes the tenant once selected" do
      metadata = Scope.logger_metadata(owner_scope())

      assert metadata[:organization_id] == "org-1"
      assert metadata[:business_id] == "biz-1"
    end
  end
end
