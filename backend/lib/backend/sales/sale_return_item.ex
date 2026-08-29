defmodule Kaarobar.Sales.SaleReturnItem do
  @moduledoc """
  One line coming back.

  The figures are prorated from the sale line rather than recomputed. Returning
  three of five brings back three fifths of that line's tax and cost, whatever
  promotions applied at the time — recomputing at today's prices would refund
  an amount the customer never paid.

  `restock` decides where the goods go. A faulty item is written off instead of
  shelved, so the count stays true and the loss stays visible rather than being
  quietly absorbed into shrinkage.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Sales.SaleItem
  alias Kaarobar.Sales.SaleReturn
  alias Kaarobar.Tenancy.Business

  schema "sale_return_items" do
    field :name_snapshot, :string
    field :quantity, :decimal
    field :unit_price, :decimal
    field :tax_total, :decimal, default: Decimal.new(0)
    field :line_total, :decimal, default: Decimal.new(0)
    field :cost_snapshot, :decimal, default: Decimal.new(0)

    field :restock, :boolean, default: true
    field :reason, :string
    field :position, :integer, default: 0

    belongs_to :business, Business
    belongs_to :sale_return, SaleReturn
    belongs_to :sale_item, SaleItem
    belongs_to :variant, ProductVariant
    belongs_to :batch, Batch

    timestamps()
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :business_id,
      :sale_return_id,
      :sale_item_id,
      :variant_id,
      :batch_id,
      :name_snapshot,
      :quantity,
      :unit_price,
      :tax_total,
      :line_total,
      :cost_snapshot,
      :restock,
      :reason,
      :position
    ])
    |> validate_required([
      :business_id,
      :sale_item_id,
      :variant_id,
      :name_snapshot,
      :quantity,
      :unit_price
    ])
    |> validate_number(:quantity, greater_than: 0)
    |> foreign_key_constraint(:sale_item_id)
    |> foreign_key_constraint(:variant_id)
  end

  @doc "True when these goods go back on the shelf."
  @spec restocked?(t()) :: boolean()
  def restocked?(%__MODULE__{restock: restock}), do: restock
end
