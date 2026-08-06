defmodule Kaarobar.Schemas.PurchaseOrderItem do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "purchase_order_items" do
    field :quantity, :decimal
    field :unit_cost, :decimal

    belongs_to :purchase_order, Kaarobar.Schemas.PurchaseOrder
    belongs_to :product, Kaarobar.Schemas.Product

    timestamps(type: :utc_datetime)
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [:quantity, :unit_cost, :purchase_order_id, :product_id])
    |> validate_required([:quantity, :unit_cost, :purchase_order_id, :product_id])
    |> foreign_key_constraint(:purchase_order_id)
    |> foreign_key_constraint(:product_id)
  end
end
