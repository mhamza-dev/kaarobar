defmodule Kaarobar.Schemas.ProductVariant do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "product_variants" do
    field :name, :string
    field :sku, :string
    field :barcode, :string
    field :price_override, :decimal
    field :is_active, :boolean, default: true
    field :sort_order, :integer, default: 0

    belongs_to :product, Kaarobar.Schemas.Product
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(variant, attrs) do
    variant
    |> cast(attrs, [
      :name,
      :sku,
      :barcode,
      :price_override,
      :is_active,
      :sort_order,
      :product_id,
      :business_id,
      :owner_id
    ])
    |> validate_required([:name, :product_id, :business_id, :owner_id])
    |> unique_constraint([:business_id, :barcode])
    |> foreign_key_constraint(:product_id)
  end
end
