defmodule Kaarobar.Schemas.Customer do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "customers" do
    field :name, :string
    field :phone, :string
    field :email, :string
    field :loyalty_points, :integer, default: 0
    field :khata_enabled, :boolean, default: false

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(customer, attrs) do
    customer
    |> cast(attrs, [
      :name,
      :phone,
      :email,
      :loyalty_points,
      :khata_enabled,
      :business_id,
      :owner_id
    ])
    |> validate_required([:name, :business_id, :owner_id])
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
  end
end
