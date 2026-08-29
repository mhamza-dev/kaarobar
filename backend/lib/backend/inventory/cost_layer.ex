defmodule Kaarobar.Inventory.CostLayer do
  @moduledoc """
  One receipt of stock at one cost, under FIFO.

  Each delivery creates a layer. Each sale consumes the oldest layers with
  stock left in them, and the cost of goods sold is whatever those layers
  actually cost — not an average, and not today's price.

  This exists only for businesses on FIFO. Under weighted average the cost
  lives in `stock_items.average_cost` and no layers are written at all, because
  maintaining a structure nothing reads is how it silently goes wrong.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business

  schema "cost_layers" do
    field :quantity, :decimal
    field :remaining_quantity, :decimal
    field :unit_cost, :decimal
    field :source_move_id, Kaarobar.Ecto.UUIDv7
    field :received_at, :utc_datetime_usec

    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :variant, ProductVariant
    belongs_to :batch, Batch

    timestamps()
  end

  def changeset(layer, attrs) do
    layer
    |> cast(attrs, [
      :business_id,
      :branch_id,
      :variant_id,
      :batch_id,
      :quantity,
      :remaining_quantity,
      :unit_cost,
      :source_move_id,
      :received_at
    ])
    |> validate_required([
      :business_id,
      :branch_id,
      :variant_id,
      :quantity,
      :remaining_quantity,
      :unit_cost,
      :received_at
    ])
    |> validate_number(:quantity, greater_than: 0)
    |> validate_number(:unit_cost, greater_than_or_equal_to: 0)
    |> validate_remaining_within_quantity()
  end

  @doc "What is left in this layer, at what it cost."
  @spec value(t()) :: Decimal.t()
  def value(%__MODULE__{remaining_quantity: remaining, unit_cost: cost}),
    do: Money.mult(remaining, cost)

  @doc "True when the layer still has stock to draw from."
  @spec open?(t()) :: boolean()
  def open?(%__MODULE__{remaining_quantity: remaining}), do: Money.positive?(remaining)

  defp validate_remaining_within_quantity(changeset) do
    quantity = get_field(changeset, :quantity)
    remaining = get_field(changeset, :remaining_quantity)

    cond do
      is_nil(quantity) or is_nil(remaining) ->
        changeset

      Decimal.compare(remaining, 0) == :lt ->
        add_error(changeset, :remaining_quantity, "must not be negative")

      Decimal.compare(remaining, quantity) == :gt ->
        add_error(changeset, :remaining_quantity, "cannot exceed the quantity received")

      true ->
        changeset
    end
  end
end
