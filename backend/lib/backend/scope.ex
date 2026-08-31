defmodule Kaarobar.Scope do
  @moduledoc """
  The authenticated caller and everything they are allowed to touch.

  A `%Scope{}` is built once per request by `KaarobarWeb.Plugs.LoadScope` and
  is then passed as the **first argument** to every context function. That
  convention is what makes multi-tenancy enforceable rather than aspirational:
  a query that needs a tenant cannot be written without a scope in hand, and
  `Kaarobar.Repo.Scoped` refuses to build one otherwise.

  It carries four things:

    * **identity** — the `user`, and the `membership` binding them to a tenant
    * **tenancy** — the `organization`, and optionally the `business` and
      `branch` the request is acting within
    * **authority** — the resolved permission set, the role keys behind it, and
      the branches this membership may act on
    * **entitlement** — the features the organization's subscription unlocks

  Permissions are resolved once, eagerly, into a `MapSet`. Nothing downstream
  re-queries the RBAC tables, so a permission check is a set lookup.

  ## Owner bypass

  The organization owner implicitly holds every permission — they cannot lock
  themselves out of their own account. Entitlements are *not* bypassed: a plan
  that excludes a module excludes it for the owner too, because that is a
  billing boundary rather than a security one.
  """

  alias Kaarobar.Scope

  @type id :: Ecto.UUID.t()

  @type t :: %__MODULE__{
          user: struct() | nil,
          organization: struct() | nil,
          business: struct() | nil,
          branch: struct() | nil,
          membership: struct() | nil,
          role_keys: [String.t()],
          permissions: MapSet.t(String.t()),
          entitlements: MapSet.t(String.t()),
          entitlement_limits: %{String.t() => non_neg_integer() | :unlimited},
          subscription_status: String.t() | nil,
          serviceable?: boolean(),
          branch_ids: :all | MapSet.t(id()),
          owner?: boolean(),
          request_id: String.t() | nil,
          remote_ip: String.t() | nil
        }

  defstruct user: nil,
            organization: nil,
            business: nil,
            branch: nil,
            membership: nil,
            role_keys: [],
            permissions: MapSet.new(),
            entitlements: MapSet.new(),
            entitlement_limits: %{},
            subscription_status: nil,
            # True unless the organization's subscription has actually lapsed.
            # Defaults to true so that every internal caller and every test
            # works without a subscription — see `Kaarobar.Billing.Entitlements`.
            serviceable?: true,
            branch_ids: :all,
            owner?: false,
            request_id: nil,
            remote_ip: nil

  @doc """
  Builds a scope for an authenticated user with no tenant selected yet.

  This is the scope for endpoints that exist above a tenant: `/me`, listing the
  organizations a user belongs to, accepting an invitation.
  """
  @spec for_user(struct()) :: t()
  def for_user(user), do: %Scope{user: user}

  @doc """
  Attaches the organization the request is acting within.

  Sets `owner?` when the user owns the organization.
  """
  @spec put_organization(t(), struct()) :: t()
  def put_organization(%Scope{} = scope, organization) do
    %{
      scope
      | organization: organization,
        owner?: owns?(scope.user, organization)
    }
  end

  @doc "Attaches the business the request is acting within."
  @spec put_business(t(), struct()) :: t()
  def put_business(%Scope{} = scope, business), do: %{scope | business: business}

  @doc "Attaches the branch the request is acting within."
  @spec put_branch(t(), struct()) :: t()
  def put_branch(%Scope{} = scope, branch), do: %{scope | branch: branch}

  @doc """
  Attaches the resolved authority for this request.

  `permissions` and `branch_ids` are accepted as enumerables and normalised
  into `MapSet`s; `branch_ids` may be `:all` for a membership that is not
  restricted to particular branches.
  """
  @spec put_access(t(), keyword()) :: t()
  def put_access(%Scope{} = scope, opts) do
    %{
      scope
      | membership: Keyword.get(opts, :membership, scope.membership),
        role_keys: Keyword.get(opts, :role_keys, scope.role_keys),
        permissions: to_set(Keyword.get(opts, :permissions, scope.permissions)),
        branch_ids: normalize_branch_ids(Keyword.get(opts, :branch_ids, scope.branch_ids))
    }
  end

  @doc """
  Attaches what the organization's subscription unlocks.

  Takes either a resolved `Kaarobar.Billing.Entitlements` map — features,
  limits, status and whether the subscription is still serviceable — or a bare
  enumerable of feature keys, which is what tests and internal callers have.
  """
  @spec put_entitlements(t(), map() | Enumerable.t()) :: t()
  def put_entitlements(%Scope{} = scope, %{features: features} = resolved) do
    %{
      scope
      | entitlements: to_set(features),
        entitlement_limits: Map.get(resolved, :limits, %{}),
        subscription_status: Map.get(resolved, :status),
        serviceable?: Map.get(resolved, :serviceable, true)
    }
  end

  def put_entitlements(%Scope{} = scope, features) do
    %{scope | entitlements: to_set(features)}
  end

  @doc """
  The plan's limit on something, or `:unlimited`.

  An unknown key is unlimited rather than zero. A limit nobody has set is not a
  limit of none, and reading it that way would stop a paying customer from
  opening their second branch.
  """
  @spec limit(t(), String.t()) :: non_neg_integer() | :unlimited
  def limit(%Scope{entitlement_limits: limits}, key), do: Map.get(limits, key, :unlimited)

  @doc "True when one more of something would still be inside the plan's limit."
  @spec within_limit?(t(), String.t(), non_neg_integer()) :: boolean()
  def within_limit?(%Scope{} = scope, key, current_count) do
    case limit(scope, key) do
      :unlimited -> true
      limit -> current_count < limit
    end
  end

  @doc """
  True unless the organization's subscription has lapsed.

  Distinct from `entitled?/2`: that asks whether the plan includes something,
  this asks whether the plan is being paid for at all.
  """
  @spec serviceable?(t() | nil) :: boolean()
  def serviceable?(nil), do: false
  def serviceable?(%Scope{serviceable?: serviceable}), do: serviceable

  @doc "Attaches per-request diagnostics used by the audit trail."
  @spec put_request_metadata(t(), String.t() | nil, String.t() | nil) :: t()
  def put_request_metadata(%Scope{} = scope, request_id, remote_ip) do
    %{scope | request_id: request_id, remote_ip: remote_ip}
  end

  # --- Identity ---------------------------------------------------------------

  @spec user_id(t()) :: id() | nil
  def user_id(%Scope{user: nil}), do: nil
  def user_id(%Scope{user: user}), do: user.id

  @spec organization_id(t()) :: id() | nil
  def organization_id(%Scope{organization: nil}), do: nil
  def organization_id(%Scope{organization: organization}), do: organization.id

  @spec business_id(t()) :: id() | nil
  def business_id(%Scope{business: nil}), do: nil
  def business_id(%Scope{business: business}), do: business.id

  @spec branch_id(t()) :: id() | nil
  def branch_id(%Scope{branch: nil}), do: nil
  def branch_id(%Scope{branch: branch}), do: branch.id

  @doc "True when a user is attached — i.e. the request is authenticated."
  @spec authenticated?(t() | nil) :: boolean()
  def authenticated?(%Scope{user: nil}), do: false
  def authenticated?(%Scope{}), do: true
  def authenticated?(nil), do: false

  # --- Authority --------------------------------------------------------------

  @doc """
  Checks a single permission key, e.g. `"sales:checkout"`.

  Returns `true` unconditionally for the organization owner.
  """
  @spec can?(t() | nil, String.t()) :: boolean()
  def can?(nil, _permission), do: false
  def can?(%Scope{user: nil}, _permission), do: false
  def can?(%Scope{owner?: true}, _permission), do: true

  def can?(%Scope{permissions: permissions}, permission) do
    MapSet.member?(permissions, permission)
  end

  @doc """
  Permission check in `:ok` / `{:error, :forbidden}` form, for `with` chains.
  """
  @spec authorize(t() | nil, String.t()) :: :ok | {:error, :forbidden}
  def authorize(scope, permission) do
    if can?(scope, permission), do: :ok, else: {:error, :forbidden}
  end

  @doc """
  True when the membership may act on the given branch.

  A membership with no explicit branch restriction (`:all`) covers every branch
  of its business — that is how owners, admins and single-branch shops work.
  """
  @spec covers_branch?(t(), id() | nil) :: boolean()
  def covers_branch?(%Scope{}, nil), do: false
  def covers_branch?(%Scope{owner?: true}, _branch_id), do: true
  def covers_branch?(%Scope{branch_ids: :all}, _branch_id), do: true
  def covers_branch?(%Scope{branch_ids: ids}, branch_id), do: MapSet.member?(ids, branch_id)

  # --- Entitlement ------------------------------------------------------------

  @doc """
  True when the organization's subscription unlocks the given feature.

  An empty entitlement set means "not yet resolved" and allows everything, so
  that internal callers and tests are not forced to fabricate a subscription.
  Request-path scopes always have this populated.
  """
  @spec entitled?(t(), String.t()) :: boolean()
  def entitled?(%Scope{entitlements: entitlements}, feature) do
    Enum.empty?(entitlements) or MapSet.member?(entitlements, feature)
  end

  @spec require_entitlement(t(), String.t()) :: :ok | {:error, :payment_required}
  def require_entitlement(scope, feature) do
    if entitled?(scope, feature), do: :ok, else: {:error, :payment_required}
  end

  # --- Logging ----------------------------------------------------------------

  @doc """
  Logger metadata for this scope, so every log line can be traced to a tenant.
  """
  @spec logger_metadata(t()) :: keyword()
  def logger_metadata(%Scope{} = scope) do
    [
      user_id: user_id(scope),
      organization_id: organization_id(scope),
      business_id: business_id(scope)
    ]
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
  end

  # --- Internal ---------------------------------------------------------------

  defp owns?(nil, _organization), do: false
  defp owns?(_user, nil), do: false
  defp owns?(user, organization), do: user.id == organization.owner_id

  defp to_set(%MapSet{} = set), do: set
  defp to_set(nil), do: MapSet.new()
  defp to_set(enumerable), do: MapSet.new(enumerable)

  defp normalize_branch_ids(:all), do: :all
  defp normalize_branch_ids(ids), do: to_set(ids)
end
