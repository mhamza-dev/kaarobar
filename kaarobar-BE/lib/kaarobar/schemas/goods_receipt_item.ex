defmodule Kaarobar.Schemas.GoodsReceiptItem do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "goods_receipt_items" do
    field :quantity_received, :decimal

    belongs_to :goods_receipt, Kaarobar.Schemas.GoodsReceipt
    belongs_to :product, Kaarobar.Schemas.Product

    timestamps(type: :utc_datetime)
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [:quantity_received, :goods_receipt_id, :product_id])
    |> validate_required([:quantity_received, :goods_receipt_id, :product_id])
    |> foreign_key_constraint(:goods_receipt_id)
    |> foreign_key_constraint(:product_id)
  end
end
