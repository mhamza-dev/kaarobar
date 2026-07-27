defmodule Kaarobar.CampaignPaymentTest do
  use Kaarobar.DataCase

  alias Kaarobar.{Accounts, Crm, Tenancy}
  alias Kaarobar.Schemas.{CampaignPayment, Customer}
  alias Kaarobar.Repo

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "owner-camp-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner"
      })

    {:ok, business} = Tenancy.create_business(owner.id, %{name: "Camp Co"})

    {:ok, customer} =
      %Customer{}
      |> Customer.changeset(%{
        name: "Buyer",
        phone: "03001234567",
        business_id: business.id,
        owner_id: owner.id,
        marketing_opt_in_sms: true
      })
      |> Repo.insert()

    {:ok, campaign} =
      Crm.create_campaign(business.id, owner.id, owner.id, %{
        "name" => "SMS blast",
        "title" => "SMS blast",
        "message" => "Hello from Kaarobar",
        "channel" => "sms",
        "audience" => "all"
      })

    %{owner: owner, business: business, campaign: campaign, customer: customer}
  end

  test "paid channel send requires payment", %{
    owner: owner,
    business: business,
    campaign: campaign
  } do
    assert {:error, :payment_required} =
             Crm.send_campaign(campaign.id, business.id, owner.id, owner.id)
  end

  test "checkout creates pending payment and confirm sends", %{
    owner: owner,
    business: business,
    campaign: campaign
  } do
    assert {:ok, %{payment: payment, checkout_url: url, amount: amount, dev_fallback: true}} =
             Crm.create_campaign_checkout(campaign.id, business.id, owner.id, owner.id)

    assert payment.status == "pending"
    assert Decimal.compare(Decimal.new(amount), Decimal.new("0")) == :gt
    assert is_binary(url)
    assert String.contains?(url, "confirm-payment")

    assert {:ok, sent} =
             Crm.confirm_dev_campaign_payment(
               campaign.id,
               payment.id,
               business.id,
               owner.id
             )

    assert sent.status == "Sent"
    paid = Repo.get!(CampaignPayment, payment.id)
    assert paid.status == "paid"
  end

  test "Safepay campaign webhook marks paid and sends", %{
    owner: owner,
    business: business,
    campaign: campaign
  } do
    assert {:ok, %{payment: payment}} =
             Crm.create_campaign_checkout(campaign.id, business.id, owner.id, owner.id)

    reference =
      Kaarobar.Billing.Safepay.encode_reference(%{
        "type" => "campaign_send",
        "campaign_id" => campaign.id,
        "business_id" => business.id,
        "owner_id" => owner.id,
        "payment_id" => payment.id,
        "actor_id" => owner.id
      })

    payload = %{
      "type" => "payment.completed",
      "data" => %{
        "token" => "trk_camp_1",
        "reference" => reference,
        "order_id" => reference,
        "status" => "COMPLETED"
      }
    }

    assert {:ok, %{handled: true}} =
             Kaarobar.Billing.handle_safepay_webhook(payload)

    paid = Repo.get!(CampaignPayment, payment.id)
    assert paid.status == "paid"
    assert paid.lemon_order_id == "trk_camp_1"

    updated = Crm.get_campaign(campaign.id, business.id, owner.id)
    assert updated.status == "Sent"
  end

  test "email channel sends without payment", %{owner: owner, business: business} do
    {:ok, email_c} =
      Crm.create_campaign(business.id, owner.id, owner.id, %{
        "name" => "Email",
        "title" => "Hi",
        "message" => "Body",
        "channel" => "email",
        "audience" => "all"
      })

    assert {:ok, sent} = Crm.send_campaign(email_c.id, business.id, owner.id, owner.id)
    assert sent.status == "Sent"
  end
end
