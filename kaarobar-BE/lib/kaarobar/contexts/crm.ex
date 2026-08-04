defmodule Kaarobar.Crm do
  @moduledoc """
  Marketing campaigns, segments, and consent-aware audience resolution.
  CRM-FR-001/002/009/012/016 — Phase A extends baseline campaigns.
  """

  import Ecto.Query

  alias Kaarobar.{Audit, Mailer, Notifications, Repo}

  alias Kaarobar.Schemas.{
    Business,
    CampaignPayment,
    CampaignSegment,
    CrmCampaign,
    CrmCampaignRecipient,
    CrmMessageTemplate,
    Customer,
    MessagingWalletLedger,
    Sale
  }

  @paid_channels ~w(sms whatsapp)

  def paid_channel?(channel), do: to_string(channel || "") in @paid_channels

  ## —— Segments (CRM-FR-001) ————————————————————————————————

  def list_segments(business_id, owner_id) do
    from(s in CampaignSegment,
      where: s.business_id == ^business_id and s.owner_id == ^owner_id,
      order_by: [asc: s.name]
    )
    |> Repo.all()
  end

  def get_segment(id, business_id, owner_id) do
    Repo.get_by(CampaignSegment, id: id, business_id: business_id, owner_id: owner_id)
  end

  def create_segment(business_id, owner_id, attrs) do
    %CampaignSegment{}
    |> CampaignSegment.changeset(
      Map.merge(stringify_keys(attrs), %{
        "business_id" => business_id,
        "owner_id" => owner_id
      })
    )
    |> Repo.insert()
  end

  def update_segment(id, business_id, owner_id, attrs) do
    case get_segment(id, business_id, owner_id) do
      nil -> {:error, :not_found}
      segment -> segment |> CampaignSegment.changeset(stringify_keys(attrs)) |> Repo.update()
    end
  end

  def delete_segment(id, business_id, owner_id) do
    case get_segment(id, business_id, owner_id) do
      nil -> {:error, :not_found}
      segment -> Repo.delete(segment)
    end
  end

  ## —— Campaigns ————————————————————————————————————————————

  def list_campaigns(business_id, owner_id, opts \\ []) do
    alias KaarobarWeb.Controllers.Helpers.ListFilters

    query =
      from(c in CrmCampaign,
        where: c.business_id == ^business_id and c.owner_id == ^owner_id,
        order_by: [desc: c.inserted_at],
        preload: [:segment, :coupon]
      )

    result = ListFilters.paginate(query, opts)
    ids = Enum.map(result.data, & &1.id)

    counts =
      if ids == [] do
        %{}
      else
        from(r in Kaarobar.Schemas.CrmCampaignRecipient,
          where: r.campaign_id in ^ids,
          group_by: r.campaign_id,
          select: {r.campaign_id, count(r.id)}
        )
        |> Repo.all()
        |> Map.new()
      end

    data =
      Enum.map(result.data, fn c ->
        Map.put(c, :recipients_count, Map.get(counts, c.id, 0))
      end)

    %{data: data, meta: result.meta}
  end

  def get_campaign(id, business_id, owner_id) do
    from(c in CrmCampaign,
      where: c.id == ^id and c.business_id == ^business_id and c.owner_id == ^owner_id,
      preload: [recipients: :customer, segment: [], coupon: []]
    )
    |> Repo.one()
  end

  def create_campaign(business_id, owner_id, created_by_id, attrs) do
    %CrmCampaign{}
    |> CrmCampaign.changeset(
      Map.merge(stringify_keys(attrs), %{
        "business_id" => business_id,
        "owner_id" => owner_id,
        "created_by_id" => created_by_id,
        "status" => "Draft"
      })
    )
    |> Repo.insert()
  end

  ## CRM-FR-012 audience size + paid messaging cost preview
  def preview_audience(business_id, owner_id, attrs) do
    attrs = stringify_keys(attrs)
    channel = attrs["channel"] || "email"
    budget = parse_decimal(attrs["budget_amount"])

    fake = %CrmCampaign{
      business_id: business_id,
      owner_id: owner_id,
      audience: attrs["audience"] || "all",
      min_points: parse_int(attrs["min_points"]),
      segment_id: attrs["segment_id"],
      channel: channel
    }

    customers = resolve_audience(fake)
    count = length(customers)
    unit = unit_cost(channel)
    estimated = Decimal.mult(unit, Decimal.new(count))
    wallet = wallet_balance(business_id, owner_id)

    within_budget =
      is_nil(budget) or Decimal.compare(estimated, budget) != :gt

    within_wallet = Decimal.compare(estimated, wallet) != :gt

    requires_payment =
      paid_channel?(channel) and Decimal.compare(estimated, Decimal.new("0")) == :gt

    %{
      count: count,
      audience_size: count,
      unit_cost: Decimal.to_string(unit),
      estimated_cost: Decimal.to_string(estimated),
      wallet_balance: Decimal.to_string(wallet),
      budget_amount: budget && Decimal.to_string(budget),
      within_budget: within_budget,
      within_wallet: within_wallet,
      requires_payment: requires_payment,
      paid_channel: paid_channel?(channel),
      can_send:
        within_budget and
          if(requires_payment, do: true, else: within_wallet)
    }
  end

  def send_campaign(campaign_id, business_id, owner_id, actor_id, opts \\ []) do
    prepaid = Keyword.get(opts, :prepaid, false)

    case get_campaign(campaign_id, business_id, owner_id) do
      nil ->
        {:error, :not_found}

      %{status: "Sent"} ->
        {:error, :already_sent}

      campaign ->
        customers = resolve_audience(campaign)
        count = length(customers)
        unit = unit_cost(campaign.channel || "email")
        estimated = Decimal.mult(unit, Decimal.new(count))
        wallet = wallet_balance(business_id, owner_id)
        paid? = prepaid or has_paid_payment?(campaign.id)

        cond do
          campaign.budget_amount &&
              Decimal.compare(estimated, campaign.budget_amount) == :gt ->
            {:error, :budget_exceeded}

          paid_channel?(campaign.channel) and not paid? ->
            {:error, :payment_required}

          not paid_channel?(campaign.channel) and
            Decimal.compare(estimated, wallet) == :gt and
              Decimal.compare(estimated, Decimal.new("0")) == :gt ->
            {:error, :insufficient_credits}

          true ->
            do_send_campaign(
              campaign,
              customers,
              estimated,
              unit,
              business_id,
              owner_id,
              actor_id,
              skip_wallet: paid_channel?(campaign.channel) and paid?
            )
        end
    end
  end

  defp has_paid_payment?(campaign_id) do
    from(p in CampaignPayment,
      where: p.campaign_id == ^campaign_id and p.status == "paid",
      select: count(p.id)
    )
    |> Repo.one()
    |> Kernel.>(0)
  end

  @doc """
  Create Safepay checkout to pay for an SMS/WhatsApp campaign send (PKR one-time).
  """
  def create_campaign_checkout(campaign_id, business_id, owner_id, actor_id, opts \\ %{}) do
    case get_campaign(campaign_id, business_id, owner_id) do
      nil ->
        {:error, :not_found}

      %{status: "Sent"} ->
        {:error, :already_sent}

      campaign ->
        if not paid_channel?(campaign.channel) do
          {:error, :not_paid_channel}
        else
          customers = resolve_audience(campaign)
          count = length(customers)
          unit = unit_cost(campaign.channel || "sms")
          estimated = Decimal.mult(unit, Decimal.new(count))

          if Decimal.compare(estimated, Decimal.new("0")) != :gt do
            {:error, :zero_cost}
          else
            {:ok, payment} =
              %CampaignPayment{}
              |> CampaignPayment.changeset(%{
                amount: estimated,
                currency: "PKR",
                status: "pending",
                campaign_id: campaign.id,
                business_id: business_id,
                owner_id: owner_id,
                actor_id: actor_id
              })
              |> Repo.insert()

            reference =
              Kaarobar.Billing.Safepay.encode_reference(%{
                "type" => "campaign_send",
                "campaign_id" => campaign.id,
                "business_id" => business_id,
                "owner_id" => owner_id,
                "payment_id" => payment.id,
                "actor_id" => actor_id
              })

            case Kaarobar.Billing.Safepay.create_payment_checkout(estimated, reference, opts) do
              {:ok, %{checkout_url: url} = meta} ->
                payment
                |> CampaignPayment.changeset(%{
                  checkout_url: url,
                  lemon_checkout_id: meta[:checkout_id] || meta[:tracker] || meta["checkout_id"]
                })
                |> Repo.update()

                {:ok,
                 %{payment: payment, checkout_url: url, amount: Decimal.to_string(estimated)}}

              {:error, :not_configured} ->
                # Dev fallback: mark checkout_url as local confirm path
                url =
                  "/api/v1/crm/campaigns/#{campaign.id}/confirm-payment?payment_id=#{payment.id}"

                payment
                |> CampaignPayment.changeset(%{checkout_url: url})
                |> Repo.update()

                {:ok,
                 %{
                   payment: payment,
                   checkout_url: url,
                   amount: Decimal.to_string(estimated),
                   dev_fallback: true
                 }}

              {:error, reason} ->
                _ =
                  payment
                  |> CampaignPayment.changeset(%{status: "failed"})
                  |> Repo.update()

                {:error, reason}
            end
          end
        end
    end
  end

  def confirm_dev_campaign_payment(campaign_id, payment_id, business_id, owner_id) do
    payment = Repo.get_by(CampaignPayment, id: payment_id, campaign_id: campaign_id)

    cond do
      is_nil(payment) ->
        {:error, :not_found}

      payment.business_id != business_id or payment.owner_id != owner_id ->
        {:error, :forbidden}

      payment.status == "paid" ->
        send_campaign(campaign_id, business_id, owner_id, payment.actor_id || owner_id,
          prepaid: true
        )

      true ->
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        {:ok, _} =
          payment
          |> CampaignPayment.changeset(%{
            status: "paid",
            paid_at: now,
            lemon_order_id: "dev-#{payment.id}"
          })
          |> Repo.update()

        # Credit wallet then send as prepaid (ledger still records spend)
        _ =
          top_up_wallet(business_id, owner_id, payment.amount, "Safepay campaign payment (dev)")

        send_campaign(campaign_id, business_id, owner_id, payment.actor_id || owner_id,
          prepaid: true
        )
    end
  end

  def complete_campaign_payment_from_webhook(payload, custom, event) do
    payment_id = custom["payment_id"]
    campaign_id = custom["campaign_id"]
    business_id = custom["business_id"]
    owner_id = custom["owner_id"]
    actor_id = custom["actor_id"] || owner_id

    data = payload["data"] || payload

    order_id =
      to_string(
        data["token"] || data["tracker"] || data["id"] || payload["tracker"] ||
          get_in(payload, ["data", "id"]) || ""
      )

    success_events =
      ~w(payment.completed payment_completed order_created order_paid order_payment_success subscription_payment_success)

    event_ok? =
      event in success_events or
        String.downcase(to_string(event)) in success_events or
        String.upcase(to_string(data["status"] || "")) in ~w(COMPLETED PAID SUCCESS)

    if event_ok? and is_binary(campaign_id) and is_binary(business_id) do
      payment =
        cond do
          is_binary(payment_id) ->
            Repo.get(CampaignPayment, payment_id)

          true ->
            from(p in CampaignPayment,
              where: p.campaign_id == ^campaign_id and p.status == "pending",
              order_by: [desc: p.inserted_at],
              limit: 1
            )
            |> Repo.one()
        end

      case payment do
        nil ->
          {:error, :payment_not_found}

        %{status: "paid"} ->
          {:ok, %{handled: true, event: event, already_paid: true}}

        payment ->
          now = DateTime.utc_now() |> DateTime.truncate(:second)

          {:ok, _} =
            payment
            |> CampaignPayment.changeset(%{
              status: "paid",
              paid_at: now,
              lemon_order_id: if(order_id != "", do: order_id, else: payment.lemon_order_id)
            })
            |> Repo.update()

          _ =
            top_up_wallet(
              business_id,
              owner_id,
              payment.amount,
              "Safepay campaign payment"
            )

          case send_campaign(campaign_id, business_id, owner_id, actor_id, prepaid: true) do
            {:ok, _} -> {:ok, %{handled: true, event: event, campaign_id: campaign_id}}
            {:error, :already_sent} -> {:ok, %{handled: true, event: event, already_sent: true}}
            {:error, reason} -> {:error, reason}
          end
      end
    else
      {:ok, :ignored}
    end
  end

  defp do_send_campaign(
         campaign,
         customers,
         estimated,
         unit,
         business_id,
         owner_id,
         actor_id,
         opts
       ) do
    skip_wallet = Keyword.get(opts, :skip_wallet, false)
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    recipients =
      Enum.map(customers, fn customer ->
        {status, user_id} = deliver_to_customer(campaign, customer, owner_id)

        %{
          campaign_id: campaign.id,
          customer_id: customer.id,
          user_id: user_id,
          channel_status: status,
          delivered_at:
            if(status in ~w(notified email_only sms_queued whatsapp_queued), do: now, else: nil)
        }
      end)

    Repo.transaction(fn ->
      biz =
        Repo.get_by!(Business, id: business_id, owner_id: owner_id)

      unless skip_wallet do
        new_balance = Decimal.sub(biz.messaging_wallet_balance || Decimal.new("0"), estimated)

        if Decimal.compare(new_balance, Decimal.new("0")) == :lt do
          Repo.rollback(:insufficient_credits)
        end

        biz
        |> Business.changeset(%{messaging_wallet_balance: new_balance})
        |> Repo.update!()
      else
        # Prepaid via Safepay: still debit if wallet was credited on payment
        new_balance = Decimal.sub(biz.messaging_wallet_balance || Decimal.new("0"), estimated)

        if Decimal.compare(new_balance, Decimal.new("0")) == :lt do
          # Allow zeroing if credit race; clamp at 0
          biz
          |> Business.changeset(%{messaging_wallet_balance: Decimal.new("0")})
          |> Repo.update!()
        else
          biz
          |> Business.changeset(%{messaging_wallet_balance: new_balance})
          |> Repo.update!()
        end
      end

      %MessagingWalletLedger{}
      |> MessagingWalletLedger.changeset(%{
        business_id: business_id,
        owner_id: owner_id,
        amount: Decimal.negate(estimated),
        kind: "campaign_spend",
        note: "Campaign #{campaign.name}",
        campaign_id: campaign.id
      })
      |> Repo.insert!()

      Enum.each(recipients, fn attrs ->
        %CrmCampaignRecipient{}
        |> CrmCampaignRecipient.changeset(attrs)
        |> Repo.insert!()
      end)

      {:ok, updated} =
        campaign
        |> CrmCampaign.changeset(%{
          status: "Sent",
          sent_at: now,
          estimated_cost: estimated,
          actual_cost: estimated,
          unit_cost_snapshot: unit
        })
        |> Repo.update()

      Audit.log(%{
        owner_id: owner_id,
        user_id: actor_id,
        action: "crm.campaign_send",
        entity_type: "crm_campaign",
        entity_id: campaign.id,
        metadata: %{
          recipients: length(recipients),
          channel: campaign.channel,
          estimated_cost: Decimal.to_string(estimated),
          notified: Enum.count(recipients, &(&1.channel_status == "notified")),
          email_only: Enum.count(recipients, &(&1.channel_status == "email_only")),
          skipped:
            Enum.count(recipients, &(&1.channel_status in ~w(skipped_no_user skipped_opt_out)))
        }
      })

      Repo.preload(updated, recipients: :customer)
    end)
    |> case do
      {:ok, updated} -> {:ok, updated}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Resolve audience with optional segment filters and consent suppression (CRM-FR-009).
  """
  def resolve_audience(%CrmCampaign{} = campaign) do
    q =
      from(c in Customer,
        where: c.business_id == ^campaign.business_id and c.owner_id == ^campaign.owner_id
      )

    q =
      case campaign.audience do
        audience when audience in ["credit", "khata"] ->
          from(c in q, where: c.credit_enabled == true)

        "min_points" ->
          min = campaign.min_points || 0
          from(c in q, where: c.loyalty_points >= ^min)

        "segment" ->
          apply_segment_filters(q, campaign)

        _ ->
          q
      end

    q = apply_consent_filter(q, campaign.channel || "email")
    Repo.all(q)
  end

  defp apply_segment_filters(q, campaign) do
    segment =
      cond do
        is_binary(campaign.segment_id) and campaign.segment_id != "" ->
          get_segment(campaign.segment_id, campaign.business_id, campaign.owner_id)

        match?(%Ecto.Association.NotLoaded{}, Map.get(campaign, :segment)) ->
          nil

        true ->
          Map.get(campaign, :segment)
      end

    filters = (segment && segment.filters) || %{}

    q =
      if Map.get(filters, "credit_enabled") == true or Map.get(filters, :credit_enabled) == true or
           Map.get(filters, "khata_enabled") == true or Map.get(filters, :khata_enabled) == true do
        from(c in q, where: c.credit_enabled == true)
      else
        q
      end

    q =
      case Map.get(filters, "min_points") || Map.get(filters, :min_points) do
        n when is_integer(n) -> from(c in q, where: c.loyalty_points >= ^n)
        n when is_binary(n) -> from(c in q, where: c.loyalty_points >= ^String.to_integer(n))
        _ -> q
      end

    q =
      case Map.get(filters, "loyalty_tier_id") || Map.get(filters, :loyalty_tier_id) do
        id when is_binary(id) and id != "" -> from(c in q, where: c.loyalty_tier_id == ^id)
        _ -> q
      end

    q =
      case Map.get(filters, "inactive_days") || Map.get(filters, :inactive_days) do
        days when is_integer(days) and days > 0 ->
          cutoff = DateTime.utc_now() |> DateTime.add(-days * 86_400, :second)

          from(c in q,
            left_join: s in Sale,
            on: s.customer_id == c.id and s.business_id == c.business_id,
            group_by: c.id,
            having: max(s.inserted_at) < ^cutoff or is_nil(max(s.inserted_at))
          )

        _ ->
          q
      end

    q
  end

  defp apply_consent_filter(q, channel) do
    case channel do
      "email" ->
        from(c in q, where: c.marketing_opt_in_email == true)

      "sms" ->
        from(c in q, where: c.marketing_opt_in_sms == true)

      "whatsapp" ->
        from(c in q, where: c.marketing_opt_in_whatsapp == true)

      "in_app" ->
        q

      _ ->
        q
    end
  end

  defp deliver_to_customer(campaign, customer, owner_id) do
    channel = campaign.channel || "email"

    cond do
      channel == "email" and not customer.marketing_opt_in_email ->
        {"skipped_opt_out", nil}

      channel == "sms" and not customer.marketing_opt_in_sms ->
        {"skipped_opt_out", nil}

      channel == "whatsapp" and not customer.marketing_opt_in_whatsapp ->
        {"skipped_opt_out", nil}

      channel == "in_app" and is_binary(customer.customer_account_id) ->
        Notifications.notify_customer_account(
          customer.customer_account_id,
          owner_id,
          "crm.campaign",
          %{campaign_id: campaign.id, message: campaign.message, title: campaign.title},
          title: campaign.title,
          body: campaign.message
        )

        {"notified", customer.customer_account_id}

      channel == "in_app" and is_binary(customer.user_id) ->
        Notifications.notify(
          customer.user_id,
          owner_id,
          "crm.campaign",
          %{campaign_id: campaign.id, message: campaign.message, title: campaign.title},
          title: campaign.title,
          body: campaign.message
        )

        {"notified", customer.user_id}

      channel == "email" and is_binary(customer.email) and customer.email != "" ->
        _ = deliver_customer_email(customer, campaign)
        {"email_only", nil}

      channel == "sms" ->
        enqueue_sms(campaign, customer)
        {"sms_queued", nil}

      channel == "whatsapp" ->
        enqueue_whatsapp(campaign, customer)
        {"whatsapp_queued", nil}

      channel == "in_app" ->
        {"skipped_no_user", nil}

      true ->
        {"skipped_no_user", nil}
    end
  end

  defp enqueue_sms(campaign, customer) do
    %{
      campaign_id: campaign.id,
      customer_id: customer.id,
      phone: customer.phone,
      message: campaign.message,
      title: campaign.title
    }
    |> Kaarobar.Workers.SmsCampaignWorker.new()
    |> Oban.insert()
  rescue
    _ -> {:error, :sms_enqueue_failed}
  end

  defp enqueue_whatsapp(campaign, customer) do
    %{
      campaign_id: campaign.id,
      customer_id: customer.id,
      phone: customer.phone,
      message: campaign.message,
      title: campaign.title
    }
    |> Kaarobar.Workers.WhatsappCampaignWorker.new()
    |> Oban.insert()
  rescue
    _ -> {:error, :whatsapp_enqueue_failed}
  end

  defp deliver_customer_email(customer, campaign) do
    email =
      Swoosh.Email.new()
      |> Swoosh.Email.to({customer.name || customer.email, customer.email})
      |> Swoosh.Email.from({"Kaarobar", "noreply@kaarobar.local"})
      |> Swoosh.Email.subject(campaign.title)
      |> Swoosh.Email.text_body(campaign.message)

    Mailer.deliver(email)
  rescue
    _ -> {:error, :email_failed}
  end

  defp parse_int(nil), do: nil
  defp parse_int(n) when is_integer(n), do: n

  defp parse_int(n) when is_binary(n) do
    case Integer.parse(n) do
      {i, _} -> i
      :error -> nil
    end
  end

  defp parse_decimal(nil), do: nil
  defp parse_decimal(%Decimal{} = d), do: d
  defp parse_decimal(n) when is_integer(n), do: Decimal.new(n)
  defp parse_decimal(n) when is_float(n), do: Decimal.from_float(n)

  defp parse_decimal(n) when is_binary(n) do
    case Decimal.parse(n) do
      {d, _} -> d
      :error -> nil
    end
  end

  def unit_cost(channel) do
    rates = Application.get_env(:kaarobar, :messaging_unit_costs, %{})
    raw = Map.get(rates, channel) || Map.get(rates, to_string(channel)) || "0"
    parse_decimal(raw) || Decimal.new("0")
  end

  def wallet_balance(business_id, owner_id) do
    case Repo.get_by(Business, id: business_id, owner_id: owner_id) do
      nil -> Decimal.new("0")
      biz -> biz.messaging_wallet_balance || Decimal.new("0")
    end
  end

  def top_up_wallet(business_id, owner_id, amount, note \\ nil) do
    amount = parse_decimal(amount)

    if is_nil(amount) or Decimal.compare(amount, Decimal.new("0")) != :gt do
      {:error, :invalid_amount}
    else
      Repo.transaction(fn ->
        biz = Repo.get_by!(Business, id: business_id, owner_id: owner_id)
        new_balance = Decimal.add(biz.messaging_wallet_balance || Decimal.new("0"), amount)

        biz
        |> Business.changeset(%{messaging_wallet_balance: new_balance})
        |> Repo.update!()

        %MessagingWalletLedger{}
        |> MessagingWalletLedger.changeset(%{
          business_id: business_id,
          owner_id: owner_id,
          amount: amount,
          kind: "top_up",
          note: note || "Manual top-up"
        })
        |> Repo.insert!()

        new_balance
      end)
    end
  end

  ## —— Message templates ————————————————————————————————

  def list_templates(business_id) do
    from(t in CrmMessageTemplate,
      where: t.business_id == ^business_id,
      order_by: [asc: t.name]
    )
    |> Repo.all()
  end

  def get_template(id, business_id) do
    Repo.get_by(CrmMessageTemplate, id: id, business_id: business_id)
  end

  def create_template(business_id, attrs) do
    %CrmMessageTemplate{}
    |> CrmMessageTemplate.changeset(
      Map.merge(stringify_keys(attrs), %{"business_id" => business_id})
    )
    |> Repo.insert()
  end

  def update_template(id, business_id, attrs) do
    case get_template(id, business_id) do
      nil -> {:error, :not_found}
      t -> t |> CrmMessageTemplate.changeset(stringify_keys(attrs)) |> Repo.update()
    end
  end

  def delete_template(id, business_id) do
    case get_template(id, business_id) do
      nil -> {:error, :not_found}
      t -> Repo.delete(t)
    end
  end

  def ensure_default_templates(business_id) do
    if list_templates(business_id) == [] do
      biz_vars = business_template_vars(business_id)

      defaults = [
        %{
          "name" => "Promo flash",
          "channel" => "email",
          "title_template" => "{{business}} special for you",
          "body_template" =>
            "Hi {{name}}, enjoy a limited offer from {{business}}. {{tagline}} Visit us soon!",
          "variables" => Map.merge(%{"name" => "Customer"}, biz_vars)
        },
        %{
          "name" => "Loyalty reminder",
          "channel" => "sms",
          "title_template" => "Your points",
          "body_template" =>
            "Hi {{name}}, you have {{points}} loyalty points at {{business}}. Redeem on your next visit!",
          "variables" => Map.merge(%{"name" => "Customer", "points" => "100"}, biz_vars)
        },
        %{
          "name" => "Khata reminder",
          "channel" => "whatsapp",
          "title_template" => "Balance reminder",
          "body_template" =>
            "Assalamualaikum {{name}}, a friendly reminder about your khata with {{business}}.",
          "variables" => Map.merge(%{"name" => "Customer"}, biz_vars)
        }
      ]

      Enum.each(defaults, &create_template(business_id, &1))
    end

    :ok
  end

  def business_template_vars(business_id) when is_binary(business_id) do
    case Repo.get(Business, business_id) do
      nil ->
        %{"business" => "Store", "tagline" => "", "description" => ""}

      b ->
        %{
          "business" => b.name || "Store",
          "tagline" => b.tagline || "",
          "description" => b.marketplace_description || ""
        }
    end
  end

  @doc """
  Canonical CRM template placeholders (CRM-FR-002).

  Flat `{{key}}` keys only — no nested `{{customer.name}}` syntax.
  `business` / `tagline` / `description` resolve from the tenant business at preview;
  `name` / `points` are sample customer fields for preview and stored defaults.
  """
  def list_template_variables(business_id) when is_binary(business_id) do
    live = business_template_vars(business_id)
    sample = %{"name" => "Ayesha", "points" => "120"}

    variables = [
      %{
        "key" => "business",
        "placeholder" => "{{business}}",
        "source" => "business",
        "example" => live["business"] || "Store"
      },
      %{
        "key" => "tagline",
        "placeholder" => "{{tagline}}",
        "source" => "business",
        "example" => live["tagline"] || ""
      },
      %{
        "key" => "description",
        "placeholder" => "{{description}}",
        "source" => "business",
        "example" => live["description"] || ""
      },
      %{
        "key" => "name",
        "placeholder" => "{{name}}",
        "source" => "customer_sample",
        "example" => sample["name"]
      },
      %{
        "key" => "points",
        "placeholder" => "{{points}}",
        "source" => "customer_sample",
        "example" => sample["points"]
      }
    ]

    %{
      variables: variables,
      sample_values: Map.merge(live, sample)
    }
  end

  def render_template(title_t, body_t, vars) when is_map(vars) do
    %{
      title: replace_vars(title_t || "", vars),
      message: replace_vars(body_t || "", vars)
    }
  end

  def render_template(title_t, body_t, vars, business_id) when is_map(vars) do
    merged = Map.merge(business_template_vars(business_id), stringify_keys(vars))
    render_template(title_t, body_t, merged)
  end

  defp replace_vars(text, vars) do
    Enum.reduce(vars, text, fn {k, v}, acc ->
      String.replace(acc, "{{#{k}}}", to_string(v || ""))
    end)
  end

  defp stringify_keys(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} -> {k, v}
    end)
  end
end
