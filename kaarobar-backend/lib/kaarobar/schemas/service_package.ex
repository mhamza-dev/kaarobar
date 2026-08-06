defmodule Kaarobar.Schemas.ServicePackage do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "service_packages" do
    field :name, :string
    field :session_count, :integer
    field :price, :decimal
    field :is_active, :boolean, default: true

    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :product, Kaarobar.Schemas.Product

    timestamps(type: :utc_datetime)
  end

  def changeset(pkg, attrs) do
    pkg
    |> cast(attrs, [
      :name,
      :session_count,
      :price,
      :is_active,
      :owner_id,
      :business_id,
      :product_id
    ])
    |> validate_required([
      :name,
      :session_count,
      :price,
      :owner_id,
      :business_id,
      :product_id
    ])
    |> validate_number(:session_count, greater_than: 0)
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:product_id)
  end
end
