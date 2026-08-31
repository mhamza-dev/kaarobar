defmodule Kaarobar.Billing.Entitlements do
  @moduledoc """
  What an organization's subscription lets it do.

  Resolved once per request and put on the `%Kaarobar.Scope{}`, where
  `Kaarobar.Scope.entitled?/2` reads it. Two queries — the subscription and its
  plan's features — deliberately not cached: a plan change that took effect
  five minutes later would be reported as a bug by the first customer who
  upgraded to fix an outage.

  ## No subscription means no restriction

  An organization with no subscription row gets an **empty** feature set, and
  `Scope.entitled?/2` reads empty as "not resolved, allow everything". That is
  what keeps billing optional: a self-hosted deployment, a seeded test, an
  internal org — none of them should have to fabricate a subscription to use
  the software.

  A lapsed subscription is a different thing entirely and returns a small,
  explicitly non-empty set, because there the answer really is "almost
  nothing".

  ## What a locked-out organization can still do

  Read its own data and pay its bill. Not selling, not stock, not staff — but
  never nothing, because an organization that cannot reach its own billing
  screen cannot give us money, and an organization that cannot export its own
  records has been locked out of its property rather than its subscription.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Billing.Plan
  alias Kaarobar.Billing.PlanFeature
  alias Kaarobar.Billing.Subscription
  alias Kaarobar.Repo

  # Everything a shop whose subscription has lapsed may still reach.
  @lapsed_features ~w(settings reports billing export)

  @typedoc "A resolved entitlement set."
  @type t :: %{
          features: MapSet.t(String.t()),
          limits: %{String.t() => non_neg_integer() | :unlimited},
          status: String.t() | nil,
          serviceable: boolean()
        }

  @doc """
  Resolves what an organization may do.

  Returns an empty feature set when the organization has no subscription — see
  the module doc; that is what makes billing optional rather than a silent
  outage for anybody who has not set a plan up.
  """
  @spec for_organization(Ecto.UUID.t() | nil) :: t()
  def for_organization(nil), do: unrestricted()

  def for_organization(organization_id) do
    case current_subscription(organization_id) do
      nil -> unrestricted()
      subscription -> resolve(subscription)
    end
  end

  @doc "The organization's live subscription, with its plan, or nil."
  @spec current_subscription(Ecto.UUID.t()) :: Subscription.t() | nil
  def current_subscription(organization_id) do
    Subscription
    |> where([s], s.organization_id == ^organization_id)
    |> where([s], s.status not in ~w(canceled expired))
    |> preload(:plan)
    |> Repo.one()
  end

  @doc """
  The feature keys a plan grants.

  Only the enabled ones. A feature row with `is_enabled` false is a deliberate
  exclusion — how a plan says "everything in Standard except delivery" without
  listing everything in Standard.
  """
  @spec plan_features(Plan.t() | Ecto.UUID.t()) :: MapSet.t(String.t())
  def plan_features(%Plan{id: id}), do: plan_features(id)

  def plan_features(plan_id) do
    PlanFeature
    |> where([f], f.plan_id == ^plan_id and f.is_enabled)
    |> select([f], f.key)
    |> Repo.all()
    |> MapSet.new()
  end

  @doc """
  The limits a plan imposes, keyed by feature.

  A feature with no `limit_value` is `:unlimited` rather than absent, so a
  caller comparing a count against a limit always has something to compare
  against.
  """
  @spec plan_limits(Plan.t() | Ecto.UUID.t()) :: %{String.t() => non_neg_integer() | :unlimited}
  def plan_limits(%Plan{id: id}), do: plan_limits(id)

  def plan_limits(plan_id) do
    PlanFeature
    |> where([f], f.plan_id == ^plan_id and f.is_enabled)
    |> Repo.all()
    |> Map.new(fn feature -> {feature.key, PlanFeature.limit(feature)} end)
  end

  @doc """
  Whether one more of something is within the plan's limit.

  Takes the count as an argument rather than counting itself: the caller is
  already holding the row lock or the transaction in which the count is true,
  and a second count taken here could disagree with it.
  """
  @spec within_limit?(t(), String.t(), non_neg_integer()) :: boolean()
  def within_limit?(%{limits: limits}, key, current_count) do
    case Map.get(limits, key, :unlimited) do
      :unlimited -> true
      limit -> current_count < limit
    end
  end

  @doc "The limit on something, or `:unlimited`."
  @spec limit(t(), String.t()) :: non_neg_integer() | :unlimited
  def limit(%{limits: limits}, key), do: Map.get(limits, key, :unlimited)

  # ---------------------------------------------------------------- internals

  defp resolve(%Subscription{} = subscription) do
    if Subscription.serviceable?(subscription) do
      %{
        features: plan_features(subscription.plan_id),
        limits: plan_limits(subscription.plan_id),
        status: subscription.status,
        serviceable: true
      }
    else
      lapsed(subscription)
    end
  end

  defp lapsed(%Subscription{} = subscription) do
    %{
      features: MapSet.new(@lapsed_features),
      limits: %{},
      status: subscription.status,
      serviceable: false
    }
  end

  # Empty on purpose. `Scope.entitled?/2` reads an empty set as "not resolved"
  # and allows everything, which is what keeps billing opt-in.
  defp unrestricted do
    %{features: MapSet.new(), limits: %{}, status: nil, serviceable: true}
  end
end
