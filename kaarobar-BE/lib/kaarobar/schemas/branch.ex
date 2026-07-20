defmodule Kaarobar.Schemas.Branch do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "branches" do
    field :name, :string
    field :address, :map
    field :timezone, :string, default: "Asia/Karachi"
    field :is_active, :boolean, default: true
    field :refund_auto_approve_limit, :decimal
    field :discount_auto_approve_limit, :decimal
    field :return_window_days, :integer, default: 14

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(branch, attrs) do
    branch
    |> cast(attrs, [
      :name,
      :address,
      :timezone,
      :is_active,
      :refund_auto_approve_limit,
      :discount_auto_approve_limit,
      :return_window_days,
      :business_id,
      :owner_id
    ])
    |> validate_required([:name, :business_id, :owner_id])
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
  end
end
