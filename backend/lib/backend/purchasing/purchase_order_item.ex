defmodule Kaarobar.Purchasing.PurchaseOrderItem do
  @moduledoc """
  One line of a purchase order.

  `received_quantity` is the sum of the goods receipts booked against this
  line, maintained as they arrive. It is what makes a partially-delivered order
  stay open with the right amount outstanding, rather than being edited down
  and losing the record of what was originally ordered.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Catalog.Unit
  alias Kaarobar.Money
  alias Kaarobar.Purchasing.PurchaseOrder
  alias Kaarobar.Taxes.TaxGroup
  alias Kaarobar.Tenancy.Business

  schema "purchase_order_items" do
    field :description, :string
    field :supplier_sku, :string

    field :ordered_quantity, :decimal
    field :received_quantity, :decimal, default: Decimal.new(0)
    field :cancelled_quantity, :decimal, default: Decimal.new(0)

    field :unit_cost, :decimal
    field :discount_percent, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :line_total, :decimal, default: Decimal.new(0)

    field :position, :integer, default: 0
    field :note, :string

    belongs_to :business, Business
    belongs_to :purchase_order, PurchaseOrder
    belongs_to :variant, ProductVariant
    belongs_to :unit, Unit
    belongs_to :tax_group, TaxGroup

    timestamps()
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :business_id,
      :purchase_order_id,
      :variant_id,
      :description,
      :supplier_sku,
      :ordered_quantity,
      :unit_id,
      :unit_cost,
      :discount_percent,
      :tax_group_id,
      :position,
      :note
    ])
    |> validate_required([:business_id, :purchase_order_id, :variant_id, :ordered_quantity, :unit_cost])
    |> validate_number(:ordered_quantity, greater_than: 0)
    |> validate_number(:unit_cost, greater_than_or_equal_to: 0)
    |> validate_number(:discount_percent,
      greater_than_or_equal_to: 0,
      less_than_or_equal_to: 100
    )
    |> foreign_key_constraint(:variant_id)
    |> foreign_key_constraint(:purchase_order_id)
  end

  @doc "Changeset applying the computed line totals."
  def totals_changeset(item, tax_total, line_total) do
    change(item, tax_total: tax_total, line_total: line_total)
  end

  @doc "Changeset recording a further receipt against this line."
  def receive_changeset(item, quantity) do
    item
    |> change(received_quantity: Money.add(item.received_quantity, quantity))
    |> validate_not_over_received()
  end

  @doc "What is still to come on this line."
  @spec outstanding_quantity(t()) :: Decimal.t()
  def outstanding_quantity(%__MODULE__{} = item) do
    item.ordered_quantity
    |> Money.sub(item.received_quantity)
    |> Money.sub(item.cancelled_quantity)
    |> Money.clamp_non_negative()
  end

  @doc "True when nothing further is expected on this line."
  @spec fully_received?(t()) :: boolean()
  def fully_received?(%__MODULE__{} = item), do: Money.zero?(outstanding_quantity(item))

  @doc "The line net of its discount, before tax."
  @spec net_amount(t()) :: Decimal.t()
  def net_amount(%__MODULE__{} = item) do
    gross = Money.mult(item.ordered_quantity, item.unit_cost)

    Money.sub(gross, Money.percent_of(gross, item.discount_percent))
  end

  # Receiving more than was ordered is a delivery error worth catching, not
  # something to absorb silently into stock.
  defp validate_not_over_received(changeset) do
    ordered = get_field(changeset, :ordered_quantity)
    received = get_field(changeset, :received_quantity)

    if ordered && received && Decimal.compare(received, ordered) == :gt do
      add_error(changeset, :received_quantity, "would exceed the quantity ordered")
    else
      changeset
    end
  end
end
