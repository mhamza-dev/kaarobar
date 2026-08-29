defmodule Kaarobar.Purchasing.PurchaseReturnItem do
  @moduledoc """
  One line of goods going back to a supplier.

  `batch_id` matters here more than almost anywhere: a return is usually a
  recall or a spoilage claim, and both are about a specific lot rather than a
  quantity of a product.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Money
  alias Kaarobar.Purchasing.PurchaseReturn
  alias Kaarobar.Tenancy.Business

  schema "purchase_return_items" do
    field :quantity, :decimal
    field :unit_cost, :decimal
    field :line_total, :decimal, default: Decimal.new(0)
    field :position, :integer, default: 0
    field :note, :string

    belongs_to :business, Business
    belongs_to :purchase_return, PurchaseReturn
    belongs_to :variant, ProductVariant
    belongs_to :batch, Batch

    timestamps()
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :business_id,
      :purchase_return_id,
      :variant_id,
      :batch_id,
      :quantity,
      :unit_cost,
      :position,
      :note
    ])
    |> validate_required([:business_id, :purchase_return_id, :variant_id, :quantity, :unit_cost])
    |> validate_number(:quantity, greater_than: 0)
    |> validate_number(:unit_cost, greater_than_or_equal_to: 0)
    |> put_line_total()
    |> foreign_key_constraint(:variant_id)
    |> foreign_key_constraint(:purchase_return_id)
  end

  @doc "What is being credited for this line."
  @spec net_amount(t()) :: Decimal.t()
  def net_amount(%__MODULE__{quantity: quantity, unit_cost: cost}), do: Money.mult(quantity, cost)

  defp put_line_total(changeset) do
    quantity = get_field(changeset, :quantity)
    cost = get_field(changeset, :unit_cost)

    if quantity && cost do
      put_change(changeset, :line_total, Money.mult(quantity, cost))
    else
      changeset
    end
  end
end
