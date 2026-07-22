defmodule Kaarobar.Schemas.LoyaltyTier do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "loyalty_tiers" do
    field :name, :string
    field :min_points, :integer, default: 0
    field :earn_rate, :decimal, default: Decimal.new("1")
    field :redeem_rate, :decimal, default: Decimal.new("1")

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(tier, attrs) do
    tier
    |> cast(attrs, [
      :name,
      :min_points,
      :earn_rate,
      :redeem_rate,
      :business_id,
      :owner_id
    ])
    |> validate_required([:name, :min_points, :business_id, :owner_id])
    |> validate_number(:min_points, greater_than_or_equal_to: 0)
    |> validate_number(:earn_rate, greater_than: 0)
    |> validate_number(:redeem_rate, greater_than: 0)
    |> foreign_key_constraint(:business_id)
    |> unique_constraint([:business_id, :name])
    |> unique_constraint([:business_id, :min_points])
  end
end
