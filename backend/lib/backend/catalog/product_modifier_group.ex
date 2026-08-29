defmodule Kaarobar.Catalog.ProductModifierGroup do
  @moduledoc """
  Attaches a modifier group to a product.

  `is_required` lives here rather than on the group because the same group is
  optional on one product and mandatory on another: sauce is a choice on a
  burger and a required pick on a plate of fries.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ModifierGroup
  alias Kaarobar.Catalog.Product

  schema "product_modifier_groups" do
    field :is_required, :boolean, default: false
    field :position, :integer, default: 0

    belongs_to :product, Product
    belongs_to :modifier_group, ModifierGroup

    timestamps(updated_at: false)
  end

  def changeset(attachment, attrs) do
    attachment
    |> cast(attrs, [:product_id, :modifier_group_id, :is_required, :position])
    |> validate_required([:product_id, :modifier_group_id])
    |> foreign_key_constraint(:product_id)
    |> foreign_key_constraint(:modifier_group_id)
    |> unique_constraint([:product_id, :modifier_group_id],
      message: "is already attached to this product"
    )
  end
end
