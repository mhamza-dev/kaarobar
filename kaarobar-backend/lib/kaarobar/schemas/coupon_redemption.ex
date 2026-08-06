defmodule Kaarobar.Schemas.CouponRedemption do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "coupon_redemptions" do
    field :discount_amount, :decimal

    belongs_to :coupon, Kaarobar.Schemas.Coupon
    belongs_to :sale, Kaarobar.Schemas.Sale
    belongs_to :customer, Kaarobar.Schemas.Customer
    belongs_to :campaign, Kaarobar.Schemas.CrmCampaign

    timestamps(type: :utc_datetime)
  end

  def changeset(redemption, attrs) do
    redemption
    |> cast(attrs, [:coupon_id, :sale_id, :customer_id, :campaign_id, :discount_amount])
    |> validate_required([:coupon_id, :sale_id, :discount_amount])
    |> foreign_key_constraint(:coupon_id)
    |> foreign_key_constraint(:sale_id)
    |> unique_constraint([:sale_id, :coupon_id])
  end
end
