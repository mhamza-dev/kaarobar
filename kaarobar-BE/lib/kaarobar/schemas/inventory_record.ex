defmodule Kaarobar.Schemas.InventoryRecord do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "inventory_records" do
    field :quantity_on_hand, :decimal
    field :avg_cost, :decimal
    field :low_stock_notified_at, :utc_datetime

    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :product, Kaarobar.Schemas.Product
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business

    timestamps(type: :utc_datetime)
  end

  def changeset(record, attrs) do
    record
    |> cast(attrs, [
      :quantity_on_hand,
      :avg_cost,
      :low_stock_notified_at,
      :branch_id,
      :product_id,
      :owner_id,
      :business_id
    ])
    |> validate_required([:branch_id, :product_id, :owner_id, :business_id])
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:product_id)
    |> unique_constraint([:branch_id, :product_id])
  end
end
