defmodule Kaarobar.Purchasing.SupplierBillItem do
  @moduledoc """
  One line of a supplier invoice.

  `variant_id` is nullable: a bill line is often freight, a pallet charge or a
  late fee rather than a product, and forcing those onto a fake product would
  put them into stock reporting.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Money
  alias Kaarobar.Purchasing.SupplierBill
  alias Kaarobar.Tenancy.Business

  schema "supplier_bill_items" do
    field :description, :string
    field :quantity, :decimal, default: Decimal.new(1)
    field :unit_cost, :decimal
    field :tax_total, :decimal, default: Decimal.new(0)
    field :line_total, :decimal, default: Decimal.new(0)
    field :position, :integer, default: 0

    belongs_to :business, Business
    belongs_to :supplier_bill, SupplierBill
    belongs_to :variant, ProductVariant

    timestamps()
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :business_id,
      :supplier_bill_id,
      :variant_id,
      :description,
      :quantity,
      :unit_cost,
      :tax_total,
      :position
    ])
    |> validate_required([:business_id, :supplier_bill_id, :description, :quantity, :unit_cost])
    |> validate_length(:description, min: 1, max: 300)
    |> validate_number(:quantity, greater_than: 0)
    |> validate_number(:unit_cost, greater_than_or_equal_to: 0)
    |> put_line_total()
    |> foreign_key_constraint(:supplier_bill_id)
  end

  @doc "The line before tax."
  @spec net_amount(t()) :: Decimal.t()
  def net_amount(%__MODULE__{quantity: quantity, unit_cost: cost}), do: Money.mult(quantity, cost)

  defp put_line_total(changeset) do
    quantity = get_field(changeset, :quantity)
    cost = get_field(changeset, :unit_cost)
    tax = get_field(changeset, :tax_total) || Money.zero()

    if quantity && cost do
      put_change(changeset, :line_total, Money.add(Money.mult(quantity, cost), tax))
    else
      changeset
    end
  end
end
