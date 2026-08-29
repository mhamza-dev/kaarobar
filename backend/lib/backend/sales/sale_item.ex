defmodule Kaarobar.Sales.SaleItem do
  @moduledoc """
  One line of a sale, with everything about it frozen at the moment of sale.

  The name, the SKU, the unit, the price, the taxes and the cost are all copied
  here rather than joined at read time. A receipt reprinted in two years has to
  show what was actually charged, and by then the product may have been
  renamed, repriced, retaxed or deleted entirely.

  `cost_snapshot` is what makes margin reporting mean anything. Joining to
  today's cost would restate last year's profit every time a supplier changed a
  price.

  `applied_rule_ids` records which promotions hit this line, so a receipt can
  name them and a report can measure what each one actually cost the shop.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.Product
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Inventory.SerialNumber
  alias Kaarobar.Money
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Sales.SaleItemModifier
  alias Kaarobar.Sales.SaleItemTax
  alias Kaarobar.Tenancy.Business

  schema "sale_items" do
    field :name_snapshot, :string
    field :sku_snapshot, :string
    field :unit_snapshot, :string

    field :quantity, :decimal
    field :refunded_quantity, :decimal, default: Decimal.new(0)

    field :list_price, :decimal
    field :unit_price, :decimal
    field :discount_total, :decimal, default: Decimal.new(0)
    field :modifier_total, :decimal, default: Decimal.new(0)

    field :net_total, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :line_total, :decimal, default: Decimal.new(0)
    field :cost_snapshot, :decimal, default: Decimal.new(0)

    field :applied_rule_ids, {:array, Kaarobar.Ecto.UUIDv7}, default: []

    field :seat_number, :integer
    field :position, :integer, default: 0
    field :note, :string

    belongs_to :business, Business
    belongs_to :sale, Sale
    belongs_to :variant, ProductVariant
    belongs_to :product, Product
    belongs_to :batch, Batch
    belongs_to :serial, SerialNumber

    has_many :taxes, SaleItemTax, preload_order: [asc: :position]
    has_many :modifiers, SaleItemModifier

    timestamps()
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :business_id,
      :sale_id,
      :variant_id,
      :product_id,
      :name_snapshot,
      :sku_snapshot,
      :unit_snapshot,
      :quantity,
      :list_price,
      :unit_price,
      :discount_total,
      :modifier_total,
      :net_total,
      :tax_total,
      :line_total,
      :cost_snapshot,
      :applied_rule_ids,
      :batch_id,
      :serial_id,
      :seat_number,
      :position,
      :note
    ])
    |> validate_required([
      :business_id,
      :sale_id,
      :variant_id,
      :name_snapshot,
      :quantity,
      :list_price,
      :unit_price
    ])
    |> validate_number(:quantity, greater_than: 0)
    |> validate_number(:unit_price, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:variant_id)
    |> foreign_key_constraint(:sale_id)
  end

  @doc "Changeset recording a further refund against this line."
  def refund_changeset(item, quantity) do
    item
    |> change(refunded_quantity: Money.add(item.refunded_quantity, quantity))
    |> validate_not_over_refunded()
  end

  @doc "How much of this line may still be returned."
  @spec refundable_quantity(t()) :: Decimal.t()
  def refundable_quantity(%__MODULE__{quantity: quantity, refunded_quantity: refunded}),
    do: quantity |> Money.sub(refunded) |> Money.clamp_non_negative()

  @doc "True when part of this line has already come back."
  @spec partially_refunded?(t()) :: boolean()
  def partially_refunded?(%__MODULE__{refunded_quantity: refunded}), do: Money.positive?(refunded)

  @doc "The margin on this line."
  @spec margin(t()) :: Decimal.t()
  def margin(%__MODULE__{net_total: net, cost_snapshot: cost}), do: Money.sub(net, cost)

  @doc """
  The share of this line's value being returned.

  Returning three of five means three fifths of the line's tax and cost come
  back too. Prorating rather than recomputing keeps a partial return consistent
  with the sale it came from, whatever promotions applied at the time.
  """
  @spec proportion_of(t(), Decimal.t()) :: Decimal.t()
  def proportion_of(%__MODULE__{quantity: quantity}, returned_quantity) do
    if Money.positive?(quantity), do: Money.div(returned_quantity, quantity), else: Money.zero()
  end

  defp validate_not_over_refunded(changeset) do
    quantity = get_field(changeset, :quantity)
    refunded = get_field(changeset, :refunded_quantity)

    if quantity && refunded && Decimal.compare(refunded, quantity) == :gt do
      add_error(changeset, :refunded_quantity, "would exceed the quantity sold")
    else
      changeset
    end
  end
end
