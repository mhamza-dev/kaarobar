defmodule Kaarobar.Schemas.SaleItem do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "sale_items" do
    field :sku, :string
    field :name, :string
    field :quantity, :decimal
    field :unit_price, :decimal
    field :discount, :decimal
    field :tax_rate, :decimal
    field :line_total, :decimal
    field :modifiers, :map, default: %{}
    field :notes, :string

    belongs_to :sale, Kaarobar.Schemas.Sale
    belongs_to :product, Kaarobar.Schemas.Product
    belongs_to :product_variant, Kaarobar.Schemas.ProductVariant

    timestamps(type: :utc_datetime)
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :sku,
      :name,
      :quantity,
      :unit_price,
      :discount,
      :tax_rate,
      :line_total,
      :sale_id,
      :product_id,
      :product_variant_id,
      :modifiers,
      :notes
    ])
    |> validate_required([:sku, :name, :quantity, :unit_price, :line_total, :sale_id])
    |> foreign_key_constraint(:sale_id)
  end
end
