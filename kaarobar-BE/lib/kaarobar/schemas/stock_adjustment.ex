defmodule Kaarobar.Schemas.StockAdjustment do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "stock_adjustments" do
    field :quantity_delta, :decimal
    field :reason_code, :string
    field :notes, :string

    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :product, Kaarobar.Schemas.Product
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :adjusted_by, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(adjustment, attrs) do
    adjustment
    |> cast(attrs, [:quantity_delta, :reason_code, :notes, :branch_id, :product_id, :owner_id, :business_id, :adjusted_by_id])
    |> validate_required([:quantity_delta, :reason_code, :branch_id, :product_id, :owner_id, :business_id, :adjusted_by_id])
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:product_id)
    |> foreign_key_constraint(:adjusted_by_id)
  end
end
