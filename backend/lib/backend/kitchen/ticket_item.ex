defmodule Kaarobar.Kitchen.TicketItem do
  @moduledoc """
  One dish on a kitchen ticket.

  The name and the modifiers are snapshotted because they are the instruction.
  A ticket already on a screen must not change because someone edited the menu
  mid-service, and "no onions" is the whole point of the line.

  A line carries its own status as well as the ticket's: a station can mark one
  dish ready while the rest of the ticket is still cooking, which is how a
  two-dish ticket gets sequenced without splitting it further.
  """

  use Kaarobar.Schema

  alias Kaarobar.Kitchen.Ticket
  alias Kaarobar.Sales.OrderItem
  alias Kaarobar.Tenancy.Business

  @statuses ~w(fired preparing ready bumped cancelled)

  schema "kitchen_ticket_items" do
    field :name_snapshot, :string
    field :quantity, :decimal
    field :modifiers_snapshot, {:array, :string}, default: []
    field :note, :string
    field :seat_number, :integer

    field :status, :string, default: "fired"
    field :position, :integer, default: 0

    belongs_to :business, Business
    belongs_to :kitchen_ticket, Ticket
    belongs_to :order_item, OrderItem

    timestamps()
  end

  @doc "The states a line moves through."
  def statuses, do: @statuses

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :business_id,
      :kitchen_ticket_id,
      :order_item_id,
      :name_snapshot,
      :quantity,
      :modifiers_snapshot,
      :note,
      :seat_number,
      :status,
      :position
    ])
    |> validate_required([:business_id, :order_item_id, :name_snapshot, :quantity])
    |> validate_number(:quantity, greater_than: 0)
    |> validate_inclusion(:status, @statuses)
    |> foreign_key_constraint(:kitchen_ticket_id)
    |> foreign_key_constraint(:order_item_id)
  end

  @doc "Marks one dish done without touching the rest of the ticket."
  def status_changeset(item, status) do
    item
    |> change(status: status)
    |> validate_inclusion(:status, @statuses)
  end

  @doc "The line as the screen prints it: quantity, dish, then the instructions."
  @spec display_line(t()) :: String.t()
  def display_line(%__MODULE__{} = item) do
    quantity = Decimal.to_string(item.quantity, :normal)
    base = "#{quantity} x #{item.name_snapshot}"

    case item.modifiers_snapshot do
      [] -> base
      modifiers -> base <> " (" <> Enum.join(modifiers, ", ") <> ")"
    end
  end
end
