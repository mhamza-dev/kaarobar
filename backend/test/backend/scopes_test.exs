defmodule Kaarobar.ScopesTest do
  @moduledoc """
  Scope resolution is the boundary between "the client says" and "the system
  knows". Everything downstream trusts the scope completely, so these tests are
  really the tenant-isolation tests.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Scopes
  alias Kaarobar.Tenancy
  alias Kaarobar.Tenancy.Business

  describe "tenant selection" do
    test "a business id resolves its organization too" do
      %{scope: owner, user: user, business: business, organization: organization} = owner_scope()
      assert owner.business.id == business.id

      {:ok, scope} = Scopes.build(user, %{business_id: business.id})

      assert scope.organization.id == organization.id
      assert scope.business.id == business.id
    end

    test "a user with exactly one organization needs no header at all" do
      %{user: user, organization: organization} = owner_scope()

      {:ok, scope} = Scopes.build(user, %{})

      assert scope.organization.id == organization.id
    end

    test "a user with several organizations gets no tenant without a header" do
      %{user: user, organization: first} = owner_scope()

      second = insert(:organization, owner: user)
      membership = insert(:membership, organization: second, user: user)
      assign_role(membership, "owner")

      {:ok, scope} = Scopes.build(user, %{})

      assert is_nil(scope.organization)
      assert first.id != second.id
    end

    test "a user with no organizations gets no tenant" do
      user = insert(:user)

      {:ok, scope} = Scopes.build(user, %{})

      assert is_nil(scope.organization)
      assert Scope.authenticated?(scope)
    end
  end

  describe "tenant isolation" do
    test "naming another organization's business finds nothing" do
      %{user: user} = owner_scope()
      %{business: theirs} = owner_scope()

      assert {:error, :not_found} = Scopes.build(user, %{business_id: theirs.id})
    end

    test "naming another organization finds nothing" do
      %{user: user} = owner_scope()
      %{organization: theirs} = owner_scope()

      assert {:error, :not_found} = Scopes.build(user, %{organization_id: theirs.id})
    end

    test "naming another organization's branch finds nothing" do
      %{user: user, business: business} = owner_scope()
      %{branch: theirs} = owner_scope()

      assert {:error, :not_found} =
               Scopes.build(user, %{business_id: business.id, branch_id: theirs.id})
    end

    test "a malformed id is refused rather than crashing" do
      %{user: user} = owner_scope()

      assert {:error, :not_found} = Scopes.build(user, %{business_id: "'; DROP TABLE users;--"})
      assert {:error, :not_found} = Scopes.build(user, %{organization_id: "nope"})
    end

    test "an ended membership grants nothing" do
      %{scope: owner} = owner_scope()
      %{user: user, membership: membership} = staff_scope(owner, "cashier")

      membership |> Ecto.Changeset.change(status: "ended") |> Repo.update!()

      assert {:error, :not_found} = Scopes.build(user, %{business_id: owner.business.id})
    end

    test "a soft-deleted membership grants nothing" do
      %{scope: owner} = owner_scope()
      %{user: user, membership: membership} = staff_scope(owner, "cashier")

      membership
      |> Ecto.Changeset.change(deleted_at: DateTime.utc_now())
      |> Repo.update!()

      assert {:error, :not_found} = Scopes.build(user, %{business_id: owner.business.id})
    end
  end

  describe "branch selection" do
    test "a single-branch business selects its branch automatically" do
      %{user: user, business: business, branch: branch} = owner_scope()

      {:ok, scope} = Scopes.build(user, %{business_id: business.id})

      assert scope.branch.id == branch.id
    end

    test "a multi-branch business requires the client to say which" do
      %{scope: owner, user: user, business: business} = owner_scope()
      {:ok, _second} = Tenancy.create_branch(owner, %{"name" => "Second"})

      {:ok, scope} = Scopes.build(user, %{business_id: business.id})

      assert is_nil(scope.branch)
    end

    test "a named branch is selected" do
      %{scope: owner, user: user, business: business} = owner_scope()
      {:ok, second} = Tenancy.create_branch(owner, %{"name" => "Second"})

      {:ok, scope} = Scopes.build(user, %{business_id: business.id, branch_id: second.id})

      assert scope.branch.id == second.id
    end

    test "a branch outside the membership's scoping is refused" do
      %{scope: owner, business: business} = owner_scope()
      {:ok, allowed} = Tenancy.create_branch(owner, %{"name" => "Allowed"})
      {:ok, forbidden} = Tenancy.create_branch(owner, %{"name" => "Forbidden"})

      %{user: user} = staff_scope(owner, "supervisor", branch_ids: [allowed.id])

      assert {:ok, _scope} = Scopes.build(user, %{business_id: business.id, branch_id: allowed.id})

      assert {:error, :not_found} =
               Scopes.build(user, %{business_id: business.id, branch_id: forbidden.id})
    end

    test "a branch cannot be selected without a business" do
      %{user: user, branch: branch, organization: organization} = owner_scope()

      assert {:error, :not_found} =
               Scopes.build(user, %{organization_id: organization.id, branch_id: branch.id})
    end
  end

  describe "membership precedence" do
    test "an organization-wide membership wins over a business-specific one" do
      %{scope: owner, user: user, organization: organization, business: business} = owner_scope()

      # The owner already has an organization-wide membership. Add a narrower
      # one for the same business and confirm the broader one still applies.
      narrow =
        insert(:membership, organization: organization, user: user, business_id: business.id)

      assign_role(narrow, "kitchen")

      {:ok, scope} = Scopes.build(user, %{organization_id: organization.id})

      assert scope.membership.id == owner.membership.id
    end

    test "for a specific business, the business membership wins" do
      %{scope: owner} = owner_scope()
      user = insert(:user)

      org_wide = insert(:membership, organization: owner.organization, user: user)
      assign_role(org_wide, "viewer")

      specific =
        insert(:membership,
          organization: owner.organization,
          user: user,
          business_id: owner.business.id
        )

      assign_role(specific, "manager")

      {:ok, scope} = Scopes.build(user, %{business_id: owner.business.id})

      assert scope.membership.id == specific.id
      assert Scope.can?(scope, "purchase_order:approve")
    end
  end

  describe "Repo.Scoped" do
    test "refuses a query when the scope has no organization" do
      scope = Scopes.for_user(insert(:user))

      assert_raise ArgumentError, ~r/without an organization/, fn ->
        Scoped.for_organization(Business, scope)
      end
    end

    test "refuses a business query when no business is selected" do
      %{user: user, organization: organization} = owner_scope()
      {:ok, scope} = Scopes.build(user, %{organization_id: organization.id})

      assert_raise ArgumentError, ~r/without a business/, fn ->
        Scoped.for_business(Kaarobar.Tenancy.Branch, scope)
      end
    end

    test "refuses a branch query when no branch is selected" do
      %{scope: owner, user: user, business: business} = owner_scope()
      {:ok, _second} = Tenancy.create_branch(owner, %{"name" => "Second"})
      {:ok, scope} = Scopes.build(user, %{business_id: business.id})

      assert is_nil(scope.branch)

      assert_raise ArgumentError, ~r/without a branch/, fn ->
        Scoped.for_branch(Kaarobar.Tenancy.Branch, scope)
      end
    end

    test "filters to the scope's organization" do
      %{scope: owner} = owner_scope()
      %{business: theirs} = owner_scope()

      ids =
        Business
        |> Scoped.for_organization(owner)
        |> Repo.all()
        |> Enum.map(& &1.id)

      assert owner.business.id in ids
      refute theirs.id in ids
    end
  end

  describe "resolved authority" do
    test "the scope carries the permission set, resolved once" do
      %{scope: owner} = owner_scope()
      %{scope: cashier} = staff_scope(owner, "cashier")

      assert MapSet.member?(cashier.permissions, "sales:checkout")
      refute MapSet.member?(cashier.permissions, "sale:refund_approve")
      assert cashier.role_keys == ["cashier"]
    end

    test "the owner's permission set is empty but they can do everything" do
      %{scope: owner} = owner_scope()

      assert owner.owner?
      assert Scope.can?(owner, "organization:delete")
    end

    test "branch scoping reaches the scope" do
      %{scope: owner} = owner_scope()
      {:ok, allowed} = Tenancy.create_branch(owner, %{"name" => "Allowed"})

      %{scope: supervisor} = staff_scope(owner, "supervisor", branch_ids: [allowed.id])

      assert supervisor.branch_ids == MapSet.new([allowed.id])
    end
  end
end
