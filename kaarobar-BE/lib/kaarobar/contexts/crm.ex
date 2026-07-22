defmodule Kaarobar.Crm do
  @moduledoc """
  Marketing campaigns: draft, audience resolve, send with customer notifications.
  """

  import Ecto.Query

  alias Kaarobar.{Audit, Mailer, Notifications, Repo}
  alias Kaarobar.Schemas.{CrmCampaign, CrmCampaignRecipient, Customer}

  def list_campaigns(business_id, owner_id) do
    from(c in CrmCampaign,
      where: c.business_id == ^business_id and c.owner_id == ^owner_id,
      order_by: [desc: c.inserted_at],
      preload: [:recipients]
    )
    |> Repo.all()
  end

  def get_campaign(id, business_id, owner_id) do
    from(c in CrmCampaign,
      where: c.id == ^id and c.business_id == ^business_id and c.owner_id == ^owner_id,
      preload: [recipients: :customer]
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
              delivered_at: if(status in ["notified", "email_only"], do: now, else: nil)
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
              notified: Enum.count(recipients, &(&1.channel_status == "notified")),
              email_only: Enum.count(recipients, &(&1.channel_status == "email_only")),
              skipped: Enum.count(recipients, &(&1.channel_status == "skipped_no_user"))
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

        _ ->
          q
      end

    Repo.all(q)
  end

  defp deliver_to_customer(campaign, customer, owner_id) do
    cond do
      is_binary(customer.user_id) ->
        Notifications.notify(
          customer.user_id,
          owner_id,
          "crm.campaign",
          %{
            campaign_id: campaign.id,
            message: campaign.message,
            title: campaign.title
          },
          title: campaign.title,
          body: campaign.message
        )

        {"notified", customer.user_id}

      is_binary(customer.email) and customer.email != "" ->
        _ = deliver_customer_email(customer, campaign)
        {"email_only", nil}

      true ->
        {"skipped_no_user", nil}
    end
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

  defp stringify_keys(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} -> {k, v}
    end)
  end
end
