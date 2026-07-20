defmodule Kaarobar.Schemas.Subscription do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "subscriptions" do
    field :plan, :string, default: "trial"
    field :status, :string, default: "active"
    field :lemon_squeezy_id, :string
    field :trial_ends_at, :utc_datetime
    field :current_period_end, :utc_datetime
    field :max_businesses, :integer, default: 1
    field :max_branches, :integer, default: 1
    field :max_users, :integer, default: 3

    belongs_to :owner, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(subscription, attrs) do
    subscription
    |> cast(attrs, [:plan, :status, :lemon_squeezy_id, :trial_ends_at, :current_period_end, :max_businesses, :max_branches, :max_users, :owner_id])
    |> validate_required([:owner_id])
    |> foreign_key_constraint(:owner_id)
    |> unique_constraint(:owner_id)
  end
end
