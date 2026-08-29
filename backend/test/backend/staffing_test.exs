defmodule Kaarobar.StaffingTest do
  use Kaarobar.DataCase, async: true

  alias Kaarobar.AccessControl
  alias Kaarobar.Accounts
  alias Kaarobar.Scope
  alias Kaarobar.Scopes
  alias Kaarobar.Staffing
  alias Kaarobar.Tenancy

  defp invite_url(token), do: "http://app.test/invitations/#{token}"

  defp capture_invitation_token do
    assert_receive {:email, %Swoosh.Email{text_body: body}}
    [_whole, token] = Regex.run(~r{http://app.test/invitations/([\w\-]+)}, body)
    token
  end

  describe "invite/3" do
    setup do
      %{scope: owner} = owner_scope()
      {:ok, cashier_role} = AccessControl.fetch_system_role("cashier")
      %{owner: owner, cashier_role: cashier_role}
    end

    test "creates a pending invitation and emails a link", %{owner: owner, cashier_role: role} do
      assert {:ok, invitation} =
               Staffing.invite(
                 owner,
                 %{"email" => "new@shop.pk", "name" => "Sara", "role_id" => role.id},
                 &invite_url/1
               )

      assert invitation.status == "pending"
      assert invitation.email == "new@shop.pk"
      assert invitation.organization_id == owner.organization.id

      assert_receive {:email, %Swoosh.Email{} = email}
      assert email.to == [{"Sara", "new@shop.pk"}]
      assert email.text_body =~ "http://app.test/invitations/"
    end

    test "stores only the hash of the token", %{owner: owner, cashier_role: role} do
      {:ok, invitation} =
        Staffing.invite(owner, %{"email" => "new@shop.pk", "role_id" => role.id}, &invite_url/1)

      token = capture_invitation_token()

      refute invitation.token == token
      assert byte_size(invitation.token) == 32
    end

    test "refuses a role above the caller's rank", %{owner: owner} do
      %{scope: manager} = staff_scope(owner, "manager")
      {:ok, admin_role} = AccessControl.fetch_system_role("admin")

      assert {:error, :forbidden} =
               Staffing.invite(
                 manager,
                 %{"email" => "new@shop.pk", "role_id" => admin_role.id},
                 &invite_url/1
               )
    end

    test "refuses a role from another organization", %{owner: owner} do
      %{scope: other_owner} = owner_scope()

      {:ok, their_role} =
        AccessControl.create_role(other_owner, %{"name" => "Theirs", "permissions" => []})

      assert {:error, :not_found} =
               Staffing.invite(
                 owner,
                 %{"email" => "new@shop.pk", "role_id" => their_role.id},
                 &invite_url/1
               )
    end

    test "refuses branches outside the caller's scope", %{owner: owner, cashier_role: role} do
      {:ok, restricted_to} = Tenancy.create_branch(owner, %{"name" => "Assigned"})
      {:ok, other_branch} = Tenancy.create_branch(owner, %{"name" => "Elsewhere"})

      %{scope: supervisor} = staff_scope(owner, "supervisor", branch_ids: [restricted_to.id])

      assert {:error, :not_found} =
               Staffing.invite(
                 supervisor,
                 %{
                   "email" => "new@shop.pk",
                   "role_id" => role.id,
                   "branch_ids" => [other_branch.id]
                 },
                 &invite_url/1
               )
    end

    test "allows only one pending invitation per address", %{owner: owner, cashier_role: role} do
      {:ok, _first} =
        Staffing.invite(owner, %{"email" => "new@shop.pk", "role_id" => role.id}, &invite_url/1)

      assert {:error, changeset} =
               Staffing.invite(
                 owner,
                 %{"email" => "new@shop.pk", "role_id" => role.id},
                 &invite_url/1
               )

      assert "already has a pending invitation" in errors_on(changeset).email
    end
  end

  describe "accept_invitation/2" do
    setup do
      %{scope: owner} = owner_scope()
      {:ok, role} = AccessControl.fetch_system_role("cashier")

      {:ok, invitation} =
        Staffing.invite(
          owner,
          %{"email" => "sara@shop.pk", "name" => "Sara", "role_id" => role.id},
          &invite_url/1
        )

      %{owner: owner, invitation: invitation, token: capture_invitation_token(), role: role}
    end

    test "creates the account, the membership and the role in one go", %{
      owner: owner,
      token: token
    } do
      assert {:ok, %{user: user, membership: membership}} =
               Staffing.accept_invitation(token, %{"password" => "a-good-long-password"})

      assert user.email == "sara@shop.pk"
      assert user.name == "Sara"
      assert membership.organization_id == owner.organization.id
      assert membership.status == "active"

      {permissions, roles} = AccessControl.resolve(membership)
      assert roles == ["cashier"]
      assert MapSet.member?(permissions, "sales:checkout")
    end

    test "signs the new member in with a working scope", %{owner: owner, token: token} do
      {:ok, %{user: user}} =
        Staffing.accept_invitation(token, %{"password" => "a-good-long-password"})

      {:ok, scope} = Scopes.build(user, %{business_id: owner.business.id})

      assert Scope.can?(scope, "sales:checkout")
      refute Scope.can?(scope, "staff:invite")
    end

    test "an existing account joins with itself rather than being duplicated", %{owner: owner} do
      existing = insert(:user, email: "existing@shop.pk", name: "Existing Person")
      {:ok, role} = AccessControl.fetch_system_role("cashier")

      {:ok, _invitation} =
        Staffing.invite(
          owner,
          %{"email" => "existing@shop.pk", "role_id" => role.id},
          &invite_url/1
        )

      token = capture_invitation_token()

      assert {:ok, %{user: user}} = Staffing.accept_invitation(token, %{})
      assert user.id == existing.id
      matching = from(u in Kaarobar.Accounts.User, where: u.email == "existing@shop.pk")
      assert Repo.aggregate(matching, :count) == 1
    end

    test "a token works once", %{token: token} do
      {:ok, _result} = Staffing.accept_invitation(token, %{"password" => "a-good-long-password"})

      assert {:error, :invalid_token} =
               Staffing.accept_invitation(token, %{"password" => "a-good-long-password"})
    end

    test "a made-up token is refused" do
      assert {:error, :invalid_token} = Staffing.accept_invitation("nonsense", %{})
    end

    test "a revoked invitation cannot be accepted", %{
      owner: owner,
      invitation: invitation,
      token: token
    } do
      {:ok, _revoked} = Staffing.revoke_invitation(owner, invitation.id)

      assert {:error, :invalid_token} =
               Staffing.accept_invitation(token, %{"password" => "a-good-long-password"})
    end

    test "an expired invitation cannot be accepted", %{invitation: invitation, token: token} do
      invitation
      |> Ecto.Changeset.change(expires_at: DateTime.add(DateTime.utc_now(), -60, :second))
      |> Repo.update!()

      assert {:error, :invalid_token} =
               Staffing.accept_invitation(token, %{"password" => "a-good-long-password"})
    end

    test "the preview shows what the invitee needs and nothing more", %{token: token} do
      assert {:ok, preview} = Staffing.preview_invitation(token)

      assert preview.email == "sara@shop.pk"
      assert preview.role_name == "Cashier"
      assert preview.requires_account
      refute Map.has_key?(preview, :token)
    end
  end

  describe "membership status" do
    setup do
      %{scope: owner} = owner_scope()
      %{owner: owner}
    end

    test "suspending revokes the member's sign-in tokens", %{owner: owner} do
      %{user: user, membership: membership} = staff_scope(owner, "cashier")
      {plaintext, _token} = Accounts.create_bearer_token(user)

      assert {:ok, suspended} = Staffing.set_membership_status(owner, membership, "suspended")
      assert suspended.status == "suspended"
      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token(plaintext)
    end

    test "a member of another shop keeps their session", %{owner: owner} do
      %{scope: other_owner} = owner_scope()

      # One person, two jobs.
      user = insert(:user)

      here =
        insert(:membership,
          organization: owner.organization,
          user: user,
          business_id: owner.business.id
        )

      assign_role(here, "cashier")

      there =
        insert(:membership,
          organization: other_owner.organization,
          user: user,
          business_id: other_owner.business.id
        )

      assign_role(there, "cashier")

      {plaintext, _token} = Accounts.create_bearer_token(user)

      {:ok, _suspended} = Staffing.set_membership_status(owner, here, "suspended")

      # They still work at the other shop, so they stay signed in.
      assert {:ok, _user, _token} = Accounts.fetch_user_by_bearer_token(plaintext)
    end

    test "the owner cannot be suspended", %{owner: owner} do
      assert {:error, :forbidden} =
               Staffing.set_membership_status(owner, owner.membership, "suspended")
    end

    test "nobody can suspend themselves", %{owner: owner} do
      %{scope: manager, membership: membership} = staff_scope(owner, "manager")

      assert {:error, :forbidden} =
               Staffing.set_membership_status(manager, membership, "suspended")
    end

    test "ending sets the end date", %{owner: owner} do
      %{membership: membership} = staff_scope(owner, "cashier")

      assert {:ok, ended} = Staffing.set_membership_status(owner, membership, "ended")
      assert ended.ended_on == Date.utc_today()
    end

    test "the owner cannot be removed", %{owner: owner} do
      assert {:error, :forbidden} = Staffing.remove_membership(owner, owner.membership)
    end

    test "removing keeps the record for history", %{owner: owner} do
      %{membership: membership} = staff_scope(owner, "cashier")

      assert {:ok, removed} = Staffing.remove_membership(owner, membership)
      assert removed.deleted_at
      assert Repo.get(Kaarobar.Tenancy.Membership, membership.id)
      refute Enum.any?(Staffing.list_staff(owner), &(&1.id == membership.id))
    end
  end

  describe "register PIN" do
    setup do
      %{scope: owner} = owner_scope()
      %{membership: membership} = staff_scope(owner, "cashier")
      %{owner: owner, membership: membership}
    end

    test "is hashed, never stored", %{owner: owner, membership: membership} do
      assert {:ok, updated} = Staffing.set_pin(owner, membership, "4719")

      refute updated.pin_hash == "4719"
      assert Kaarobar.Tenancy.Membership.valid_pin?(updated, "4719")
      refute Kaarobar.Tenancy.Membership.valid_pin?(updated, "4718")
    end

    test "rejects a repeated digit", %{owner: owner, membership: membership} do
      assert {:error, changeset} = Staffing.set_pin(owner, membership, "1111")
      assert "must not be the same digit repeated" in errors_on(changeset).pin
    end

    test "rejects a run of consecutive digits", %{owner: owner, membership: membership} do
      assert {:error, changeset} = Staffing.set_pin(owner, membership, "1234")
      assert "must not be a run of consecutive digits" in errors_on(changeset).pin

      assert {:error, descending} = Staffing.set_pin(owner, membership, "4321")
      assert errors_on(descending).pin != []
    end

    test "rejects a non-numeric PIN", %{owner: owner, membership: membership} do
      assert {:error, changeset} = Staffing.set_pin(owner, membership, "abcd")
      assert "must be digits only" in errors_on(changeset).pin
    end

    test "rejects one that is too short", %{owner: owner, membership: membership} do
      assert {:error, changeset} = Staffing.set_pin(owner, membership, "471")
      assert errors_on(changeset).pin != []
    end

    test "can be cleared", %{owner: owner, membership: membership} do
      {:ok, with_pin} = Staffing.set_pin(owner, membership, "4719")
      assert {:ok, cleared} = Staffing.set_pin(owner, with_pin, nil)

      assert is_nil(cleared.pin_hash)
      refute Kaarobar.Tenancy.Membership.valid_pin?(cleared, "4719")
    end
  end

  describe "branch assignment" do
    setup do
      %{scope: owner} = owner_scope()
      {:ok, second} = Tenancy.create_branch(owner, %{"name" => "Second"})
      %{membership: membership} = staff_scope(owner, "supervisor")
      %{owner: owner, membership: membership, second: second}
    end

    test "narrows the member's scope", %{owner: owner, membership: membership, second: second} do
      assert {:ok, _updated} = Staffing.assign_branches(owner, membership, [second.id])

      user = Repo.get!(Kaarobar.Accounts.User, membership.user_id)
      {:ok, scope} = Scopes.build(user, %{business_id: owner.business.id})

      main = Enum.find(Tenancy.list_branches(owner), & &1.is_main)

      assert Scope.covers_branch?(scope, second.id)
      refute Scope.covers_branch?(scope, main.id)
      assert Enum.map(Tenancy.list_branches(scope), & &1.id) == [second.id]
    end

    test "an empty list means every branch", %{owner: owner, membership: membership, second: second} do
      {:ok, _restricted} = Staffing.assign_branches(owner, membership, [second.id])
      {:ok, unrestricted} = Staffing.assign_branches(owner, membership, [])

      assert unrestricted.membership_branches == []
    end

    test "refuses a branch from another organization", %{owner: owner, membership: membership} do
      %{branch: theirs} = owner_scope()

      assert {:error, :not_found} = Staffing.assign_branches(owner, membership, [theirs.id])
    end
  end

  describe "list_staff/1" do
    test "a business-scoped member sees their business and the org-wide staff" do
      %{scope: owner} = owner_scope()

      {:ok, %{business: other_business}} =
        Tenancy.create_business(owner, %{"name" => "Other", "business_type" => "fashion"})

      %{membership: mine} = staff_scope(owner, "cashier")

      elsewhere = insert(:user)

      theirs =
        insert(:membership,
          organization: owner.organization,
          user: elsewhere,
          business_id: other_business.id
        )

      assign_role(theirs, "cashier")

      %{scope: manager} = staff_scope(owner, "manager")

      ids = manager |> Staffing.list_staff() |> Enum.map(& &1.id)

      assert mine.id in ids
      # The owner's organization-wide membership is visible.
      assert owner.membership.id in ids
      # The other business's cashier is not.
      refute theirs.id in ids
    end
  end

end
