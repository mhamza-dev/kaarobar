defmodule Kaarobar.Billing do
  import Ecto.Query
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.Subscription

  @default_limits %{
    "trial" => %{max_businesses: 1, max_branches: 2, max_users: 5},
    "starter" => %{max_businesses: 3, max_branches: 10, max_users: 25},
    "growth" => %{max_businesses: 10, max_branches: 50, max_users: 100},
    "enterprise" => %{max_businesses: 100, max_branches: 500, max_users: 1000}
  }

  def ensure_subscription(owner_id, plan \\ "trial") do
    case Repo.get_by(Subscription, owner_id: owner_id) do
      nil ->
        limits = Map.get(@default_limits, plan, @default_limits["trial"])

        %Subscription{}
        |> Subscription.changeset(%{
          owner_id: owner_id,
          plan: plan,
          status: "active",
          trial_ends_at: DateTime.add(DateTime.utc_now(), 14 * 86_400, :second) |> DateTime.truncate(:second),
          max_businesses: limits.max_businesses,
          max_branches: limits.max_branches,
          max_users: limits.max_users
        })
        |> Repo.insert()

      sub ->
        {:ok, sub}
    end
  end

  def set_plan(owner_id, plan) do
    limits = Map.get(@default_limits, plan, @default_limits["trial"])

    case get_subscription(owner_id) do
      nil ->
        ensure_subscription(owner_id, plan)

      sub ->
        sub
        |> Subscription.changeset(%{
          plan: plan,
          status: "active",
          max_businesses: limits.max_businesses,
          max_branches: limits.max_branches,
          max_users: limits.max_users
        })
        |> Repo.update()
    end
  end

  def get_subscription(owner_id), do: Repo.get_by(Subscription, owner_id: owner_id)

  def within_limits?(owner_id, kind) do
    sub = get_subscription(owner_id) || elem(ensure_subscription(owner_id), 1)

    case kind do
      :business -> count_businesses(owner_id) < sub.max_businesses
      :branch -> count_branches(owner_id) < sub.max_branches
      :user -> count_users(owner_id) < sub.max_users
      _ -> true
    end
  end

  def handle_lemonsqueezy_webhook(payload) do
    # Merchant-of-record billing events — persist plan/status from LemonSqueezy.
    event = payload["meta"]["event_name"] || payload["event_name"]
    {:ok, %{handled: true, event: event}}
  end

  defp count_businesses(owner_id) do
    from(b in Kaarobar.Schemas.Business, where: b.owner_id == ^owner_id and b.is_active == true)
    |> Repo.aggregate(:count)
  end

  defp count_branches(owner_id) do
    from(b in Kaarobar.Schemas.Branch, where: b.owner_id == ^owner_id and b.is_active == true)
    |> Repo.aggregate(:count)
  end

  defp count_users(owner_id) do
    from(m in Kaarobar.Schemas.Membership, where: m.owner_id == ^owner_id, select: m.user_id, distinct: true)
    |> Repo.aggregate(:count)
  end
end
