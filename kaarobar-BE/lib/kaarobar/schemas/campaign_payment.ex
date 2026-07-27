defmodule Kaarobar.Schemas.CampaignPayment do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @statuses ~w(pending paid failed cancelled)

  schema "campaign_payments" do
    field :amount, :decimal
    field :currency, :string, default: "PKR"
    field :status, :string, default: "pending"
    field :lemon_order_id, :string
    field :lemon_checkout_id, :string
    field :checkout_url, :string
    field :paid_at, :utc_datetime

    belongs_to :campaign, Kaarobar.Schemas.CrmCampaign
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :actor, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(payment, attrs) do
    payment
    |> cast(attrs, [
      :amount,
      :currency,
      :status,
      :lemon_order_id,
      :lemon_checkout_id,
      :checkout_url,
      :paid_at,
      :campaign_id,
      :business_id,
      :owner_id,
      :actor_id
    ])
    |> validate_required([:amount, :status, :campaign_id, :business_id, :owner_id])
    |> validate_inclusion(:status, @statuses)
    |> foreign_key_constraint(:campaign_id)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
  end
end
