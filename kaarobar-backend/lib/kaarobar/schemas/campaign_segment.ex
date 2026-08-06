defmodule Kaarobar.Schemas.CampaignSegment do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "campaign_segments" do
    field :name, :string
    field :filters, :map, default: %{}

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    has_many :campaigns, Kaarobar.Schemas.CrmCampaign, foreign_key: :segment_id

    timestamps(type: :utc_datetime)
  end

  def changeset(segment, attrs) do
    segment
    |> cast(attrs, [:name, :filters, :business_id, :owner_id])
    |> validate_required([:name, :business_id, :owner_id])
    |> validate_length(:name, min: 1, max: 120)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
    |> unique_constraint([:business_id, :name])
  end
end
