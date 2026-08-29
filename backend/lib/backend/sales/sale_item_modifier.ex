defmodule Kaarobar.Sales.SaleItemModifier do
  @moduledoc """
  An add-on chosen at the counter, frozen onto the sale line.

  "Extra cheese, 50" has to keep printing on the receipt even after the kitchen
  stops offering it, so the name and the price are copied rather than joined.
  """

  use Kaarobar.Schema

  alias Kaarobar.Sales.SaleItem

  schema "sale_item_modifiers" do
    field :modifier_id, Kaarobar.Ecto.UUIDv7
    field :name_snapshot, :string
    field :price_delta, :decimal, default: Decimal.new(0)

    belongs_to :sale_item, SaleItem

    timestamps(updated_at: false)
  end

  def changeset(modifier, attrs) do
    modifier
    |> cast(attrs, [:sale_item_id, :modifier_id, :name_snapshot, :price_delta])
    |> validate_required([:sale_item_id, :name_snapshot])
    |> foreign_key_constraint(:sale_item_id)
  end
end
