defmodule Kaarobar.Purchasing.GoodsReceiptItem do
  @moduledoc """
  One line of a delivery.

  `batch_number`, `manufactured_on` and `expires_on` are captured here rather
  than looked up, because they come off the box in front of the person
  receiving it. Posting turns them into a `Kaarobar.Inventory.Batch`, which is
  what a recall is later traced through.

  `rejected_quantity` is stock that arrived broken. It is booked in and
  immediately written off rather than simply not counted, so the invoice and
  the stock ledger both reflect what physically happened — and so the shop has
  a number to claim against.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Money
  alias Kaarobar.Purchasing.GoodsReceipt
  alias Kaarobar.Purchasing.PurchaseOrderItem
  alias Kaarobar.Tenancy.Business

  schema "goods_receipt_items" do
    field :quantity, :decimal
    field :rejected_quantity, :decimal, default: Decimal.new(0)
    field :unit_cost, :decimal
    field :line_total, :decimal, default: Decimal.new(0)

    field :batch_number, :string
    field :manufactured_on, :date
    field :expires_on, :date

    field :serials, {:array, :string}, default: []

    field :position, :integer, default: 0
    field :note, :string

    belongs_to :business, Business
    belongs_to :goods_receipt, GoodsReceipt
    belongs_to :purchase_order_item, PurchaseOrderItem
    belongs_to :variant, ProductVariant
    belongs_to :batch, Batch

    timestamps()
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :business_id,
      :goods_receipt_id,
      :purchase_order_item_id,
      :variant_id,
      :quantity,
      :rejected_quantity,
      :unit_cost,
      :batch_number,
      :manufactured_on,
      :expires_on,
      :serials,
      :position,
      :note
    ])
    |> validate_required([:business_id, :goods_receipt_id, :variant_id, :quantity, :unit_cost])
    |> validate_number(:quantity, greater_than: 0)
    |> validate_number(:unit_cost, greater_than_or_equal_to: 0)
    |> validate_rejected_within_quantity()
    |> validate_expiry_dates()
    |> validate_serial_count()
    |> foreign_key_constraint(:variant_id)
    |> foreign_key_constraint(:goods_receipt_id)
  end

  @doc "The quantity that actually enters sellable stock."
  @spec accepted_quantity(t()) :: Decimal.t()
  def accepted_quantity(%__MODULE__{quantity: quantity, rejected_quantity: rejected}),
    do: quantity |> Money.sub(rejected) |> Money.clamp_non_negative()

  @doc "True when this line carries batch details off the box."
  @spec batched?(t()) :: boolean()
  def batched?(%__MODULE__{batch_number: nil}), do: false
  def batched?(%__MODULE__{batch_number: ""}), do: false
  def batched?(%__MODULE__{}), do: true

  @doc "What this line costs, before tax."
  @spec net_amount(t()) :: Decimal.t()
  def net_amount(%__MODULE__{quantity: quantity, unit_cost: cost}), do: Money.mult(quantity, cost)

  defp validate_rejected_within_quantity(changeset) do
    quantity = get_field(changeset, :quantity)
    rejected = get_field(changeset, :rejected_quantity) || Money.zero()

    cond do
      is_nil(quantity) -> changeset
      Money.negative?(rejected) -> add_error(changeset, :rejected_quantity, "must not be negative")
      Decimal.compare(rejected, quantity) == :gt ->
        add_error(changeset, :rejected_quantity, "cannot exceed the quantity received")

      true ->
        changeset
    end
  end

  defp validate_expiry_dates(changeset) do
    manufactured = get_field(changeset, :manufactured_on)
    expires = get_field(changeset, :expires_on)

    if manufactured && expires && Date.compare(expires, manufactured) == :lt do
      add_error(changeset, :expires_on, "must be on or after the manufacture date")
    else
      changeset
    end
  end

  # A serial identifies exactly one unit, so the count has to match. Booking in
  # ten phones with eight serials leaves two units nobody can trace.
  defp validate_serial_count(changeset) do
    serials = get_field(changeset, :serials) || []
    quantity = get_field(changeset, :quantity)

    if serials != [] and quantity && Decimal.compare(Decimal.new(length(serials)), quantity) != :eq do
      add_error(changeset, :serials, "must have one serial for each unit received")
    else
      changeset
    end
  end
end
