defmodule Kaarobar.Staffing do
  @moduledoc """
  Staff: who works for an organization, in which business, at which branches.

  Two safety rules run through this context, both learned from what actually
  goes wrong in shops rather than from a threat model:

  **Nobody can lock the owner out.** An owner cannot be suspended, ended or
  stripped of their roles through the staff screens. Somebody would eventually
  do it by accident, and the recovery path is a support ticket.

  **Nobody can suspend themselves.** Not because it is dangerous, but because
  it is always a misclick, and the person who did it can no longer undo it.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.AccessControl
  alias Kaarobar.AccessControl.MembershipRole
  alias Kaarobar.Accounts
  alias Kaarobar.Accounts.Notifier
  alias Kaarobar.Accounts.User
  alias Kaarobar.Ecto.UUIDv7
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Invitation
  alias Kaarobar.Tenancy.Membership
  alias Kaarobar.Tenancy.MembershipBranch

  @preloads [:user, :business, :membership_branches, membership_roles: :role]

  # ===========================================================================
  # Reading
  # ===========================================================================

  @doc """
  Lists staff visible to the scope.

  An organization-wide member sees everyone; a member attached to one business
  sees that business's staff plus the organization-wide members above them.
  """
  @spec list_staff(Scope.t()) :: [Membership.t()]
  def list_staff(%Scope{} = scope) do
    Membership
    |> Scoped.for_organization(scope)
    |> Scoped.active()
    |> restrict_to_visible_business(scope)
    |> preload(^@preloads)
    |> order_by([membership], asc: membership.inserted_at)
    |> Repo.all()
  end

  defp restrict_to_visible_business(query, %Scope{owner?: true}), do: query
  defp restrict_to_visible_business(query, %Scope{membership: nil}), do: query
  defp restrict_to_visible_business(query, %Scope{membership: %{business_id: nil}}), do: query

  defp restrict_to_visible_business(query, %Scope{membership: %{business_id: business_id}}) do
    where(query, [m], m.business_id == ^business_id or is_nil(m.business_id))
  end

  @doc "Fetches a staff member visible to the scope."
  @spec fetch_membership(Scope.t(), Ecto.UUID.t()) :: {:ok, Membership.t()} | {:error, :not_found}
  def fetch_membership(%Scope{} = scope, id) do
    if UUIDv7.valid?(id), do: do_fetch_membership(scope, id), else: {:error, :not_found}
  end

  defp do_fetch_membership(%Scope{} = scope, id) do
    Membership
    |> Scoped.for_organization(scope)
    |> Scoped.active()
    |> restrict_to_visible_business(scope)
    |> where([membership], membership.id == ^id)
    |> preload(^@preloads)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      membership -> {:ok, membership}
    end
  end

  @doc """
  The membership a user holds in an organization, used to build a scope.

  Prefers the organization-wide membership when a person holds both, so an
  administrator who is also attached to one business is not accidentally
  narrowed to it.
  """
  @spec fetch_membership_for(User.t(), Ecto.UUID.t()) ::
          {:ok, Membership.t()} | {:error, :not_found}
  def fetch_membership_for(%User{} = user, organization_id) do
    query =
      from membership in Membership,
        where: membership.user_id == ^user.id,
        where: membership.organization_id == ^organization_id,
        where: is_nil(membership.deleted_at),
        where: membership.status == "active",
        # The organization-wide membership wins, so an administrator who also
        # has a row for one business is not narrowed to it by accident.
        order_by: [asc: fragment("? IS NOT NULL", membership.business_id)],
        limit: 1,
        preload: [:membership_branches, membership_roles: :role]

    case Repo.one(query) do
      nil -> {:error, :not_found}
      membership -> {:ok, membership}
    end
  end

  @doc """
  The membership a user holds for a specific business.

  Falls back to their organization-wide membership, which is how an owner or
  administrator can act inside any of their businesses without a row per
  business.
  """
  @spec fetch_membership_for_business(User.t(), Ecto.UUID.t(), Ecto.UUID.t()) ::
          {:ok, Membership.t()} | {:error, :not_found}
  def fetch_membership_for_business(%User{} = user, organization_id, business_id) do
    query =
      from membership in Membership,
        where: membership.user_id == ^user.id,
        where: membership.organization_id == ^organization_id,
        where: membership.business_id == ^business_id or is_nil(membership.business_id),
        where: is_nil(membership.deleted_at),
        where: membership.status == "active",
        # A membership for this exact business wins over the org-wide one.
        order_by: [desc: fragment("? IS NOT NULL", membership.business_id)],
        limit: 1,
        preload: [:membership_branches, membership_roles: :role]

    case Repo.one(query) do
      nil -> {:error, :not_found}
      membership -> {:ok, membership}
    end
  end

  # ===========================================================================
  # Invitations
  # ===========================================================================

  @doc """
  Invites someone to join as staff.

  The role is checked against the inviter's rank first: without that,
  `staff:invite` would be a way to mint an administrator.

  `url_fun` receives the plaintext token and returns the acceptance link, so
  this context does not have to know how the client's routes are shaped.
  """
  @spec invite(Scope.t(), map(), (String.t() -> String.t())) ::
          {:ok, Invitation.t()} | {:error, Ecto.Changeset.t() | :forbidden | :not_found}
  def invite(%Scope{} = scope, attrs, url_fun) when is_function(url_fun, 1) do
    attrs = stringify(attrs)

    with {:ok, role} <- AccessControl.fetch_role(scope, attrs["role_id"]),
         :ok <- authorize_role_assignment(scope, role),
         {:ok, branch_ids} <- validate_branch_ids(scope, attrs["branch_ids"] || []) do
      {plaintext, changeset} =
        Invitation.build(
          Map.merge(attrs, %{
            "organization_id" => Scope.organization_id(scope),
            "business_id" => attrs["business_id"] || Scope.business_id(scope),
            "branch_ids" => branch_ids,
            "invited_by_id" => Scope.user_id(scope)
          })
        )

      case Repo.insert(changeset) do
        {:ok, invitation} ->
          send_invitation_email(scope, invitation, url_fun.(plaintext))
          {:ok, Repo.preload(invitation, [:role, :business])}

        {:error, failed} ->
          {:error, failed}
      end
    end
  end

  defp authorize_role_assignment(%Scope{} = scope, role) do
    if AccessControl.can_assign_role?(scope, role), do: :ok, else: {:error, :forbidden}
  end

  defp send_invitation_email(%Scope{} = scope, %Invitation{} = invitation, url) do
    Notifier.deliver_invitation(
      invitation.email,
      invitation.name,
      scope.organization.name,
      scope.user.name,
      url,
      invitation.message
    )
  end

  @doc "Lists outstanding invitations."
  @spec list_invitations(Scope.t()) :: [Invitation.t()]
  def list_invitations(%Scope{} = scope) do
    Invitation
    |> Scoped.for_organization(scope)
    |> where([invitation], invitation.status == "pending")
    |> preload([:role, :business, :invited_by])
    |> order_by([invitation], desc: invitation.inserted_at)
    |> Repo.all()
  end

  @doc "Withdraws an invitation."
  @spec revoke_invitation(Scope.t(), Ecto.UUID.t()) ::
          {:ok, Invitation.t()} | {:error, :not_found | Ecto.Changeset.t()}
  def revoke_invitation(%Scope{} = scope, id) do
    Invitation
    |> Scoped.for_organization(scope)
    |> where([invitation], invitation.id == ^id and invitation.status == "pending")
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      invitation -> invitation |> Invitation.revoke_changeset() |> Repo.update()
    end
  end

  @doc """
  Previews an invitation from its token, for the acceptance screen.

  Returns only what the invitee needs to decide: which organization, which
  business, which role. Nothing about other staff.
  """
  @spec preview_invitation(String.t()) :: {:ok, map()} | {:error, :invalid_token}
  def preview_invitation(plaintext_token) do
    case fetch_invitation_by_token(plaintext_token) do
      {:ok, invitation} ->
        invitation = Repo.preload(invitation, [:organization, :business, :role])

        {:ok,
         %{
           email: invitation.email,
           name: invitation.name,
           organization_name: invitation.organization.name,
           business_name: invitation.business && invitation.business.name,
           role_name: invitation.role.name,
           expires_at: invitation.expires_at,
           requires_account: is_nil(Accounts.get_user_by_email(invitation.email))
         }}

      :error ->
        {:error, :invalid_token}
    end
  end

  @doc """
  Accepts an invitation.

  Creates the user if they do not have an account, creates the membership,
  assigns the invited role and branch scoping, and marks the invitation used —
  in one transaction. A partially accepted invitation is a person who cannot
  sign in and cannot be re-invited.
  """
  @spec accept_invitation(String.t(), map()) ::
          {:ok, %{user: User.t(), membership: Membership.t()}}
          | {:error, :invalid_token | atom() | Ecto.Changeset.t()}
  def accept_invitation(plaintext_token, user_attrs) do
    case fetch_invitation_by_token(plaintext_token) do
      {:ok, invitation} -> do_accept_invitation(invitation, stringify(user_attrs))
      :error -> {:error, :invalid_token}
    end
  end

  defp do_accept_invitation(%Invitation{} = invitation, user_attrs) do
    Ecto.Multi.new()
    |> Ecto.Multi.run(:user, fn _repo, _changes ->
      accept_user(invitation, user_attrs)
    end)
    |> Ecto.Multi.insert(:membership, fn %{user: user} ->
      %Membership{
        organization_id: invitation.organization_id,
        user_id: user.id,
        business_id: invitation.business_id
      }
      |> Membership.create_changeset(%{"status" => "active", "started_on" => Date.utc_today()})
    end)
    |> Ecto.Multi.insert(:membership_role, fn %{membership: membership} ->
      MembershipRole.changeset(%MembershipRole{}, %{
        membership_id: membership.id,
        role_id: invitation.role_id,
        assigned_by_id: invitation.invited_by_id
      })
    end)
    |> Ecto.Multi.run(:branches, fn _repo, %{membership: membership} ->
      {:ok, put_membership_branches(membership, invitation.branch_ids)}
    end)
    |> Ecto.Multi.run(:invitation, fn _repo, %{user: user} ->
      invitation |> Invitation.accept_changeset(user) |> Repo.update()
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{user: user, membership: membership}} ->
        {:ok, %{user: user, membership: Repo.preload(membership, @preloads)}}

      {:error, _step, failed, _changes} ->
        {:error, failed}
    end
  end

  # An existing account joins as itself. A new one is created with the password
  # the invitee chooses now — the invitation proved they control the address.
  defp accept_user(%Invitation{} = invitation, user_attrs) do
    case Accounts.get_user_by_email(invitation.email) do
      %User{} = user ->
        {:ok, user}

      nil ->
        attrs =
          user_attrs
          |> Map.put("email", invitation.email)
          |> Map.put_new("name", invitation.name || invitation.email)

        Accounts.register_user(attrs)
    end
  end

  defp fetch_invitation_by_token(plaintext) do
    with {:ok, query} <- Invitation.verify_token_query(plaintext),
         %Invitation{} = invitation <- Repo.one(query) do
      {:ok, invitation}
    else
      _other -> :error
    end
  end

  # ===========================================================================
  # Membership management
  # ===========================================================================

  @doc "Updates a staff member's employment details."
  @spec update_membership(Scope.t(), Membership.t(), map()) ::
          {:ok, Membership.t()} | {:error, Ecto.Changeset.t()}
  def update_membership(%Scope{}, %Membership{} = membership, attrs) do
    membership |> Membership.update_changeset(attrs) |> Repo.update()
  end

  @doc """
  Suspends, reinstates or ends a staff member.

  Suspending revokes their sign-in tokens, so a dismissal takes effect at the
  counter immediately rather than at their next sign-in.
  """
  @spec set_membership_status(Scope.t(), Membership.t(), String.t()) ::
          {:ok, Membership.t()} | {:error, :forbidden | Ecto.Changeset.t()}
  def set_membership_status(%Scope{} = scope, %Membership{} = membership, status) do
    cond do
      owner_membership?(scope, membership) and status != "active" ->
        {:error, :forbidden}

      membership.user_id == Scope.user_id(scope) and status != "active" ->
        {:error, :forbidden}

      true ->
        apply_status(membership, status)
    end
  end

  defp apply_status(%Membership{} = membership, status) do
    case membership |> Membership.status_changeset(status) |> Repo.update() do
      {:ok, updated} ->
        if status != "active", do: revoke_user_sessions(updated)
        {:ok, Repo.preload(updated, @preloads, force: true)}

      {:error, failed} ->
        {:error, failed}
    end
  end

  # Only when they have no remaining active membership anywhere — signing
  # someone out of a shop they left should not sign them out of the one they
  # still work at.
  defp revoke_user_sessions(%Membership{} = membership) do
    still_employed? =
      Repo.exists?(
        from m in Membership,
          where: m.user_id == ^membership.user_id,
          where: m.id != ^membership.id,
          where: is_nil(m.deleted_at) and m.status == "active"
      )

    if not still_employed? do
      case Accounts.fetch_user(membership.user_id) do
        {:ok, user} -> Accounts.revoke_all_bearer_tokens(user)
        {:error, :not_found} -> :ok
      end
    end

    :ok
  end

  @doc """
  Removes a staff member.

  The owner cannot be removed. Their history stays — the sales they rang up
  still name them — because the membership is soft-deleted, not erased.
  """
  @spec remove_membership(Scope.t(), Membership.t()) ::
          {:ok, Membership.t()} | {:error, :forbidden | Ecto.Changeset.t()}
  def remove_membership(%Scope{} = scope, %Membership{} = membership) do
    if owner_membership?(scope, membership) or membership.user_id == Scope.user_id(scope) do
      {:error, :forbidden}
    else
      case membership |> Membership.soft_delete_changeset() |> Repo.update() do
        {:ok, removed} ->
          revoke_user_sessions(removed)
          {:ok, removed}

        {:error, failed} ->
          {:error, failed}
      end
    end
  end

  @doc "Sets or clears a staff member's register PIN."
  @spec set_pin(Scope.t(), Membership.t(), String.t() | nil) ::
          {:ok, Membership.t()} | {:error, Ecto.Changeset.t()}
  def set_pin(%Scope{}, %Membership{} = membership, pin) do
    membership |> Membership.pin_changeset(pin) |> Repo.update()
  end

  @doc """
  Replaces a staff member's branch scoping.

  An empty list means unrestricted — every branch of their business. Branches
  outside the caller's own scope are rejected rather than ignored, so a
  supervisor cannot quietly grant access to a branch they do not have.
  """
  @spec assign_branches(Scope.t(), Membership.t(), [Ecto.UUID.t()]) ::
          {:ok, Membership.t()} | {:error, :not_found}
  def assign_branches(%Scope{} = scope, %Membership{} = membership, branch_ids) do
    with {:ok, validated} <- validate_branch_ids(scope, branch_ids) do
      Repo.transaction(fn ->
        put_membership_branches(membership, validated)
        Repo.preload(membership, @preloads, force: true)
      end)
    end
  end

  defp put_membership_branches(%Membership{} = membership, branch_ids) do
    Repo.delete_all(from mb in MembershipBranch, where: mb.membership_id == ^membership.id)

    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    entries =
      Enum.map(branch_ids, fn branch_id ->
        %{
          id: UUIDv7.generate(),
          membership_id: membership.id,
          branch_id: branch_id,
          inserted_at: now
        }
      end)

    Repo.insert_all(MembershipBranch, entries)
    branch_ids
  end

  defp validate_branch_ids(_scope, []), do: {:ok, []}

  defp validate_branch_ids(%Scope{} = scope, branch_ids) when is_list(branch_ids) do
    if Enum.all?(branch_ids, &UUIDv7.valid?/1) do
      lookup_branch_ids(scope, branch_ids)
    else
      {:error, :not_found}
    end
  end

  defp validate_branch_ids(_scope, _branch_ids), do: {:error, :not_found}

  defp lookup_branch_ids(%Scope{} = scope, branch_ids) do
    organization_id = Scope.organization_id(scope)

    found =
      from(branch in Branch,
        where: branch.id in ^branch_ids,
        where: branch.organization_id == ^organization_id,
        where: is_nil(branch.deleted_at),
        select: branch.id
      )
      |> Repo.all()

    visible = Enum.filter(found, &Scope.covers_branch?(scope, &1))

    if length(visible) == length(Enum.uniq(branch_ids)) do
      {:ok, visible}
    else
      {:error, :not_found}
    end
  end

  defp owner_membership?(%Scope{organization: organization}, %Membership{} = membership) do
    organization && organization.owner_id == membership.user_id
  end

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
  end

  defp stringify(_attrs), do: %{}
end
