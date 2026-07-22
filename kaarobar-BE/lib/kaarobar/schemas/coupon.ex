defmodule Kaarobar.Schemas.Coupon do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @discount_types ~w(percent fixed)

  schema "coupons" do
    field :code, :string
    field :discount_type, :string
    field :discount_value, :decimal
    field :valid_from, :utc_datetime
    field :valid_to, :utc_datetime
    field :usage_limit, :integer
    field :usage_count, :integer, default: 0
    field :min_cart, :decimal
    field :stackable, :boolean, default: false
    field :active, :boolean, default: true

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :campaign, Kaarobar.Schemas.CrmCampaign
    has_many :redemptions, Kaarobar.Schemas.CouponRedemption

    timestamps(type: :utc_datetime)
  end

  def discount_types, do: @discount_types

  def changeset(coupon, attrs) do
    coupon
    |> cast(attrs, [
      :code,
      :discount_type,
      :discount_value,
      :valid_from,
      :valid_to,
      :usage_limit,
      :usage_count,
      :min_cart,
      :stackable,
      :active,
      :business_id,
      :owner_id,
      :campaign_id
    ])
    |> update_change(:code, &normalize_code/1)
    |> validate_required([:code, :discount_type, :discount_value, :business_id, :owner_id])
    |> validate_inclusion(:discount_type, @discount_types)
    |> validate_number(:discount_value, greater_than: 0)
    |> validate_number(:usage_limit, greater_than: 0)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:campaign_id)
    |> unique_constraint([:business_id, :code])
  end

  defp normalize_code(nil), do: nil
  defp normalize_code(code) when is_binary(code), do: code |> String.trim() |> String.upcase()
  defp normalize_code(code), do: code
end
