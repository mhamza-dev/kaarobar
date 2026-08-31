defmodule Kaarobar.Sales.OrderItem do
  @moduledoc """
  One line on an open ticket.

  `billed_quantity` is what makes a split bill work. A table of four paying
  separately bills the same ticket several times, each pass taking a share of
  the lines; the line is finished when what has been billed reaches what was
  ordered. Deleting billed lines instead would lose the record of what the
  table actually ate.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Money
  alias Kaarobar.Sales.Order
  alias Kaarobar.Sales.OrderItemModifier
  alias Kaarobar.Tenancy.Business

  schema "order_items" do
    field :name_snapshot, :string

    field :quantity, :decimal
    field :billed_quantity, :decimal, default: Decimal.new(0)

    field :unit_price, :decimal
    field :line_total, :decimal, default: Decimal.new(0)

    field :seat_number, :integer
    field :position, :integer, default: 0
    field :note, :string

    # Which course this goes out with, and where the kitchen has got to with
    # it. Firing starters before mains is the job of a kitchen ticket, and it
    # cannot be inferred from the dish.
    field :course, :integer, default: 1
    field :kitchen_status, :string, default: "held"
    field :fired_at, :utc_datetime_usec
    field :ready_at, :utc_datetime_usec
    field :served_at, :utc_datetime_usec

    belongs_to :business, Business
    belongs_to :order, Order
    belongs_to :variant, ProductVariant

    has_many :modifiers, OrderItemModifier

    timestamps()
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :business_id,
      :order_id,
      :variant_id,
      :name_snapshot,
      :quantity,
      :unit_price,
      :line_total,
      :seat_number,
      :position,
      :note,
      :course
    ])
    |> validate_required([:business_id, :variant_id, :name_snapshot, :quantity, :unit_price])
    |> validate_number(:quantity, greater_than: 0)
    |> validate_number(:unit_price, greater_than_or_equal_to: 0)
    |> validate_number(:seat_number, greater_than: 0)
    |> validate_number(:course, greater_than: 0)
    |> validate_inclusion(:kitchen_status, ~w(held fired preparing ready served cancelled))
    |> foreign_key_constraint(:order_id)
    |> foreign_key_constraint(:variant_id)
  end

  @doc """
  Records that some of this line has now been paid for.

  Refuses to bill more than was ordered — that would let a split bill collect
  for food nobody had.
  """
  def bill_changeset(item, quantity) do
    billed = Money.add(item.billed_quantity, quantity)

    item
    |> change(billed_quantity: billed)
    |> validate_not_over_billed()
  end

  @doc "How much of this line is still to be paid for."
  @spec unbilled_quantity(t()) :: Decimal.t()
  def unbilled_quantity(%__MODULE__{quantity: quantity, billed_quantity: billed}),
    do: quantity |> Money.sub(billed) |> Money.clamp_non_negative()

  @doc "True when the whole line has been paid for."
  @spec fully_billed?(t()) :: boolean()
  def fully_billed?(%__MODULE__{} = item), do: Money.zero?(unbilled_quantity(item))

  @doc "What the line comes to, including its modifiers."
  @spec compute_line_total(t(), [OrderItemModifier.t()]) :: Decimal.t()
  def compute_line_total(%__MODULE__{} = item, modifiers) do
    modifier_total = modifiers |> Enum.map(& &1.price_delta) |> Money.sum()

    item.unit_price
    |> Money.add(modifier_total)
    |> Money.mult(item.quantity)
    |> Money.round_working()
  end

  @doc "Sends the line to the kitchen."
  def fire_changeset(item),
    do: change(item, kitchen_status: "fired", fired_at: DateTime.utc_now())

  @doc "The kitchen has it up at the pass."
  def ready_changeset(item),
    do: change(item, kitchen_status: "ready", ready_at: DateTime.utc_now())

  @doc "It has gone to the table."
  def served_changeset(item),
    do: change(item, kitchen_status: "served", served_at: DateTime.utc_now())

  @doc "True when this line is still waiting to be sent to the kitchen."
  @spec held?(t()) :: boolean()
  def held?(%__MODULE__{kitchen_status: "held"}), do: true
  def held?(%__MODULE__{}), do: false

  defp validate_not_over_billed(changeset) do
    quantity = get_field(changeset, :quantity)
    billed = get_field(changeset, :billed_quantity)

    if quantity && billed && Decimal.compare(billed, quantity) == :gt do
      add_error(changeset, :billed_quantity, "would exceed what was ordered")
    else
      changeset
    end
  end
end
