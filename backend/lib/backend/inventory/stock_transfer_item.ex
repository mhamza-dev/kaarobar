defmodule Kaarobar.Inventory.StockTransferItem do
  @moduledoc """
  One line of a transfer.

  `unit_cost` is carried across so the destination values the goods at what
  they actually cost rather than at whatever its own average happens to be.
  Without it, moving stock between branches quietly changes what the business
  believes its inventory is worth.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Inventory.StockTransfer
  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Business

  schema "stock_transfer_items" do
    field :quantity, :decimal
    field :received_quantity, :decimal
    field :unit_cost, :decimal
    field :position, :integer, default: 0
    field :note, :string

    belongs_to :business, Business
    belongs_to :stock_transfer, StockTransfer
    belongs_to :variant, ProductVariant
    belongs_to :batch, Batch

    timestamps()
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :business_id,
      :stock_transfer_id,
      :variant_id,
      :batch_id,
      :quantity,
      :unit_cost,
      :position,
      :note
    ])
    |> validate_required([:business_id, :stock_transfer_id, :variant_id, :quantity])
    |> validate_number(:quantity, greater_than: 0)
    |> validate_number(:unit_cost, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:variant_id)
    |> foreign_key_constraint(:stock_transfer_id)
  end

  @doc "Changeset recording what actually arrived."
  def receive_changeset(item, received_quantity) do
    item
    |> cast(%{received_quantity: received_quantity}, [:received_quantity])
    |> validate_required([:received_quantity])
    |> validate_number(:received_quantity, greater_than_or_equal_to: 0)
    |> validate_not_over_received()
  end

  @doc "How much of what was sent failed to arrive."
  @spec shortfall(t()) :: Decimal.t()
  def shortfall(%__MODULE__{received_quantity: nil}), do: Money.zero()

  def shortfall(%__MODULE__{quantity: sent, received_quantity: received}),
    do: sent |> Money.sub(received) |> Money.clamp_non_negative()

  @doc "True when less arrived than was sent."
  @spec short?(t()) :: boolean()
  def short?(%__MODULE__{} = item), do: Money.positive?(shortfall(item))

  # More arriving than was sent is a counting error at one end or the other,
  # and absorbing it silently would make both branches wrong.
  defp validate_not_over_received(changeset) do
    sent = get_field(changeset, :quantity)
    received = get_field(changeset, :received_quantity)

    if sent && received && Decimal.compare(received, sent) == :gt do
      add_error(changeset, :received_quantity, "cannot exceed the quantity dispatched")
    else
      changeset
    end
  end
end
