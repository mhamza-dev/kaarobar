defmodule Kaarobar.Schemas.SaleReturnItem do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "sale_return_items" do
    field :quantity, :decimal
    field :amount, :decimal

    belongs_to :sale_return, Kaarobar.Schemas.SaleReturn
    belongs_to :sale_item, Kaarobar.Schemas.SaleItem
    belongs_to :product, Kaarobar.Schemas.Product

    timestamps(type: :utc_datetime)
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [:quantity, :amount, :sale_return_id, :sale_item_id, :product_id])
    |> validate_required([:quantity, :amount, :sale_return_id, :sale_item_id])
    |> foreign_key_constraint(:sale_return_id)
    |> foreign_key_constraint(:sale_item_id)
  end
end
