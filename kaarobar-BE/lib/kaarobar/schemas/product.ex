defmodule Kaarobar.Schemas.Product do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "products" do
    field :sku, :string
    field :name, :string
    field :category, :string
    field :tax_rate, :decimal
    field :is_active, :boolean, default: true

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User

    has_many :product_branch_prices, Kaarobar.Schemas.ProductBranchPrice
    has_many :inventory_records, Kaarobar.Schemas.InventoryRecord

    timestamps(type: :utc_datetime)
  end

  def changeset(product, attrs) do
    product
    |> cast(attrs, [:sku, :name, :category, :tax_rate, :is_active, :business_id, :owner_id])
    |> validate_required([:sku, :name, :business_id, :owner_id])
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
    |> unique_constraint([:business_id, :sku])
  end
end
