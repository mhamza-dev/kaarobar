defmodule Kaarobar.Purchasing.SupplierProduct do
  @moduledoc """
  What one supplier charges for one variant, and under what conditions.

  The same tin has a different code and a different price from each supplier.
  Holding that here is what makes "who is cheapest for this" answerable, and
  what puts the codes the supplier actually recognises onto a purchase order.

  `lead_time_days` and `minimum_order_quantity` are what turn a low-stock alert
  into an actionable one. Suggesting three units from a supplier with a fifty
  unit minimum and a three-week lead time is not advice anyone can act on.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Money
  alias Kaarobar.Purchasing.Supplier
  alias Kaarobar.Tenancy.Business

  schema "supplier_products" do
    field :supplier_sku, :string
    field :supplier_name, :string
    field :unit_cost, :decimal
    field :currency, :string
    field :minimum_order_quantity, :decimal
    field :pack_size, :decimal
    field :lead_time_days, :integer
    field :is_preferred, :boolean, default: false
    field :last_purchased_at, :utc_datetime_usec
    field :is_active, :boolean, default: true

    belongs_to :business, Business
    belongs_to :supplier, Supplier
    belongs_to :variant, ProductVariant

    timestamps()
  end

  def changeset(supplier_product, attrs) do
    supplier_product
    |> cast(attrs, [
      :business_id,
      :supplier_id,
      :variant_id,
      :supplier_sku,
      :supplier_name,
      :unit_cost,
      :currency,
      :minimum_order_quantity,
      :pack_size,
      :lead_time_days,
      :is_preferred,
      :is_active
    ])
    |> validate_required([:business_id, :supplier_id, :variant_id, :unit_cost])
    |> validate_number(:unit_cost, greater_than_or_equal_to: 0)
    |> validate_number(:minimum_order_quantity, greater_than: 0)
    |> validate_number(:pack_size, greater_than: 0)
    |> validate_number(:lead_time_days, greater_than_or_equal_to: 0, less_than: 366)
    |> validate_length(:supplier_sku, max: 64)
    |> unique_constraint([:supplier_id, :variant_id],
      message: "is already listed for this supplier"
    )
    |> unique_constraint(:is_preferred,
      name: :supplier_products_single_preferred_index,
      message: "another supplier is already preferred for this product"
    )
    |> foreign_key_constraint(:variant_id)
  end

  @doc """
  Rounds a wanted quantity up to something this supplier will actually ship.

  Respects both the minimum order and the case size: asking for seven of
  something sold in dozens gets twelve, not seven.
  """
  @spec orderable_quantity(t(), Decimal.t()) :: Decimal.t()
  def orderable_quantity(%__MODULE__{} = supplier_product, wanted) do
    wanted
    |> apply_minimum(supplier_product.minimum_order_quantity)
    |> apply_pack_size(supplier_product.pack_size)
  end

  defp apply_minimum(quantity, nil), do: quantity
  defp apply_minimum(quantity, minimum), do: Money.max(quantity, minimum)

  defp apply_pack_size(quantity, nil), do: quantity

  defp apply_pack_size(quantity, pack_size) do
    if Money.positive?(pack_size) do
      quantity
      |> Money.div(pack_size)
      |> Decimal.round(0, :ceiling)
      |> Money.mult(pack_size)
    else
      quantity
    end
  end
end
