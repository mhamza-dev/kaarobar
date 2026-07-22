defmodule Kaarobar.Schemas.CrmCampaign do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @audiences ~w(all khata min_points segment)
  @channels ~w(email in_app sms whatsapp)
  @statuses ~w(Draft Sent)

  schema "crm_campaigns" do
    field :name, :string
    field :title, :string
    field :message, :string
    field :audience, :string, default: "all"
    field :channel, :string, default: "email"
    field :min_points, :integer
    field :status, :string, default: "Draft"
    field :sent_at, :utc_datetime

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :created_by, Kaarobar.Schemas.User
    belongs_to :segment, Kaarobar.Schemas.CampaignSegment
    belongs_to :coupon, Kaarobar.Schemas.Coupon
    has_many :recipients, Kaarobar.Schemas.CrmCampaignRecipient, foreign_key: :campaign_id

    timestamps(type: :utc_datetime)
  end

  def audiences, do: @audiences
  def channels, do: @channels
  def statuses, do: @statuses

  def changeset(campaign, attrs) do
    campaign
    |> cast(attrs, [
      :name,
      :title,
      :message,
      :audience,
      :channel,
      :min_points,
      :status,
      :sent_at,
      :business_id,
      :owner_id,
      :created_by_id,
      :segment_id,
      :coupon_id
    ])
    |> validate_required([
      :name,
      :title,
      :message,
      :audience,
      :channel,
      :business_id,
      :owner_id,
      :created_by_id
    ])
    |> validate_inclusion(:audience, @audiences)
    |> validate_inclusion(:channel, @channels)
    |> validate_inclusion(:status, @statuses)
    |> validate_segment_audience()
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:created_by_id)
    |> foreign_key_constraint(:segment_id)
    |> foreign_key_constraint(:coupon_id)
  end

  defp validate_segment_audience(changeset) do
    audience = get_field(changeset, :audience)
    segment_id = get_field(changeset, :segment_id)

    cond do
      audience == "segment" and (is_nil(segment_id) or segment_id == "") ->
        add_error(changeset, :segment_id, "required when audience is segment")

      true ->
        changeset
    end
  end
end
