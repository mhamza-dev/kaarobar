defmodule Kaarobar.Pricing.PriceListItem do
  @moduledoc """
  One variant's price on one list, optionally from a minimum quantity.

  `min_quantity` gives quantity breaks: 100 each, or 85 each from a dozen. A
  variant may have several rows on the same list, one per break, and resolution
  takes the highest break the line qualifies for.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Pricing.PriceList

  schema "price_list_items" do
    field :price, :decimal
    field :min_quantity, :decimal, default: Decimal.new(1)

    belongs_to :price_list, PriceList
    belongs_to :variant, ProductVariant

    timestamps()
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [:price_list_id, :variant_id, :price, :min_quantity])
    |> validate_required([:price_list_id, :variant_id, :price])
    |> validate_number(:price, greater_than_or_equal_to: 0)
    |> validate_number(:min_quantity, greater_than: 0)
    |> foreign_key_constraint(:price_list_id)
    |> foreign_key_constraint(:variant_id)
    |> unique_constraint(:min_quantity, name: :price_list_items_price_list_id_variant_id_min_quantity_index,
      message: "already has a price at this quantity"
    )
  end

  @doc """
  Picks the best-qualifying break from a variant's items on one list.

  The highest `min_quantity` that the line reaches, so a customer buying twelve
  gets the dozen price rather than the single price that also technically
  matches.
  """
  @spec best_for_quantity([t()], Decimal.t()) :: t() | nil
  def best_for_quantity(items, %Decimal{} = quantity) do
    items
    |> Enum.filter(&(Decimal.compare(quantity, &1.min_quantity) != :lt))
    |> Enum.max_by(& &1.min_quantity, Decimal, fn -> nil end)
  end
end
