defmodule Kaarobar.Schemas.SubscriptionPlan do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "subscription_plans" do
    field :code, :string
    field :name, :string
    field :max_businesses, :integer, default: 1
    field :max_branches, :integer, default: 1
    field :max_users, :integer, default: 3
    field :lemon_variant_id, :string
    field :safepay_plan_id, :string
    field :price_display, :string
    field :price_pkr, :integer
    field :billing_period, :string
    field :tagline, :string
    field :features, {:array, :string}, default: []
    field :entitled_bundles, {:array, :string}, default: []
    field :sort_order, :integer, default: 0
    field :is_active, :boolean, default: true

    timestamps(type: :utc_datetime)
  end

  def changeset(plan, attrs) do
    plan
    |> cast(attrs, [
      :code,
      :name,
      :max_businesses,
      :max_branches,
      :max_users,
      :lemon_variant_id,
      :safepay_plan_id,
      :price_display,
      :price_pkr,
      :billing_period,
      :tagline,
      :features,
      :entitled_bundles,
      :sort_order,
      :is_active
    ])
    |> validate_required([:code, :name])
    |> unique_constraint(:code)
  end
end
