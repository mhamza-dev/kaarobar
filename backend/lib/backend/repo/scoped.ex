defmodule Kaarobar.Repo.Scoped do
  @moduledoc """
  Query helpers that make tenant scoping impossible to forget.

  Every query against a tenant-owned table goes through one of these. If the
  scope does not carry the tenant the query needs, they **raise** rather than
  returning an unfiltered query — a missing scope is a programming error caught
  in development and in tests, never a cross-tenant data leak in production.

      Product
      |> Scoped.for_business(scope)
      |> where([p], p.is_active)
      |> Repo.all()

  This is the first of two isolation layers. The second is Postgres row-level
  security (added in the hardening phase), which turns any query that somehow
  escapes this module into an empty result rather than another tenant's rows.
  """

  import Ecto.Query

  alias Kaarobar.Scope

  @doc """
  Restricts a queryable to the scope's organization via `organization_id`.
  """
  @spec for_organization(Ecto.Queryable.t(), Scope.t()) :: Ecto.Query.t()
  def for_organization(_queryable, %Scope{organization: nil}) do
    raise ArgumentError, """
    a scope without an organization was used to query a tenant table.

    Route the request through KaarobarWeb.Plugs.LoadScope, or build the scope
    with Kaarobar.Scope.put_organization/2 before querying.
    """
  end

  def for_organization(queryable, %Scope{} = scope) do
    organization_id = Scope.organization_id(scope)
    where(queryable, [record], record.organization_id == ^organization_id)
  end

  @doc """
  Restricts a queryable to the scope's business via `business_id`.
  """
  @spec for_business(Ecto.Queryable.t(), Scope.t()) :: Ecto.Query.t()
  def for_business(_queryable, %Scope{business: nil}) do
    raise ArgumentError, """
    a scope without a business was used to query a business-owned table.

    Business-scoped endpoints must receive the business through the
    `X-Business-Id` header or a `/businesses/:business_id/...` path segment.
    """
  end

  def for_business(queryable, %Scope{} = scope) do
    business_id = Scope.business_id(scope)
    where(queryable, [record], record.business_id == ^business_id)
  end

  @doc """
  Restricts a queryable to the single branch the request selected.
  """
  @spec for_branch(Ecto.Queryable.t(), Scope.t()) :: Ecto.Query.t()
  def for_branch(_queryable, %Scope{branch: nil}) do
    raise ArgumentError, """
    a scope without a branch was used to query a branch-owned table.

    Branch-scoped endpoints must receive the branch through the `X-Branch-Id`
    header or a `/branches/:branch_id/...` path segment.
    """
  end

  def for_branch(queryable, %Scope{} = scope) do
    branch_id = Scope.branch_id(scope)
    where(queryable, [record], record.branch_id == ^branch_id)
  end

  @doc """
  Restricts a queryable to every branch this membership may act on.

  Use for cross-branch reads — a manager reviewing the three branches they
  supervise. A membership with no branch restriction is left unfiltered by
  branch, having already been narrowed to its business by the caller.
  """
  @spec within_branches(Ecto.Queryable.t(), Scope.t()) :: Ecto.Query.t()
  def within_branches(queryable, %Scope{owner?: true}), do: queryable
  def within_branches(queryable, %Scope{branch_ids: :all}), do: queryable

  def within_branches(queryable, %Scope{branch_ids: branch_ids}) do
    ids = MapSet.to_list(branch_ids)
    where(queryable, [record], record.branch_id in ^ids)
  end

  @doc """
  Excludes soft-deleted rows.
  """
  @spec active(Ecto.Queryable.t()) :: Ecto.Query.t()
  def active(queryable), do: where(queryable, [record], is_nil(record.deleted_at))
end
