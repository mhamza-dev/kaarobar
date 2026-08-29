defmodule Kaarobar.Tenancy do
  @moduledoc """
  Organizations, businesses and branches — the structure every other context
  scopes itself to.

  Reads take a `%Kaarobar.Scope{}` first and go through
  `Kaarobar.Repo.Scoped`, which refuses to build a query when the scope lacks
  the tenant it needs. The exceptions are the handful of functions that run
  *before* a scope exists — registration, and listing the organizations a user
  belongs to — and those take a `%User{}` explicitly so that the absence of a
  scope is visible in the signature rather than assumed.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.AccessControl
  alias Kaarobar.AccessControl.MembershipRole
  alias Kaarobar.Accounts.User
  alias Kaarobar.Catalog
  alias Kaarobar.Ecto.UUIDv7
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Taxes
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Membership
  alias Kaarobar.Tenancy.Organization
  alias Kaarobar.Verticals

  # ===========================================================================
  # Onboarding
  # ===========================================================================

  @doc """
  Registers an owner and their organization in one transaction.

  Everything a usable account needs is created together: the user, the
  organization, an organization-wide membership, and the owner role assignment.
  Half of that is not an account — it is a support ticket — so it is all or
  nothing.

  Optionally creates a first business and its main branch when
  `"business"` attributes are supplied, which is what the signup flow does so
  that a new owner lands on a working till rather than an empty setup wizard.
  """
  @spec register_owner(map()) :: {:ok, map()} | {:error, atom(), Ecto.Changeset.t()}
  def register_owner(attrs) do
    user_attrs = fetch_section(attrs, "user")
    organization_attrs = fetch_section(attrs, "organization")
    business_attrs = fetch_section(attrs, "business")

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:user, User.registration_changeset(%User{}, user_attrs))
    |> Ecto.Multi.insert(:organization, fn %{user: user} ->
      %Organization{owner_id: user.id}
      |> Organization.create_changeset(default_organization_attrs(organization_attrs, user))
    end)
    |> Ecto.Multi.insert(:membership, fn %{user: user, organization: organization} ->
      %Membership{organization_id: organization.id, user_id: user.id}
      |> Membership.create_changeset(%{"job_title" => "Owner", "status" => "active"})
    end)
    |> Ecto.Multi.run(:owner_role, fn _repo, %{membership: membership} ->
      assign_owner_role(membership)
    end)
    |> maybe_create_first_business(business_attrs)
    |> Repo.transaction()
    |> case do
      {:ok, result} -> {:ok, result}
      {:error, step, failed, _changes} -> {:error, step, failed}
    end
  end

  defp default_organization_attrs(attrs, %User{} = user) do
    attrs
    |> Map.put_new("name", "#{user.name}'s business")
    |> Map.put_new("timezone", user.timezone)
    |> Map.put_new("default_locale", user.locale)
  end

  defp assign_owner_role(membership) do
    with {:ok, role} <- AccessControl.fetch_system_role("owner") do
      %MembershipRole{}
      |> MembershipRole.changeset(%{membership_id: membership.id, role_id: role.id})
      |> Repo.insert()
    end
  end

  defp maybe_create_first_business(multi, attrs) when map_size(attrs) == 0, do: multi

  defp maybe_create_first_business(multi, attrs) do
    multi
    |> Ecto.Multi.insert(:business, fn %{organization: organization} ->
      %Business{organization_id: organization.id}
      |> Business.create_changeset(default_business_attrs(attrs, organization))
    end)
    |> Ecto.Multi.insert(:branch, fn %{organization: organization, business: business} ->
      %Branch{
        organization_id: organization.id,
        business_id: business.id
      }
      |> Branch.create_changeset(%{
        "name" => attrs["branch_name"] || "Main branch",
        "code" => "MAIN",
        "is_main" => true
      })
    end)
    |> Ecto.Multi.run(:provision, fn _repo, changes ->
      scope =
        changes.user
        |> Scope.for_user()
        |> Scope.put_organization(changes.organization)
        |> Scope.put_business(changes.business)

      provision(scope, changes.business)
    end)
  end

  # A business that cannot sell anything the moment it exists is a setup wizard,
  # not a business. Both creation paths seed the standard units of measure and a
  # default tax group, so the first product can be added without configuring
  # anything first.
  defp provision(%Scope{} = scope, %Business{} = business) do
    scope = Scope.put_business(scope, business)

    with {:ok, _units} <- Catalog.seed_units(scope),
         {:ok, tax_group} <- Taxes.seed_defaults(scope) do
      {:ok, %{tax_group: tax_group}}
    end
  end

  defp default_business_attrs(attrs, %Organization{} = organization) do
    attrs
    |> Map.drop(["branch_name"])
    |> Map.put_new("currency", organization.default_currency)
    |> Map.put_new("timezone", organization.timezone)
    |> Map.put_new("default_locale", organization.default_locale)
    |> Map.put_new("business_type", Verticals.default_type())
  end

  # ===========================================================================
  # Organizations
  # ===========================================================================

  @doc """
  Lists the organizations a user belongs to.

  Runs before a scope exists — this is what the client calls to decide which
  tenant to work in — so it takes the user directly and filters by membership.
  """
  @spec list_organizations_for_user(User.t()) :: [Organization.t()]
  def list_organizations_for_user(%User{} = user) do
    from(organization in Organization,
      join: membership in Membership,
      on: membership.organization_id == organization.id,
      where: membership.user_id == ^user.id,
      where: is_nil(membership.deleted_at) and membership.status == "active",
      where: is_nil(organization.deleted_at),
      distinct: organization.id,
      order_by: [asc: organization.name]
    )
    |> Repo.all()
  end

  @doc "Fetches an organization the user belongs to."
  @spec fetch_organization_for_user(User.t(), Ecto.UUID.t()) ::
          {:ok, Organization.t()} | {:error, :not_found}
  def fetch_organization_for_user(%User{} = user, id) do
    if UUIDv7.valid?(id) do
      do_fetch_organization_for_user(user, id)
    else
      {:error, :not_found}
    end
  end

  defp do_fetch_organization_for_user(%User{} = user, id) do
    query =
      from organization in Organization,
        join: membership in Membership,
        on: membership.organization_id == organization.id,
        where: organization.id == ^id,
        where: membership.user_id == ^user.id,
        where: is_nil(membership.deleted_at) and membership.status == "active",
        where: is_nil(organization.deleted_at),
        limit: 1

    case Repo.one(query) do
      nil -> {:error, :not_found}
      organization -> {:ok, organization}
    end
  end

  @doc """
  Finds a business the user belongs to, together with its organization.

  Used when building a scope from an `X-Business-Id` header alone: clients
  normally know which shop they are working in and should not have to send the
  organization as well. The membership join is what makes the header safe —
  supplying someone else's business id finds nothing.
  """
  @spec fetch_business_for_user(User.t(), Ecto.UUID.t()) ::
          {:ok, Organization.t(), Business.t()} | {:error, :not_found}
  def fetch_business_for_user(%User{} = user, business_id) do
    if UUIDv7.valid?(business_id) do
      do_fetch_business_for_user(user, business_id)
    else
      {:error, :not_found}
    end
  end

  defp do_fetch_business_for_user(%User{} = user, business_id) do
    query =
      from business in Business,
        join: organization in Organization,
        on: organization.id == business.organization_id,
        join: membership in Membership,
        on: membership.organization_id == organization.id,
        where: business.id == ^business_id,
        where: membership.user_id == ^user.id,
        where: is_nil(membership.deleted_at) and membership.status == "active",
        # Either an organization-wide membership, or one for this business.
        where: is_nil(membership.business_id) or membership.business_id == ^business_id,
        where: is_nil(business.deleted_at) and is_nil(organization.deleted_at),
        limit: 1,
        select: {organization, business}

    case Repo.one(query) do
      nil -> {:error, :not_found}
      {organization, business} -> {:ok, organization, business}
    end
  end

  @doc "Updates the scope's organization."
  @spec update_organization(Scope.t(), map()) ::
          {:ok, Organization.t()} | {:error, Ecto.Changeset.t()}
  def update_organization(%Scope{organization: organization}, attrs) do
    organization |> Organization.update_changeset(attrs) |> Repo.update()
  end

  @doc """
  Transfers ownership to another member of the organization.

  The new owner must already be a member — ownership is not a way to introduce
  a stranger to a tenant — and the previous owner keeps their membership so
  they do not lose access to the shop they built.
  """
  @spec transfer_ownership(Scope.t(), User.t()) ::
          {:ok, Organization.t()} | {:error, :not_found | Ecto.Changeset.t()}
  def transfer_ownership(%Scope{organization: organization}, %User{} = new_owner) do
    if member?(organization, new_owner) do
      organization |> Organization.owner_changeset(new_owner) |> Repo.update()
    else
      {:error, :not_found}
    end
  end

  defp member?(%Organization{} = organization, %User{} = user) do
    Repo.exists?(
      from membership in Membership,
        where: membership.organization_id == ^organization.id,
        where: membership.user_id == ^user.id,
        where: is_nil(membership.deleted_at)
    )
  end

  # ===========================================================================
  # Businesses
  # ===========================================================================

  @doc """
  Lists the businesses visible to the scope.

  An organization-wide member sees all of them. A member attached to one
  business sees only that one, which is what keeps the clothes shop's cashier
  out of the restaurant next door.
  """
  @spec list_businesses(Scope.t()) :: [Business.t()]
  def list_businesses(%Scope{} = scope) do
    Business
    |> Scoped.for_organization(scope)
    |> Scoped.active()
    |> restrict_to_membership_business(scope)
    |> order_by([business], asc: business.name)
    |> Repo.all()
  end

  defp restrict_to_membership_business(query, %Scope{owner?: true}), do: query
  defp restrict_to_membership_business(query, %Scope{membership: nil}), do: query

  defp restrict_to_membership_business(query, %Scope{membership: %{business_id: nil}}), do: query

  defp restrict_to_membership_business(query, %Scope{membership: %{business_id: business_id}}) do
    where(query, [business], business.id == ^business_id)
  end

  @doc "Fetches a business visible to the scope."
  @spec fetch_business(Scope.t(), Ecto.UUID.t()) :: {:ok, Business.t()} | {:error, :not_found}
  def fetch_business(%Scope{} = scope, id) do
    if UUIDv7.valid?(id), do: do_fetch_business(scope, id), else: {:error, :not_found}
  end

  defp do_fetch_business(%Scope{} = scope, id) do
    Business
    |> Scoped.for_organization(scope)
    |> Scoped.active()
    |> restrict_to_membership_business(scope)
    |> where([business], business.id == ^id)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      business -> {:ok, business}
    end
  end

  @doc """
  Creates a business, together with its main branch.

  A business without a branch cannot hold stock or take a sale, so creating one
  without the other only produces a half-built tenant that the next request
  trips over.
  """
  @spec create_business(Scope.t(), map()) :: {:ok, map()} | {:error, atom(), Ecto.Changeset.t()}
  def create_business(%Scope{} = scope, attrs) do
    organization_id = Scope.organization_id(scope)
    attrs = stringify(attrs)

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:business, fn _changes ->
      %Business{organization_id: organization_id}
      |> Business.create_changeset(default_business_attrs(attrs, scope.organization))
    end)
    |> Ecto.Multi.insert(:branch, fn %{business: business} ->
      %Branch{organization_id: organization_id, business_id: business.id}
      |> Branch.create_changeset(%{
        "name" => attrs["branch_name"] || "Main branch",
        "code" => attrs["branch_code"] || "MAIN",
        "is_main" => true
      })
    end)
    |> Ecto.Multi.run(:provision, fn _repo, %{business: business} ->
      provision(scope, business)
    end)
    |> Repo.transaction()
    |> case do
      {:ok, result} -> {:ok, result}
      {:error, step, failed, _changes} -> {:error, step, failed}
    end
  end

  @doc "Updates a business."
  @spec update_business(Scope.t(), Business.t(), map()) ::
          {:ok, Business.t()} | {:error, Ecto.Changeset.t()}
  def update_business(%Scope{}, %Business{} = business, attrs) do
    business |> Business.update_changeset(attrs) |> Repo.update()
  end

  @doc "Archives a business. Its data is retained for reporting and audit."
  @spec archive_business(Scope.t(), Business.t()) ::
          {:ok, Business.t()} | {:error, Ecto.Changeset.t()}
  def archive_business(%Scope{}, %Business{} = business) do
    business |> Business.soft_delete_changeset() |> Repo.update()
  end

  @doc "The modules and product kinds this business's vertical allows."
  @spec business_capabilities(Business.t()) :: map()
  def business_capabilities(%Business{} = business) do
    %{
      business_type: business.business_type,
      label: Verticals.label(business.business_type),
      modules: Verticals.active_modules(business),
      available_modules: Verticals.modules_for(business.business_type),
      product_kinds: Verticals.product_kinds_for(business.business_type),
      required_sale_fields: Verticals.required_sale_fields(business.business_type),
      requires_batch: Verticals.requires_batch?(business.business_type)
    }
  end

  # ===========================================================================
  # Branches
  # ===========================================================================

  @doc """
  Lists the branches visible to the scope.

  Narrowed to the membership's branches, so a supervisor given three of five
  shops sees three.
  """
  @spec list_branches(Scope.t()) :: [Branch.t()]
  def list_branches(%Scope{} = scope) do
    Branch
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> restrict_to_membership_branches(scope)
    |> order_by([branch], desc: branch.is_main, asc: branch.name)
    |> Repo.all()
  end

  defp restrict_to_membership_branches(query, %Scope{owner?: true}), do: query
  defp restrict_to_membership_branches(query, %Scope{branch_ids: :all}), do: query

  defp restrict_to_membership_branches(query, %Scope{branch_ids: branch_ids}) do
    ids = MapSet.to_list(branch_ids)
    where(query, [branch], branch.id in ^ids)
  end

  @doc "Fetches a branch visible to the scope."
  @spec fetch_branch(Scope.t(), Ecto.UUID.t()) :: {:ok, Branch.t()} | {:error, :not_found}
  def fetch_branch(%Scope{} = scope, id) do
    if UUIDv7.valid?(id), do: do_fetch_branch(scope, id), else: {:error, :not_found}
  end

  defp do_fetch_branch(%Scope{} = scope, id) do
    Branch
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> restrict_to_membership_branches(scope)
    |> where([branch], branch.id == ^id)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      branch -> {:ok, branch}
    end
  end

  @doc "Creates a branch in the scope's business."
  @spec create_branch(Scope.t(), map()) :: {:ok, Branch.t()} | {:error, Ecto.Changeset.t()}
  def create_branch(%Scope{} = scope, attrs) do
    %Branch{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> Branch.create_changeset(Map.delete(stringify(attrs), "is_main"))
    |> Repo.insert()
  end

  @doc "Updates a branch."
  @spec update_branch(Scope.t(), Branch.t(), map()) ::
          {:ok, Branch.t()} | {:error, Ecto.Changeset.t()}
  def update_branch(%Scope{}, %Branch{} = branch, attrs) do
    branch |> Branch.update_changeset(attrs) |> Repo.update()
  end

  @doc """
  Promotes a branch to main, demoting the current one.

  Both halves run in one transaction because the database permits only one main
  branch per business; doing it in two steps would fail on the unique index.
  """
  @spec set_main_branch(Scope.t(), Branch.t()) :: {:ok, Branch.t()} | {:error, term()}
  def set_main_branch(%Scope{} = scope, %Branch{} = branch) do
    business_id = Scope.business_id(scope)

    Repo.transaction(fn ->
      from(other in Branch,
        where: other.business_id == ^business_id,
        where: other.id != ^branch.id,
        where: other.is_main
      )
      |> Repo.update_all(set: [is_main: false])

      case branch |> Branch.main_changeset(true) |> Repo.update() do
        {:ok, promoted} -> promoted
        {:error, failed} -> Repo.rollback(failed)
      end
    end)
  end

  @doc """
  Archives a branch.

  The main branch cannot be archived — a business with no main branch has
  nowhere to default a sale to, and every till in it stops working.
  """
  @spec archive_branch(Scope.t(), Branch.t()) ::
          {:ok, Branch.t()} | {:error, :conflict | Ecto.Changeset.t()}
  def archive_branch(%Scope{}, %Branch{is_main: true}), do: {:error, :conflict}

  def archive_branch(%Scope{}, %Branch{} = branch) do
    branch |> Branch.soft_delete_changeset() |> Repo.update()
  end

  # ===========================================================================
  # Helpers
  # ===========================================================================

  @doc false
  def fetch_section(attrs, key) do
    attrs
    |> stringify()
    |> Map.get(key, %{})
    |> stringify()
  end

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
  end

  defp stringify(_attrs), do: %{}
end
