defmodule Kaarobar.TenancyTest do
  use Kaarobar.DataCase, async: true

  alias Kaarobar.AccessControl
  alias Kaarobar.Scope
  alias Kaarobar.Scopes
  alias Kaarobar.Tenancy
  alias Kaarobar.Tenancy.Branch

  describe "register_owner/1" do
    test "creates the user, organization, membership and owner role together" do
      assert {:ok, result} =
               Tenancy.register_owner(%{
                 "user" => %{
                   "email" => "owner@shop.pk",
                   "password" => "a-good-long-password",
                   "name" => "Ali"
                 },
                 "organization" => %{"name" => "Ali Traders"}
               })

      assert result.user.email == "owner@shop.pk"
      assert result.organization.owner_id == result.user.id
      assert result.organization.slug == "ali-traders"
      assert result.membership.organization_id == result.organization.id

      {permissions, roles} = AccessControl.resolve(result.membership)
      assert roles == ["owner"]
      assert MapSet.member?(permissions, "organization:delete")
    end

    test "optionally creates a first business and its main branch" do
      assert {:ok, result} =
               Tenancy.register_owner(%{
                 "user" => %{
                   "email" => "owner@shop.pk",
                   "password" => "a-good-long-password",
                   "name" => "Ali"
                 },
                 "organization" => %{"name" => "Ali Traders"},
                 "business" => %{"name" => "Ali Kiryana", "business_type" => "grocery"}
               })

      assert result.business.business_type == "grocery"
      assert result.business.currency == "PKR"
      assert result.branch.is_main
      assert result.branch.code == "MAIN"
    end

    test "rolls everything back when the user is invalid" do
      assert {:error, :user, changeset} =
               Tenancy.register_owner(%{
                 "user" => %{"email" => "bad", "password" => "x", "name" => "Ali"},
                 "organization" => %{"name" => "Ali Traders"}
               })

      assert errors_on(changeset).email != []
      assert Repo.aggregate(Kaarobar.Tenancy.Organization, :count) == 0
    end

    test "rolls the user back when the business is invalid" do
      assert {:error, :business, _changeset} =
               Tenancy.register_owner(%{
                 "user" => %{
                   "email" => "owner@shop.pk",
                   "password" => "a-good-long-password",
                   "name" => "Ali"
                 },
                 "organization" => %{"name" => "Ali Traders"},
                 "business" => %{"name" => "Nope", "business_type" => "crypto_mine"}
               })

      # A half-built account is not an account.
      assert Repo.aggregate(Kaarobar.Accounts.User, :count) == 0
      assert Repo.aggregate(Kaarobar.Tenancy.Organization, :count) == 0
    end

    test "falls back to a generated slug for a name with no Latin characters" do
      {:ok, result} =
        Tenancy.register_owner(%{
          "user" => %{
            "email" => "owner@shop.pk",
            "password" => "a-good-long-password",
            "name" => "علی"
          },
          "organization" => %{"name" => "علی ٹریڈرز"}
        })

      assert result.organization.slug =~ ~r/^org-[0-9a-f]+$/
    end
  end

  describe "businesses" do
    setup do
      %{scope: owner} = owner_scope()
      %{owner: owner}
    end

    test "creating one also creates its main branch", %{owner: owner} do
      assert {:ok, %{business: business, branch: branch}} =
               Tenancy.create_business(owner, %{
                 "name" => "Karahi Corner",
                 "business_type" => "restaurant"
               })

      assert business.business_type == "restaurant"
      assert branch.business_id == business.id
      assert branch.is_main
    end

    test "an unsupported business type is refused", %{owner: owner} do
      assert {:error, :business, changeset} =
               Tenancy.create_business(owner, %{"name" => "Nope", "business_type" => "spaceport"})

      assert "is not a supported kind of business" in errors_on(changeset).business_type
    end

    test "the vertical cannot be changed after creation", %{owner: owner} do
      {:ok, %{business: business}} =
        Tenancy.create_business(owner, %{"name" => "Salon", "business_type" => "salon"})

      {:ok, updated} =
        Tenancy.update_business(owner, business, %{
          "name" => "Renamed",
          "business_type" => "restaurant"
        })

      assert updated.name == "Renamed"
      assert updated.business_type == "salon"
    end

    test "module overrides may narrow but never widen", %{owner: owner} do
      {:ok, %{business: business}} =
        Tenancy.create_business(owner, %{"name" => "Studio", "business_type" => "salon"})

      {:ok, updated} =
        Tenancy.update_business(owner, business, %{
          "enabled_modules" => ["appointments", "tables", "kitchen"]
        })

      assert "appointments" in updated.enabled_modules
      refute "tables" in updated.enabled_modules
      refute "kitchen" in updated.enabled_modules
    end

    test "capabilities describe what the client should render", %{owner: owner} do
      {:ok, %{business: business}} =
        Tenancy.create_business(owner, %{"name" => "Karahi", "business_type" => "restaurant"})

      capabilities = Tenancy.business_capabilities(business)

      assert "tables" in capabilities.modules
      assert "kitchen" in capabilities.modules
      assert capabilities.required_sale_fields == [:service_mode]
      refute capabilities.requires_batch
    end

    test "another organization's business is invisible", %{owner: owner} do
      %{scope: other, business: their_business} = owner_scope()
      assert other.business.id == their_business.id

      assert {:error, :not_found} = Tenancy.fetch_business(owner, their_business.id)
      refute Enum.any?(Tenancy.list_businesses(owner), &(&1.id == their_business.id))
    end

    test "a malformed id is a 404, not a crash", %{owner: owner} do
      assert {:error, :not_found} = Tenancy.fetch_business(owner, "not-a-uuid")
    end

    test "archiving keeps the record but hides it", %{owner: owner} do
      {:ok, %{business: business}} =
        Tenancy.create_business(owner, %{"name" => "Closing", "business_type" => "retail"})

      {:ok, archived} = Tenancy.archive_business(owner, business)

      assert archived.deleted_at
      assert archived.status == "archived"
      refute Enum.any?(Tenancy.list_businesses(owner), &(&1.id == business.id))
      # Still on disk, for reporting and audit.
      assert Repo.get(Kaarobar.Tenancy.Business, business.id)
    end
  end

  describe "a member attached to one business" do
    test "sees only that business" do
      %{scope: owner} = owner_scope()

      {:ok, %{business: other_business}} =
        Tenancy.create_business(owner, %{"name" => "Second shop", "business_type" => "fashion"})

      %{scope: cashier} = staff_scope(owner, "cashier")

      visible = Tenancy.list_businesses(cashier)

      assert Enum.map(visible, & &1.id) == [owner.business.id]
      assert {:error, :not_found} = Tenancy.fetch_business(cashier, other_business.id)
    end
  end

  describe "branches" do
    setup do
      %{scope: owner, business: business} = owner_scope()
      %{owner: owner, business: business}
    end

    test "are created inside the selected business", %{owner: owner} do
      assert {:ok, branch} = Tenancy.create_branch(owner, %{"name" => "Second branch"})

      assert branch.business_id == owner.business.id
      assert branch.organization_id == owner.organization.id
      refute branch.is_main
    end

    test "cannot be created as main through params", %{owner: owner} do
      {:ok, branch} = Tenancy.create_branch(owner, %{"name" => "Sneaky", "is_main" => true})

      refute branch.is_main
    end

    test "derive a code from their name when none is given", %{owner: owner} do
      {:ok, branch} = Tenancy.create_branch(owner, %{"name" => "Gulberg Outlet"})

      assert branch.code == "GULBERGO"
    end

    test "reject a duplicate code within a business", %{owner: owner} do
      {:ok, _first} = Tenancy.create_branch(owner, %{"name" => "One", "code" => "DUP"})

      assert {:error, changeset} =
               Tenancy.create_branch(owner, %{"name" => "Two", "code" => "DUP"})

      assert "is already used by another branch" in errors_on(changeset).code
    end

    test "promoting demotes the previous main", %{owner: owner} do
      {:ok, second} = Tenancy.create_branch(owner, %{"name" => "Second"})

      assert {:ok, promoted} = Tenancy.set_main_branch(owner, second)
      assert promoted.is_main

      mains = Repo.all(from b in Branch, where: b.business_id == ^owner.business.id and b.is_main)
      assert length(mains) == 1
      assert hd(mains).id == second.id
    end

    test "the main branch cannot be archived", %{owner: owner} do
      main = Enum.find(Tenancy.list_branches(owner), & &1.is_main)

      assert {:error, :conflict} = Tenancy.archive_branch(owner, main)
    end

    test "a non-main branch can be archived", %{owner: owner} do
      {:ok, second} = Tenancy.create_branch(owner, %{"name" => "Second"})

      assert {:ok, archived} = Tenancy.archive_branch(owner, second)
      assert archived.deleted_at
      refute Enum.any?(Tenancy.list_branches(owner), &(&1.id == second.id))
    end
  end

  describe "branch-restricted staff" do
    test "see only the branches they are assigned to" do
      %{scope: owner} = owner_scope()
      {:ok, assigned} = Tenancy.create_branch(owner, %{"name" => "Assigned"})
      {:ok, _hidden} = Tenancy.create_branch(owner, %{"name" => "Hidden"})

      %{scope: supervisor} = staff_scope(owner, "supervisor", branch_ids: [assigned.id])

      visible = Tenancy.list_branches(supervisor)

      assert Enum.map(visible, & &1.id) == [assigned.id]
    end

    test "an unrestricted membership sees every branch" do
      %{scope: owner} = owner_scope()
      {:ok, _second} = Tenancy.create_branch(owner, %{"name" => "Second"})

      %{scope: supervisor} = staff_scope(owner, "supervisor")

      assert length(Tenancy.list_branches(supervisor)) == 2
    end
  end

  describe "organizations" do
    test "a user sees only the organizations they belong to" do
      %{scope: mine, user: user} = owner_scope()
      %{scope: _theirs} = owner_scope()

      assert Enum.map(Tenancy.list_organizations_for_user(user), & &1.id) == [mine.organization.id]
    end

    test "fetching another organization by id finds nothing" do
      %{user: user} = owner_scope()
      %{organization: theirs} = owner_scope()

      assert {:error, :not_found} = Tenancy.fetch_organization_for_user(user, theirs.id)
    end

    test "ownership can be transferred to an existing member" do
      %{scope: owner} = owner_scope()
      %{user: manager} = staff_scope(owner, "manager")

      assert {:ok, updated} = Tenancy.transfer_ownership(owner, manager)
      assert updated.owner_id == manager.id

      {:ok, rebuilt} = Scopes.build(manager, %{organization_id: owner.organization.id})
      assert rebuilt.owner?
      assert Scope.can?(rebuilt, "organization:delete")
    end

    test "ownership cannot be transferred to a stranger" do
      %{scope: owner} = owner_scope()
      stranger = insert(:user)

      assert {:error, :not_found} = Tenancy.transfer_ownership(owner, stranger)
    end
  end
end
