defmodule Kaarobar.Sales.OrderItemModifier do
  @moduledoc """
  An add-on chosen on an open ticket.

  Unlike its counterpart on a sale line, this one keeps a real foreign key to
  the modifier: the ticket is still being built, and a modifier that has been
  withdrawn should not stay orderable. Once billed, the sale line snapshots it
  instead, because a receipt has to keep printing what was charged.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.Modifier
  alias Kaarobar.Sales.OrderItem

  schema "order_item_modifiers" do
    field :name_snapshot, :string
    field :price_delta, :decimal, default: Decimal.new(0)

    belongs_to :order_item, OrderItem
    belongs_to :modifier, Modifier

    timestamps(updated_at: false)
  end

  def changeset(modifier, attrs) do
    modifier
    |> cast(attrs, [:order_item_id, :modifier_id, :name_snapshot, :price_delta])
    |> validate_required([:modifier_id, :name_snapshot])
    |> foreign_key_constraint(:order_item_id)
    |> foreign_key_constraint(:modifier_id)
  end
end
