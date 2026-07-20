defmodule Kaarobar.Schemas.ProductBranchPrice do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "product_branch_prices" do
    field :price, :decimal

    belongs_to :product, Kaarobar.Schemas.Product
    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business

    timestamps(type: :utc_datetime)
  end

  def changeset(price, attrs) do
    price
    |> cast(attrs, [:price, :product_id, :branch_id, :owner_id, :business_id])
    |> validate_required([:price, :product_id, :branch_id, :owner_id, :business_id])
    |> foreign_key_constraint(:product_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint([:product_id, :branch_id])
  end
end
