defmodule Kaarobar.Scopes do
  @moduledoc """
  Builds a `%Kaarobar.Scope{}` from an authenticated user and the tenant they
  say they are working in.

  Runs once per request, in `KaarobarWeb.Plugs.LoadScope`. Everything
  downstream — every context call, every permission check, every query — reads
  the result and never re-derives it.

  ## What "the tenant they say they are working in" means

  The client asserts a business (and optionally a branch) through headers. That
  assertion is never trusted: each lookup joins through the user's memberships,
  so naming someone else's business finds nothing and produces a scope with no
  tenant rather than a scope with someone else's.

  Selection order:

  1. `X-Business-Id`, if given. Its organization is derived from it — a client
     that knows which shop it is in should not also have to send which company
     owns it.
  2. `X-Organization-Id`, if given and no business was.
  3. The user's only organization, when they have exactly one. Most owners do,
     and requiring a header for a single-tenant account is friction with no
     security value.
  4. Nothing. `/me` and the organization list work without a tenant.
  """

  alias Kaarobar.AccessControl
  alias Kaarobar.Accounts.User
  alias Kaarobar.Scope
  alias Kaarobar.Staffing
  alias Kaarobar.Tenancy
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Membership
  alias Kaarobar.Tenancy.Organization

  @type selection :: %{
          optional(:organization_id) => String.t() | nil,
          optional(:business_id) => String.t() | nil,
          optional(:branch_id) => String.t() | nil
        }

  @doc """
  Builds the scope for a request.

  Returns `{:ok, scope}`, or `{:error, :not_found}` when the client named a
  tenant it has no membership in — deliberately indistinguishable from naming
  one that does not exist.
  """
  @spec build(User.t(), selection()) :: {:ok, Scope.t()} | {:error, :not_found}
  def build(%User{} = user, selection \\ %{}) do
    with {:ok, organization, business} <- resolve_tenant(user, selection) do
      scope =
        user
        |> Scope.for_user()
        |> put_organization(organization)
        |> put_access(user, organization, business)
        |> put_business(business)

      attach_branch(scope, selection[:branch_id])
    end
  end

  @doc "A scope for a user with no tenant selected."
  @spec for_user(User.t()) :: Scope.t()
  def for_user(%User{} = user), do: Scope.for_user(user)

  # --- Tenant resolution ------------------------------------------------------

  defp resolve_tenant(%User{} = user, %{business_id: business_id})
       when is_binary(business_id) and business_id != "" do
    case Tenancy.fetch_business_for_user(user, business_id) do
      {:ok, organization, business} -> {:ok, organization, business}
      {:error, :not_found} -> {:error, :not_found}
    end
  end

  defp resolve_tenant(%User{} = user, %{organization_id: organization_id})
       when is_binary(organization_id) and organization_id != "" do
    case Tenancy.fetch_organization_for_user(user, organization_id) do
      {:ok, organization} -> {:ok, organization, nil}
      {:error, :not_found} -> {:error, :not_found}
    end
  end

  defp resolve_tenant(%User{} = user, _selection) do
    case Tenancy.list_organizations_for_user(user) do
      [organization] -> {:ok, organization, nil}
      _many_or_none -> {:ok, nil, nil}
    end
  end

  # --- Assembly ---------------------------------------------------------------

  defp put_organization(scope, nil), do: scope
  defp put_organization(scope, %Organization{} = organization),
    do: Scope.put_organization(scope, organization)

  defp put_business(scope, nil), do: scope
  defp put_business(scope, %Business{} = business), do: Scope.put_business(scope, business)

  defp put_access(scope, _user, nil, _business), do: scope

  defp put_access(scope, %User{} = user, %Organization{} = organization, business) do
    case fetch_membership(user, organization, business) do
      {:ok, membership} ->
        {permissions, role_keys} = AccessControl.resolve(membership)

        Scope.put_access(scope,
          membership: membership,
          role_keys: role_keys,
          permissions: permissions,
          branch_ids: Membership.branch_scope(membership)
        )

      {:error, :not_found} ->
        scope
    end
  end

  defp fetch_membership(user, organization, nil) do
    Staffing.fetch_membership_for(user, organization.id)
  end

  defp fetch_membership(user, organization, %Business{} = business) do
    Staffing.fetch_membership_for_business(user, organization.id, business.id)
  end

  # --- Branch -----------------------------------------------------------------

  defp attach_branch(scope, branch_id) when is_binary(branch_id) and branch_id != "" do
    with %Scope{business: %Business{}} <- scope,
         {:ok, branch} <- Tenancy.fetch_branch(scope, branch_id) do
      if Scope.covers_branch?(scope, branch.id) do
        {:ok, Scope.put_branch(scope, branch)}
      else
        {:error, :not_found}
      end
    else
      # A branch cannot be selected without a business, and a branch the caller
      # has no access to is reported the same way as one that does not exist.
      %Scope{} -> {:error, :not_found}
      {:error, :not_found} -> {:error, :not_found}
    end
  end

  defp attach_branch(scope, _branch_id), do: {:ok, default_branch(scope)}

  # With one branch — which is most shops — selecting it explicitly is
  # ceremony. With several, the client must say which, because "wrong branch"
  # is a stock error nobody notices until a count.
  defp default_branch(%Scope{business: %Business{}} = scope) do
    case Tenancy.list_branches(scope) do
      [branch] -> Scope.put_branch(scope, branch)
      _many_or_none -> scope
    end
  end

  defp default_branch(scope), do: scope
end
