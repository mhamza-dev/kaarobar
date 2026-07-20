defmodule Kaarobar.Schemas.ProductImage do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "product_images" do
    field :storage_key, :string
    field :content_type, :string
    field :byte_size, :integer
    field :is_primary, :boolean, default: false
    field :sort_order, :integer, default: 0

    belongs_to :product, Kaarobar.Schemas.Product
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(image, attrs) do
    image
    |> cast(attrs, [
      :storage_key,
      :content_type,
      :byte_size,
      :is_primary,
      :sort_order,
      :product_id,
      :business_id,
      :owner_id
    ])
    |> validate_required([:storage_key, :product_id, :business_id, :owner_id])
  end
end
