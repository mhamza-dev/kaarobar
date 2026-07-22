defmodule KaarobarWeb.V1.CrmController do
  use KaarobarWeb, :controller

  alias Kaarobar.{Coupons, Crm, Guardian, Loyalty}

  ## Campaigns

  def index(conn, _params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    data =
      Crm.list_campaigns(business_id, owner_id)
      |> Enum.map(&serialize_campaign/1)

    json(conn, %{data: data})
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Crm.create_campaign(business_id, owner_id, user.id, params) do
      {:ok, c} ->
        conn |> put_status(:created) |> json(%{data: serialize_campaign(c)})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def show(conn, %{"id" => id}) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Crm.get_campaign(id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      c ->
        json(conn, %{data: serialize_campaign(c, true)})
    end
  end

  def preview(conn, params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]
    json(conn, %{data: Crm.preview_audience(business_id, owner_id, params)})
  end

  def send(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Crm.send_campaign(id, business_id, owner_id, user.id) do
      {:ok, c} ->
        summary = delivery_summary(c)
        json(conn, %{data: Map.merge(serialize_campaign(c, true), %{delivery: summary})})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:error, :already_sent} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "already_sent"})

      {:error, :budget_exceeded} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "budget_exceeded"})

      {:error, :insufficient_credits} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "insufficient_credits"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  ## Segments

  def list_segments(conn, _params) do
    data =
      Crm.list_segments(conn.assigns.business_id, conn.assigns.owner_id)
      |> Enum.map(&serialize_segment/1)

    json(conn, %{data: data})
  end

  def create_segment(conn, params) do
    case Crm.create_segment(conn.assigns.business_id, conn.assigns.owner_id, params) do
      {:ok, s} -> conn |> put_status(:created) |> json(%{data: serialize_segment(s)})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def update_segment(conn, %{"id" => id} = params) do
    case Crm.update_segment(id, conn.assigns.business_id, conn.assigns.owner_id, params) do
      {:ok, s} -> json(conn, %{data: serialize_segment(s)})
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def delete_segment(conn, %{"id" => id}) do
    case Crm.delete_segment(id, conn.assigns.business_id, conn.assigns.owner_id) do
      {:ok, _} -> json(conn, %{data: %{ok: true}})
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  ## Coupons

  def list_coupons(conn, _params) do
    data =
      Coupons.list(conn.assigns.business_id, conn.assigns.owner_id)
      |> Enum.map(&serialize_coupon/1)

    json(conn, %{data: data})
  end

  def create_coupon(conn, params) do
    case Coupons.create(conn.assigns.business_id, conn.assigns.owner_id, params) do
      {:ok, c} -> conn |> put_status(:created) |> json(%{data: serialize_coupon(c)})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def update_coupon(conn, %{"id" => id} = params) do
    case Coupons.update(id, conn.assigns.business_id, conn.assigns.owner_id, params) do
      {:ok, c} -> json(conn, %{data: serialize_coupon(c)})
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def validate_coupon(conn, params) do
    code = params["code"]
    cart = params["cart_total"] || "0"

    case Coupons.validate_and_quote(code, conn.assigns.business_id, conn.assigns.owner_id, cart) do
      {:ok, coupon, discount} ->
        json(conn, %{
          data: %{
            coupon: serialize_coupon(coupon),
            discount: to_string(discount)
          }
        })

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: reason})
    end
  end

  ## Loyalty tiers

  def list_tiers(conn, _params) do
    data =
      Loyalty.list_tiers(conn.assigns.business_id, conn.assigns.owner_id)
      |> Enum.map(&serialize_tier/1)

    json(conn, %{data: data})
  end

  def create_tier(conn, params) do
    case Loyalty.create_tier(conn.assigns.business_id, conn.assigns.owner_id, params) do
      {:ok, t} -> conn |> put_status(:created) |> json(%{data: serialize_tier(t)})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def update_tier(conn, %{"id" => id} = params) do
    case Loyalty.update_tier(id, conn.assigns.business_id, conn.assigns.owner_id, params) do
      {:ok, t} -> json(conn, %{data: serialize_tier(t)})
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def delete_tier(conn, %{"id" => id}) do
    case Loyalty.delete_tier(id, conn.assigns.business_id, conn.assigns.owner_id) do
      {:ok, _} -> json(conn, %{data: %{ok: true}})
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  ## Templates

  def list_templates(conn, _params) do
    business_id = conn.assigns.business_id
    _ = Crm.ensure_default_templates(business_id)

    data =
      Crm.list_templates(business_id)
      |> Enum.map(&serialize_template/1)

    json(conn, %{data: data})
  end

  def create_template(conn, params) do
    case Crm.create_template(conn.assigns.business_id, params) do
      {:ok, t} -> conn |> put_status(:created) |> json(%{data: serialize_template(t)})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def update_template(conn, %{"id" => id} = params) do
    case Crm.update_template(id, conn.assigns.business_id, params) do
      {:ok, t} -> json(conn, %{data: serialize_template(t)})
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def delete_template(conn, %{"id" => id}) do
    case Crm.delete_template(id, conn.assigns.business_id) do
      {:ok, _} -> json(conn, %{data: %{ok: true}})
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
    end
  end

  def preview_template(conn, params) do
    vars = params["variables"] || %{}
    rendered =
      Crm.render_template(
        params["title_template"] || params["title"],
        params["body_template"] || params["message"],
        stringify_map(vars)
      )

    json(conn, %{data: Map.put(rendered, :channel, params["channel"] || "email")})
  end

  def messaging_wallet(conn, _params) do
    balance = Crm.wallet_balance(conn.assigns.business_id, conn.assigns.owner_id)
    rates = Application.get_env(:kaarobar, :messaging_unit_costs, %{})

    json(conn, %{
      data: %{
        balance: Decimal.to_string(balance),
        unit_costs: rates
      }
    })
  end

  def top_up_wallet(conn, params) do
    case Crm.top_up_wallet(
           conn.assigns.business_id,
           conn.assigns.owner_id,
           params["amount"],
           params["note"]
         ) do
      {:ok, balance} ->
        json(conn, %{data: %{balance: Decimal.to_string(balance)}})

      {:error, :invalid_amount} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid_amount"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp serialize_template(t) do
    %{
      id: t.id,
      name: t.name,
      channel: t.channel,
      title_template: t.title_template,
      body_template: t.body_template,
      variables: t.variables || %{}
    }
  end

  defp stringify_map(map) when is_map(map) do
    Map.new(map, fn {k, v} -> {to_string(k), v} end)
  end

  defp stringify_map(_), do: %{}

  defp serialize_campaign(c, with_recipients \\ false) do
    recipients = loaded_recipients(c)

    base = %{
      id: c.id,
      name: c.name,
      title: c.title,
      message: c.message,
      audience: c.audience,
      channel: Map.get(c, :channel) || "email",
      min_points: c.min_points,
      segment_id: Map.get(c, :segment_id),
      coupon_id: Map.get(c, :coupon_id),
      template_id: Map.get(c, :template_id),
      budget_amount: c.budget_amount && to_string(c.budget_amount),
      estimated_cost: c.estimated_cost && to_string(c.estimated_cost),
      actual_cost: c.actual_cost && to_string(c.actual_cost),
      unit_cost_snapshot: c.unit_cost_snapshot && to_string(c.unit_cost_snapshot),
      status: c.status,
      sent_at: c.sent_at,
      recipient_count: length(recipients),
      delivery: delivery_summary(c)
    }

    if with_recipients do
      Map.put(
        base,
        :recipients,
        Enum.map(recipients, fn r ->
          %{
            id: r.id,
            customer_id: r.customer_id,
            customer_name: r.customer && r.customer.name,
            user_id: r.user_id,
            channel_status: r.channel_status,
            delivered_at: r.delivered_at
          }
        end)
      )
    else
      base
    end
  end

  defp serialize_segment(s) do
    %{id: s.id, name: s.name, filters: s.filters || %{}}
  end

  defp serialize_coupon(c) do
    %{
      id: c.id,
      code: c.code,
      discount_type: c.discount_type,
      discount_value: to_string(c.discount_value),
      valid_from: c.valid_from,
      valid_to: c.valid_to,
      usage_limit: c.usage_limit,
      usage_count: c.usage_count || 0,
      min_cart: c.min_cart && to_string(c.min_cart),
      stackable: c.stackable == true,
      active: c.active != false,
      campaign_id: c.campaign_id
    }
  end

  defp serialize_tier(t) do
    %{
      id: t.id,
      name: t.name,
      min_points: t.min_points,
      earn_rate: to_string(t.earn_rate),
      redeem_rate: to_string(t.redeem_rate)
    }
  end

  defp loaded_recipients(%{recipients: %Ecto.Association.NotLoaded{}}), do: []
  defp loaded_recipients(%{recipients: list}) when is_list(list), do: list
  defp loaded_recipients(_), do: []

  defp delivery_summary(c) do
    recipients = loaded_recipients(c)

    %{
      notified: Enum.count(recipients, &(&1.channel_status == "notified")),
      email_only: Enum.count(recipients, &(&1.channel_status == "email_only")),
      sms_queued: Enum.count(recipients, &(&1.channel_status == "sms_queued")),
      whatsapp_queued: Enum.count(recipients, &(&1.channel_status == "whatsapp_queued")),
      skipped: Enum.count(recipients, &(&1.channel_status in ~w(skipped_no_user skipped_opt_out))),
      total: length(recipients)
    }
  end
end
