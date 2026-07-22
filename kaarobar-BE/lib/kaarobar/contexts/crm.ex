defmodule Kaarobar.Crm do
  @moduledoc """
  Marketing campaigns, segments, and consent-aware audience resolution.
  CRM-FR-001/002/009/012/016 — Phase A extends baseline campaigns.
  """

  import Ecto.Query

  alias Kaarobar.{Audit, Mailer, Notifications, Repo}
  alias Kaarobar.Schemas.{
    CampaignSegment,
    CrmCampaign,
    CrmCampaignRecipient,
    Customer,
    Sale
  }

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

  def list_campaigns(business_id, owner_id) do
    from(c in CrmCampaign,
      where: c.business_id == ^business_id and c.owner_id == ^owner_id,
      order_by: [desc: c.inserted_at],
      preload: [:recipients, :segment, :coupon]
    )
    |> Repo.all()
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

  ## CRM-FR-012 audience size preview
  def preview_audience(business_id, owner_id, attrs) do
    attrs = stringify_keys(attrs)

    fake = %CrmCampaign{
      business_id: business_id,
      owner_id: owner_id,
      audience: attrs["audience"] || "all",
      min_points: parse_int(attrs["min_points"]),
      segment_id: attrs["segment_id"],
      channel: attrs["channel"] || "email"
    }

    customers = resolve_audience(fake)
    %{count: length(customers)}
  end

  def send_campaign(campaign_id, business_id, owner_id, actor_id) do
    case get_campaign(campaign_id, business_id, owner_id) do
      nil ->
        {:error, :not_found}

      %{status: "Sent"} ->
        {:error, :already_sent}

      campaign ->
        customers = resolve_audience(campaign)
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        recipients =
          Enum.map(customers, fn customer ->
            {status, user_id} = deliver_to_customer(campaign, customer, owner_id)

            %{
              campaign_id: campaign.id,
              customer_id: customer.id,
              user_id: user_id,
              channel_status: status,
              delivered_at: if(status in ~w(notified email_only sms_queued whatsapp_queued), do: now, else: nil)
            }
          end)

        Repo.transaction(fn ->
          Enum.each(recipients, fn attrs ->
            %CrmCampaignRecipient{}
            |> CrmCampaignRecipient.changeset(attrs)
            |> Repo.insert!()
          end)

          {:ok, updated} =
            campaign
            |> CrmCampaign.changeset(%{status: "Sent", sent_at: now})
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
              notified: Enum.count(recipients, &(&1.channel_status == "notified")),
              email_only: Enum.count(recipients, &(&1.channel_status == "email_only")),
              skipped: Enum.count(recipients, &(&1.channel_status in ~w(skipped_no_user skipped_opt_out)))
            }
          })

          Repo.preload(updated, recipients: :customer)
        end)
        |> case do
          {:ok, updated} -> {:ok, updated}
          {:error, reason} -> {:error, reason}
        end
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
        "khata" ->
          from(c in q, where: c.khata_enabled == true)

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
      if Map.get(filters, "khata_enabled") == true or Map.get(filters, :khata_enabled) == true do
        from(c in q, where: c.khata_enabled == true)
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
            having:
              max(s.inserted_at) < ^cutoff or is_nil(max(s.inserted_at))
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

  defp stringify_keys(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} -> {k, v}
    end)
  end
end
