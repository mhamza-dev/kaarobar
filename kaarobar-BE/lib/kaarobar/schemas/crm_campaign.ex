defmodule Kaarobar.Schemas.CrmCampaign do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @audiences ~w(all khata min_points)
  @statuses ~w(Draft Sent)

  schema "crm_campaigns" do
    field :name, :string
    field :title, :string
    field :message, :string
    field :audience, :string, default: "all"
    field :min_points, :integer
    field :status, :string, default: "Draft"
    field :sent_at, :utc_datetime

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :created_by, Kaarobar.Schemas.User
    has_many :recipients, Kaarobar.Schemas.CrmCampaignRecipient, foreign_key: :campaign_id

    timestamps(type: :utc_datetime)
  end

  def audiences, do: @audiences
  def statuses, do: @statuses

  def changeset(campaign, attrs) do
    campaign
    |> cast(attrs, [
      :name,
      :title,
      :message,
      :audience,
      :min_points,
      :status,
      :sent_at,
      :business_id,
      :owner_id,
      :created_by_id
    ])
    |> validate_required([:name, :title, :message, :audience, :business_id, :owner_id, :created_by_id])
    |> validate_inclusion(:audience, @audiences)
    |> validate_inclusion(:status, @statuses)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:created_by_id)
  end
end
