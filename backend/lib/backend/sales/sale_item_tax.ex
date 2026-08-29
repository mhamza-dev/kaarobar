defmodule Kaarobar.Sales.SaleItemTax do
  @moduledoc """
  One tax component charged on one line, with the rate that applied.

  `tax_id` is deliberately not a foreign key. A rate may be retired when the
  law changes, and this row has to keep meaning what it meant — an invoice from
  2026 shows 2026's rate whatever happens to the tax table afterwards.
  """

  use Kaarobar.Schema

  alias Kaarobar.Sales.SaleItem

  schema "sale_item_taxes" do
    field :tax_id, Kaarobar.Ecto.UUIDv7
    field :name_snapshot, :string
    field :label_snapshot, :string
    field :rate_snapshot, :decimal
    field :is_compound, :boolean, default: false
    field :amount, :decimal
    field :position, :integer, default: 0

    belongs_to :sale_item, SaleItem

    timestamps(updated_at: false)
  end

  def changeset(tax_line, attrs) do
    tax_line
    |> cast(attrs, [
      :sale_item_id,
      :tax_id,
      :name_snapshot,
      :label_snapshot,
      :rate_snapshot,
      :is_compound,
      :amount,
      :position
    ])
    |> validate_required([:sale_item_id, :name_snapshot, :rate_snapshot, :amount])
    |> foreign_key_constraint(:sale_item_id)
  end
end
