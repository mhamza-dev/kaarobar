defmodule Kaarobar.Schemas.ProductBatch do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "product_batches" do
    field :lot_number, :string
    field :expires_on, :date
    field :quantity_on_hand, :decimal, default: Decimal.new(0)
    field :cost, :decimal, default: Decimal.new(0)

    belongs_to :product, Kaarobar.Schemas.Product
    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(batch, attrs) do
    batch
    |> cast(attrs, [
      :lot_number,
      :expires_on,
      :quantity_on_hand,
      :cost,
      :product_id,
      :branch_id,
      :business_id,
      :owner_id
    ])
    |> validate_required([
      :lot_number,
      :quantity_on_hand,
      :product_id,
      :branch_id,
      :business_id,
      :owner_id
    ])
    |> unique_constraint([:branch_id, :product_id, :lot_number])
  end
end
