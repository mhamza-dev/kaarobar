defmodule Kaarobar.Schemas.ProductModifierGroup do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "product_modifier_groups" do
    belongs_to :product, Kaarobar.Schemas.Product
    belongs_to :modifier_group, Kaarobar.Schemas.ModifierGroup

    timestamps(type: :utc_datetime)
  end

  def changeset(join, attrs) do
    join
    |> cast(attrs, [:product_id, :modifier_group_id])
    |> validate_required([:product_id, :modifier_group_id])
    |> unique_constraint([:product_id, :modifier_group_id])
  end
end
