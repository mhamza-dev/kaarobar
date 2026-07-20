defmodule Kaarobar.Schemas.ProductCategory do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "product_categories" do
    field :name, :string
    field :slug, :string
    field :sort_order, :integer, default: 0
    field :is_active, :boolean, default: true

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    has_many :products, Kaarobar.Schemas.Product, foreign_key: :category_id

    timestamps(type: :utc_datetime)
  end

  def changeset(category, attrs) do
    category
    |> cast(attrs, [:name, :slug, :sort_order, :is_active, :business_id, :owner_id])
    |> validate_required([:name, :slug, :business_id, :owner_id])
    |> unique_constraint([:business_id, :slug])
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
  end
end
