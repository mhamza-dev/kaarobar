defmodule Kaarobar.Billing do
  @moduledoc """
  Subscription plans and Safepay checkout/webhook handling (ADM-FR-002/003/005).

  Pakistan-only SaaS billing via Safepay (JazzCash / Easypaisa / local cards).
  """

  import Ecto.Query
  alias Kaarobar.Billing.Safepay
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{Business, Subscription, SubscriptionPlan, User}

  # Machine-readable module entitlements (ADM-FR-002). Marketing unlocks at Growth+.
  @trial_bundles ~w(any_staff pos inventory customers notifications owner_manage settings)
  @starter_bundles @trial_bundles ++ ~w(accounting hr reports leave_approve)
  @growth_bundles @starter_bundles ++ ~w(marketing payroll_approve pos_approve)
  @enterprise_bundles Enum.map(Kaarobar.Roles.bundles(), &Atom.to_string/1)

  @fallback_catalog %{
    "trial" => %{
      name: "Trial",
      max_businesses: 1,
      max_branches: 2,
      max_users: 5,
      price_pkr: 0,
      billing_period: "trial",
      price_display: "Free · 14 days",
      tagline: "Try Kaarobar with a sample business, branches, and chart of accounts.",
      features: [
        "1 business · 2 branches",
        "POS + inventory",
        "Pakistan chart of accounts included",
        "Owner dashboard",
        "Email support"
      ],
      entitled_bundles: @trial_bundles,
      sort_order: 0
    },
    "starter" => %{
      name: "Starter",
      max_businesses: 3,
      max_branches: 10,
      max_users: 25,
      price_pkr: 4999,
      billing_period: "month",
      price_display: "Rs 4,999/month",
      tagline: "A solid fit when one business is growing across a few shops.",
      features: [
        "Up to 3 businesses",
        "Up to 10 branches",
        "POS, inventory, accounting",
        "Attendance & leave",
        "PDF and Excel exports"
      ],
      entitled_bundles: @starter_bundles,
      sort_order: 1
    },
    "growth" => %{
      name: "Growth",
      max_businesses: 10,
      max_branches: 50,
      max_users: 100,
      price_pkr: 12_999,
      billing_period: "month",
      price_display: "Rs 12,999/month",
      tagline: "For owners juggling several businesses who need payroll and FBR.",
      features: [
        "Up to 10 businesses",
        "Up to 50 branches",
        "Payroll that posts to the ledger",
        "FBR Tier-1 reporting",
        "Approvals and audit history",
        "Priority support"
      ],
      entitled_bundles: @growth_bundles,
      sort_order: 2
    },
    "enterprise" => %{
      name: "Enterprise",
      max_businesses: 9999,
      max_branches: 9999,
      max_users: 9999,
      price_pkr: nil,
      billing_period: "custom",
      price_display: "Custom",
      tagline: "Higher limits, hands-on onboarding, and help with compliance setup.",
      features: [
        "Custom business and branch limits",
        "A named person to help you",
        "Security review support",
        "Custom tax templates",
        "SLA options"
      ],
      entitled_bundles: @enterprise_bundles,
      sort_order: 3
    }
  }

  def plans do
    case list_plans() do
      [] -> Map.keys(@fallback_catalog)
      rows -> Enum.map(rows, & &1.code)
    end
  end

  def list_plans do
    rows =
      from(p in SubscriptionPlan,
        where: p.is_active == true,
        order_by: [asc: p.sort_order, asc: p.code]
      )
      |> Repo.all()

    if rows == [] do
      @fallback_catalog
      |> Enum.map(fn {code, attrs} -> plan_from_fallback(code, attrs) end)
      |> Enum.sort_by(&{&1.sort_order, &1.code})
    else
      rows
    end
  end

  def get_plan(code) when is_binary(code) do
    Repo.get_by(SubscriptionPlan, code: code) ||
      case Map.get(@fallback_catalog, code) do
        nil -> nil
        attrs -> plan_from_fallback(code, attrs)
      end
  end

  def limits_for(plan_code) do
    case get_plan(plan_code) do
      %SubscriptionPlan{} = p ->
        %{
          max_businesses: p.max_businesses,
          max_branches: p.max_branches,
          max_users: p.max_users,
          safepay_plan_id: Map.get(p, :safepay_plan_id),
          lemon_variant_id: p.lemon_variant_id
        }

      _ ->
        fb = Map.get(@fallback_catalog, plan_code, @fallback_catalog["trial"])

        %{
          max_businesses: fb.max_businesses,
          max_branches: fb.max_branches,
          max_users: fb.max_users,
          safepay_plan_id: nil,
          lemon_variant_id: nil
        }
    end
  end

  defp plan_from_fallback(code, attrs) do
    %SubscriptionPlan{
      code: code,
      name: attrs.name,
      max_businesses: attrs.max_businesses,
      max_branches: attrs.max_branches,
      max_users: attrs.max_users,
      price_pkr: attrs.price_pkr,
      billing_period: attrs.billing_period,
      price_display: attrs.price_display,
      tagline: attrs.tagline,
      features: attrs.features,
      entitled_bundles: attrs.entitled_bundles || [],
      sort_order: attrs.sort_order,
      is_active: true,
      safepay_plan_id: Safepay.plan_id_for(code)
    }
  end

  @doc """
  Module bundles entitled by the owner's current subscription plan (ADM-FR-002).
  """
  def entitled_bundles_for_owner(owner_id) when is_binary(owner_id) do
    sub = get_subscription(owner_id) || elem(ensure_subscription(owner_id), 1)
    entitled_bundles_for_plan(sub.plan)
  end

  def entitled_bundles_for_owner(_), do: entitled_bundles_for_plan("trial")

  def entitled_bundles_for_plan(plan_code) when is_binary(plan_code) do
    case get_plan(plan_code) do
      %SubscriptionPlan{entitled_bundles: bundles} when is_list(bundles) and bundles != [] ->
        bundles

      _ ->
        fb = Map.get(@fallback_catalog, plan_code, @fallback_catalog["trial"])
        fb.entitled_bundles || []
    end
  end

  def entitled_bundles_for_plan(_), do: @trial_bundles

  @doc """
  True when the owner's plan includes the given module bundle (ADM-FR-002).
  """
  def plan_allows_bundle?(owner_id, bundle) when is_atom(bundle) do
    plan_allows_bundle?(owner_id, Atom.to_string(bundle))
  end

  def plan_allows_bundle?(owner_id, bundle) when is_binary(bundle) and is_binary(owner_id) do
    bundle in entitled_bundles_for_owner(owner_id)
  end

  def plan_allows_bundle?(_, _), do: false

  @doc """
  FBR Tier-1 is Growth+ only (ADM-FR-002 / FBR-FR-001).
  """
  def plan_allows_fbr?(owner_id) when is_binary(owner_id) do
    sub = get_subscription(owner_id) || elem(ensure_subscription(owner_id), 1)
    sub.plan in ~w(growth enterprise)
  end

  def plan_allows_fbr?(_), do: false

  def ensure_subscription(owner_id, plan \\ "trial") do
    case Repo.get_by(Subscription, owner_id: owner_id) do
      nil ->
        limits = limits_for(plan)

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
    limits = limits_for(plan)

    # `lemon_squeezy_id` column stores the external provider subscription id (Safepay token).
    external_id =
      extra[:safepay_id] || extra["safepay_id"] ||
        extra[:lemon_squeezy_id] || extra["lemon_squeezy_id"]

    attrs = %{
      plan: plan,
      status: extra[:status] || extra["status"] || "active",
      max_businesses: limits.max_businesses,
      max_branches: limits.max_branches,
      max_users: limits.max_users,
      lemon_squeezy_id: external_id,
      current_period_end: extra[:current_period_end] || extra["current_period_end"],
      trial_ends_at: extra[:trial_ends_at] || extra["trial_ends_at"]
    }

    attrs = Enum.reject(attrs, fn {_k, v} -> is_nil(v) end) |> Map.new()

    result =
      case get_subscription(owner_id) do
        nil ->
          with {:ok, sub} <- ensure_subscription(owner_id, plan) do
            sub |> Subscription.changeset(attrs) |> Repo.update()
          end

        sub ->
          sub |> Subscription.changeset(attrs) |> Repo.update()
      end

    case result do
      {:ok, sub} ->
        _ = sync_business_plans(owner_id, plan)
        {:ok, sub}

      other ->
        other
    end
  end

  defp sync_business_plans(owner_id, plan) do
    from(b in Business, where: b.owner_id == ^owner_id)
    |> Repo.update_all(
      set: [subscription_plan: plan, updated_at: DateTime.utc_now() |> DateTime.truncate(:second)]
    )
  end

  def get_subscription(owner_id), do: Repo.get_by(Subscription, owner_id: owner_id)

  @doc """
  True when the owner may create businesses/branches/users (ADM-FR-002/005).
  """
  def subscription_allows_writes?(owner_id) do
    sub = get_subscription(owner_id) || elem(ensure_subscription(owner_id), 1)
    now = DateTime.utc_now()

    cond do
      sub.status in ~w(cancelled expired paused) ->
        false

      sub.status == "past_due" ->
        false

      sub.plan == "trial" and match?(%DateTime{}, sub.trial_ends_at) and
          DateTime.compare(sub.trial_ends_at, now) == :lt ->
        false

      true ->
        true
    end
  end

  def within_limits?(owner_id, kind) do
    if not subscription_allows_writes?(owner_id) do
      false
    else
      sub = get_subscription(owner_id) || elem(ensure_subscription(owner_id), 1)

      case kind do
        :business -> count_businesses(owner_id) < sub.max_businesses
        :branch -> count_branches(owner_id) < sub.max_branches
        :user -> count_users(owner_id) < sub.max_users
        _ -> true
      end
    end
  end

  def limit_error(owner_id) do
    if subscription_allows_writes?(owner_id) do
      :plan_limit_reached
    else
      :subscription_inactive
    end
  end

  def notify_plan_limit(owner_id, kind) when is_binary(owner_id) do
    label =
      case kind do
        :business -> "businesses"
        :branch -> "branches"
        :user -> "users"
        _ -> "resources"
      end

    {title, body} =
      if subscription_allows_writes?(owner_id) do
        {"Plan limit reached",
         "You've reached your plan limit for #{label}. Upgrade to add more."}
      else
        {"Subscription inactive",
         "Your trial has ended or subscription is inactive. Upgrade to continue."}
      end

    Kaarobar.Notifications.notify(
      owner_id,
      owner_id,
      "billing.limit",
      %{kind: to_string(kind)},
      title: title,
      body: body
    )
  end

  def usage_summary(owner_id) do
    {:ok, sub} = ensure_subscription(owner_id)
    bundles = entitled_bundles_for_plan(sub.plan)

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
      entitled_bundles: bundles,
      allows_fbr: plan_allows_fbr?(owner_id),
      allows_writes: subscription_allows_writes?(owner_id),
      plans: Enum.map(list_plans(), &serialize_plan/1),
      checkout_url: Safepay.fallback_checkout_url()
    }
  end

  def serialize_plan(p) do
    bundles =
      cond do
        is_list(p.entitled_bundles) and p.entitled_bundles != [] -> p.entitled_bundles
        true -> entitled_bundles_for_plan(p.code)
      end

    safepay_plan_id = resolve_safepay_plan_id(p)

    %{
      code: p.code,
      name: p.name,
      max_businesses: p.max_businesses,
      max_branches: p.max_branches,
      max_users: p.max_users,
      price_display: p.price_display,
      price_pkr: p.price_pkr,
      billing_period: p.billing_period,
      tagline: p.tagline,
      features: p.features || [],
      entitled_bundles: bundles,
      safepay_plan_id: safepay_plan_id,
      lemon_variant_id: p.lemon_variant_id,
      sort_order: p.sort_order,
      checkout_available: checkout_available?(p)
    }
  end

  defp checkout_available?(%SubscriptionPlan{code: "trial"}), do: false

  defp checkout_available?(%SubscriptionPlan{} = p) do
    plan_id = resolve_safepay_plan_id(p)
    fallback = Safepay.fallback_checkout_url()

    (Safepay.configured?() and is_binary(plan_id) and plan_id != "") or
      (is_binary(fallback) and fallback != "")
  end

  defp resolve_safepay_plan_id(%SubscriptionPlan{} = p) do
    Map.get(p, :safepay_plan_id) || Safepay.plan_id_for(p.code)
  end

  def serialize_sub(sub) do
    %{
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      lemon_squeezy_id: sub.lemon_squeezy_id,
      safepay_id: sub.lemon_squeezy_id,
      trial_ends_at: sub.trial_ends_at,
      current_period_end: sub.current_period_end,
      max_businesses: sub.max_businesses,
      max_branches: sub.max_branches,
      max_users: sub.max_users,
      entitled_bundles: entitled_bundles_for_plan(sub.plan),
      allows_fbr: sub.plan in ~w(growth enterprise),
      allows_writes: subscription_allows_writes?(sub.owner_id)
    }
  end

  @doc """
  Create a Safepay hosted checkout for a subscription plan upgrade (ADM-FR-003).
  Falls back to `SAFEPAY_CHECKOUT_URL` when API credentials are missing.
  Trial plans cannot be purchased.
  """
  def create_plan_checkout(owner_id, plan_code, opts \\ %{}) do
    plan = get_plan(plan_code)

    if is_nil(plan) or plan_code == "trial" do
      {:error, :invalid_plan}
    else
      plan_id = resolve_safepay_plan_id(plan)

      reference =
        Safepay.encode_reference(%{
          "owner_id" => owner_id,
          "type" => "subscription",
          "plan" => plan_code
        })

      case Safepay.create_subscription_checkout(plan_id || "", reference, opts) do
        {:ok, %{checkout_url: url} = meta} ->
          {:ok, Map.merge(meta, %{plan: plan_code, checkout_url: url})}

        {:error, :not_configured} ->
          case Safepay.fallback_checkout_url() do
            url when is_binary(url) and url != "" ->
              {:ok, %{checkout_url: url, plan: plan_code, dev_fallback: true}}

            _ ->
              {:error, :not_configured}
          end

        other ->
          other
      end
    end
  end

  def verify_webhook_signature(raw_body, signature, opts \\ [])

  def verify_webhook_signature(raw_body, signature, opts)
      when is_binary(raw_body) and is_binary(signature) do
    Safepay.verify_webhook_signature(raw_body, signature, opts)
  end

  def verify_webhook_signature(_, _, _), do: {:error, :invalid_signature}

  @doc """
  Normalize Safepay webhook payloads into `set_plan/3` or campaign payment completion.
  Idempotent for repeat success events.
  """
  def handle_safepay_webhook(payload) when is_map(payload) do
    event = webhook_event_name(payload)
    data = webhook_data(payload)
    custom = extract_custom(payload, data)

    if custom["type"] == "campaign_send" or is_binary(custom["campaign_id"]) or
         is_binary(custom["payment_id"]) do
      Kaarobar.Crm.complete_campaign_payment_from_webhook(payload, custom, event)
    else
      handle_subscription_webhook(event, data, custom)
    end
  end

  defp handle_subscription_webhook(event, data, custom) do
    owner_id = resolve_owner_id(custom, data)
    plan = map_plan(custom["plan"] || data["plan_name"] || data["plan_id"] || "starter")
    safepay_id = to_string(data["token"] || data["subscription_id"] || data["id"] || "")

    period_end =
      parse_dt(
        data["current_period_end_date"] || data["current_period_end"] || data["renews_at"] ||
          data["ends_at"]
      )

    status_hint = String.upcase(to_string(data["status"] || ""))

    result =
      case {normalize_event(event, status_hint), owner_id} do
        {_, nil} ->
          {:error, :owner_not_found}

        {ev, oid}
        when ev in [
               :subscription_created,
               :subscription_updated,
               :subscription_resumed,
               :subscription_payment_success,
               :payment_completed
             ] ->
          set_plan(oid, plan, %{
            safepay_id: safepay_id,
            status: "active",
            current_period_end: period_end
          })

        {ev, oid} when ev in [:subscription_cancelled, :subscription_expired] ->
          set_plan(oid, plan, %{
            safepay_id: safepay_id,
            status: if(ev == :subscription_expired, do: "expired", else: "cancelled"),
            current_period_end: period_end
          })

        {:subscription_paused, oid} ->
          set_plan(oid, plan, %{safepay_id: safepay_id, status: "paused"})

        {ev, oid} when ev in [:subscription_payment_failed, :payment_failed, :payment_refunded] ->
          set_plan(oid, plan, %{safepay_id: safepay_id, status: "past_due"})

        _ ->
          {:ok, :ignored}
      end

    case result do
      {:ok, _} -> {:ok, %{handled: true, event: event, owner_id: owner_id}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp webhook_event_name(payload) do
    payload["type"] || payload["event"] || payload["event_type"] || payload["event_name"] ||
      get_in(payload, ["meta", "event_name"]) ||
      get_in(payload, ["data", "type"]) ||
      ""
  end

  defp webhook_data(payload) do
    cond do
      is_map(payload["data"]) -> payload["data"]
      is_map(payload["attributes"]) -> payload["attributes"]
      true -> payload
    end
  end

  defp extract_custom(payload, data) do
    embedded =
      cond do
        is_map(data["metadata"]) ->
          data["metadata"]

        is_map(data["custom_data"]) ->
          data["custom_data"]

        is_map(get_in(payload, ["meta", "custom_data"])) ->
          get_in(payload, ["meta", "custom_data"])

        true ->
          %{}
      end

    ref = data["reference"] || data["order_id"] || payload["reference"] || payload["order_id"]

    from_ref =
      case Safepay.decode_reference(ref) do
        {:ok, map} -> map
        _ -> %{}
      end

    Map.merge(from_ref, embedded)
  end

  defp normalize_event(event, status_hint) when is_binary(event) do
    down = String.downcase(event)

    cond do
      down in ~w(subscription.created subscription_created) ->
        :subscription_created

      down in ~w(subscription.updated subscription_updated) ->
        :subscription_updated

      down in ~w(subscription.resumed subscription_resumed) ->
        :subscription_resumed

      down in ~w(subscription.cancelled subscription.canceled subscription_cancelled) ->
        :subscription_cancelled

      down in ~w(subscription.expired subscription_expired incomplete_expired) ->
        :subscription_expired

      down in ~w(subscription.paused subscription_paused) ->
        :subscription_paused

      down in ~w(subscription.payment_success subscription_payment_success) ->
        :subscription_payment_success

      down in ~w(subscription.payment_failed subscription_payment_failed) ->
        :subscription_payment_failed

      down in ~w(payment.completed payment_completed order_paid order_created) ->
        :payment_completed

      down in ~w(payment.failed payment_failed) ->
        :payment_failed

      down in ~w(payment.refunded payment_refunded order_refunded) ->
        :payment_refunded

      status_hint == "ACTIVE" ->
        :subscription_created

      status_hint == "PAUSED" ->
        :subscription_paused

      status_hint in ~w(CANCELED CANCELLED) ->
        :subscription_cancelled

      status_hint == "PAST_DUE" ->
        :subscription_payment_failed

      status_hint in ~w(ENDED EXPIRED) ->
        :subscription_expired

      true ->
        :ignored
    end
  end

  defp normalize_event(_, status_hint), do: normalize_event("", status_hint)

  defp resolve_owner_id(custom, attrs) do
    cond do
      is_binary(custom["owner_id"]) ->
        custom["owner_id"]

      is_binary(custom["user_id"]) ->
        custom["user_id"]

      email = custom["email"] || attrs["user_email"] || attrs["email"] ->
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
      down in ~w(starter growth enterprise trial) -> down
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

  defp count_businesses(owner_id) do
    from(b in Business, where: b.owner_id == ^owner_id and b.is_active == true)
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
