defmodule Kaarobar.Schemas.StockTransferItem do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "stock_transfer_items" do
    field :quantity, :decimal

    belongs_to :stock_transfer, Kaarobar.Schemas.StockTransfer
    belongs_to :product, Kaarobar.Schemas.Product

    timestamps(type: :utc_datetime)
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [:quantity, :stock_transfer_id, :product_id])
    |> validate_required([:quantity, :stock_transfer_id, :product_id])
    |> foreign_key_constraint(:stock_transfer_id)
    |> foreign_key_constraint(:product_id)
  end
end
