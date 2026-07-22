defmodule Kaarobar.Schemas.CrmCampaignRecipient do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @channel_statuses ~w(notified email_only skipped_no_user)

  schema "crm_campaign_recipients" do
    field :channel_status, :string, default: "skipped_no_user"
    field :delivered_at, :utc_datetime

    belongs_to :campaign, Kaarobar.Schemas.CrmCampaign
    belongs_to :customer, Kaarobar.Schemas.Customer
    belongs_to :user, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(recipient, attrs) do
    recipient
    |> cast(attrs, [
      :campaign_id,
      :customer_id,
      :user_id,
      :channel_status,
      :delivered_at
    ])
    |> validate_required([:campaign_id, :customer_id, :channel_status])
    |> validate_inclusion(:channel_status, @channel_statuses)
    |> foreign_key_constraint(:campaign_id)
    |> foreign_key_constraint(:customer_id)
    |> foreign_key_constraint(:user_id)
    |> unique_constraint([:campaign_id, :customer_id])
  end
end
