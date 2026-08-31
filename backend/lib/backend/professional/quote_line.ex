defmodule Kaarobar.Professional.QuoteLine do
  @moduledoc """
  One item on a quote.

  `description` is free text and `variant_id` optional, because half of
  professional work is described rather than picked from a list — "site survey
  and report, two days" is not a catalogue entry and never will be.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Money
  alias Kaarobar.Professional.Quote
  alias Kaarobar.Tenancy.Business

  schema "quote_lines" do
    field :description, :string
    field :quantity, :decimal, default: Decimal.new(1)
    field :unit_price, :decimal, default: Decimal.new(0)
    field :discount, :decimal, default: Decimal.new(0)
    field :line_total, :decimal, default: Decimal.new(0)
    field :position, :integer, default: 0

    belongs_to :business, Business
    belongs_to :quote, Quote
    belongs_to :variant, ProductVariant

    timestamps()
  end

  def changeset(line, attrs) do
    line
    |> cast(attrs, [
      :business_id,
      :quote_id,
      :variant_id,
      :description,
      :quantity,
      :unit_price,
      :discount,
      :position
    ])
    |> validate_required([:business_id, :description, :quantity])
    |> update_change(:description, &String.trim/1)
    |> validate_length(:description, min: 1, max: 300)
    |> validate_number(:quantity, greater_than: 0)
    |> validate_number(:unit_price, greater_than_or_equal_to: 0)
    |> validate_number(:discount, greater_than_or_equal_to: 0)
    |> put_line_total()
    |> foreign_key_constraint(:quote_id)
  end

  @doc "What this line comes to after its discount."
  @spec net(t()) :: Decimal.t()
  def net(%__MODULE__{} = line) do
    line.quantity
    |> Money.mult(line.unit_price)
    |> Money.sub(line.discount)
    |> Money.clamp_non_negative()
    |> Money.round()
  end

  defp put_line_total(changeset) do
    quantity = get_field(changeset, :quantity)
    price = get_field(changeset, :unit_price)
    discount = get_field(changeset, :discount) || Money.zero()

    if quantity && price do
      total =
        quantity
        |> Money.mult(price)
        |> Money.sub(discount)
        |> Money.clamp_non_negative()
        |> Money.round()

      put_change(changeset, :line_total, total)
    else
      changeset
    end
  end
end
