defmodule Kaarobar.Billing do
  @moduledoc """
  Subscription plans and LemonSqueezy webhook handling (ADM-FR-002/003).
  """

  import Ecto.Query
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{Subscription, User}

  @default_limits %{
    "trial" => %{max_businesses: 1, max_branches: 2, max_users: 5},
    "starter" => %{max_businesses: 3, max_branches: 10, max_users: 25},
    "growth" => %{max_businesses: 10, max_branches: 50, max_users: 100},
    "enterprise" => %{max_businesses: 100, max_branches: 500, max_users: 1000}
  }

  def plans, do: Map.keys(@default_limits)

  def ensure_subscription(owner_id, plan \\ "trial") do
    case Repo.get_by(Subscription, owner_id: owner_id) do
      nil ->
        limits = Map.get(@default_limits, plan, @default_limits["trial"])

        %Subscription{}
        |> Subscription.changeset(%{
          owner_id: owner_id,
          plan: plan,
          status: "active",
          trial_ends_at:
            DateTime.add(DateTime.utc_now(), 14 * 86_400, :second) |> DateTime.truncate(:second),
          max_businesses: limits.max_businesses,
          max_branches: limits.max_branches,
          max_users: limits.max_users
        })
        |> Repo.insert()

      sub ->
        {:ok, sub}
    end
  end

  def set_plan(owner_id, plan, extra \\ %{}) do
    limits = Map.get(@default_limits, plan, @default_limits["trial"])

    attrs = %{
      plan: plan,
      status: extra[:status] || extra["status"] || "active",
      max_businesses: limits.max_businesses,
      max_branches: limits.max_branches,
      max_users: limits.max_users,
      lemon_squeezy_id: extra[:lemon_squeezy_id] || extra["lemon_squeezy_id"],
      current_period_end: extra[:current_period_end] || extra["current_period_end"],
      trial_ends_at: extra[:trial_ends_at] || extra["trial_ends_at"]
    }

    attrs = Enum.reject(attrs, fn {_k, v} -> is_nil(v) end) |> Map.new()

    case get_subscription(owner_id) do
      nil ->
        with {:ok, sub} <- ensure_subscription(owner_id, plan) do
          sub |> Subscription.changeset(attrs) |> Repo.update()
        end

      sub ->
        sub |> Subscription.changeset(attrs) |> Repo.update()
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

  @doc """
  Notify the owner that a plan limit blocked an action (business/branch/user).
  """
  def notify_plan_limit(owner_id, kind) when is_binary(owner_id) do
    label =
      case kind do
        :business -> "businesses"
        :branch -> "branches"
        :user -> "users"
        _ -> "resources"
      end

    Kaarobar.Notifications.notify(
      owner_id,
      owner_id,
      "billing.limit",
      %{kind: to_string(kind)},
      title: "Plan limit reached",
      body: "You've reached your plan limit for #{label}. Upgrade to add more."
    )
  end

  def usage_summary(owner_id) do
    {:ok, sub} = ensure_subscription(owner_id)

    %{
      subscription: serialize_sub(sub),
      usage: %{
        businesses: count_businesses(owner_id),
        branches: count_branches(owner_id),
        users: count_users(owner_id)
      },
      limits: %{
        max_businesses: sub.max_businesses,
        max_branches: sub.max_branches,
        max_users: sub.max_users
      },
      checkout_url: System.get_env("LEMONSQUEEZY_CHECKOUT_URL")
    }
  end

  def serialize_sub(sub) do
    %{
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      lemon_squeezy_id: sub.lemon_squeezy_id,
      trial_ends_at: sub.trial_ends_at,
      current_period_end: sub.current_period_end,
      max_businesses: sub.max_businesses,
      max_branches: sub.max_branches,
      max_users: sub.max_users
    }
  end

  @doc """
  Verify LemonSqueezy webhook signature (HMAC-SHA256 of raw body) when secret is set.
  In test/dev without a secret, verification is skipped.
  """
  def verify_webhook_signature(raw_body, signature)
      when is_binary(raw_body) and is_binary(signature) do
    secret = webhook_secret()

    if secret in [nil, ""] do
      :ok
    else
      expected =
        :crypto.mac(:hmac, :sha256, secret, raw_body)
        |> Base.encode16(case: :lower)

      if Plug.Crypto.secure_compare(expected, String.downcase(signature)) do
        :ok
      else
        {:error, :invalid_signature}
      end
    end
  end

  def verify_webhook_signature(_, _), do: {:error, :invalid_signature}

  def handle_lemonsqueezy_webhook(payload) when is_map(payload) do
    event = get_in(payload, ["meta", "event_name"]) || payload["event_name"]
    attrs = payload["data"]["attributes"] || payload["attributes"] || %{}
    custom = attrs["custom_data"] || get_in(payload, ["meta", "custom_data"]) || %{}

    owner_id = resolve_owner_id(custom, attrs)
    plan = map_plan(attrs["variant_name"] || attrs["product_name"] || custom["plan"] || "starter")
    ls_id = to_string(payload["data"]["id"] || attrs["subscription_id"] || "")

    period_end = parse_dt(attrs["renews_at"] || attrs["ends_at"])

    result =
      case {event, owner_id} do
        {_, nil} ->
          {:error, :owner_not_found}

        {ev, oid}
        when ev in [
               "subscription_created",
               "subscription_updated",
               "subscription_resumed",
               "subscription_payment_success"
             ] ->
          set_plan(oid, plan, %{
            lemon_squeezy_id: ls_id,
            status: "active",
            current_period_end: period_end
          })

        {ev, oid} when ev in ["subscription_cancelled", "subscription_expired"] ->
          set_plan(oid, plan, %{
            lemon_squeezy_id: ls_id,
            status: "cancelled",
            current_period_end: period_end
          })

        {ev, oid} when ev in ["subscription_paused"] ->
          set_plan(oid, plan, %{lemon_squeezy_id: ls_id, status: "paused"})

        _ ->
          {:ok, :ignored}
      end

    case result do
      {:ok, _} -> {:ok, %{handled: true, event: event, owner_id: owner_id}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp resolve_owner_id(custom, attrs) do
    cond do
      is_binary(custom["owner_id"]) ->
        custom["owner_id"]

      is_binary(custom["user_id"]) ->
        custom["user_id"]

      email = custom["email"] || attrs["user_email"] ->
        case Repo.get_by(User, email: email) do
          nil -> nil
          u -> u.id
        end

      true ->
        nil
    end
  end

  defp map_plan(name) when is_binary(name) do
    down = String.downcase(name)

    cond do
      String.contains?(down, "enterprise") -> "enterprise"
      String.contains?(down, "growth") -> "growth"
      String.contains?(down, "starter") -> "starter"
      String.contains?(down, "trial") -> "trial"
      true -> "starter"
    end
  end

  defp map_plan(_), do: "starter"

  defp parse_dt(nil), do: nil

  defp parse_dt(str) when is_binary(str) do
    case DateTime.from_iso8601(str) do
      {:ok, dt, _} -> DateTime.truncate(dt, :second)
      _ -> nil
    end
  end

  defp webhook_secret do
    System.get_env("LEMONSQUEEZY_WEBHOOK_SECRET") ||
      Application.get_env(:kaarobar, :lemonsqueezy_webhook_secret)
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
    from(m in Kaarobar.Schemas.Membership,
      where: m.owner_id == ^owner_id and m.status == "active",
      select: m.user_id,
      distinct: true
    )
    |> Repo.aggregate(:count)
  end
end
