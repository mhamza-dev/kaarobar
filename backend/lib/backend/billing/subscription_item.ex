defmodule Kaarobar.Billing.SubscriptionItem do
  @moduledoc """
  One counted thing on a subscription: seats, branches, businesses, an add-on.

  Kept apart from the plan because the plan is the price list and this is the
  quantity. A shop that opens a second branch mid-month changes this row; it
  does not change what "Standard" costs for everybody else.
  """

  use Kaarobar.Schema

  alias Kaarobar.Billing.Subscription
  alias Kaarobar.Money

  @kinds ~w(seat branch business addon)

  schema "subscription_items" do
    field :kind, :string
    field :quantity, :integer, default: 1
    field :unit_amount, :decimal, default: Decimal.new(0)
    field :external_item_id, :string

    belongs_to :subscription, Subscription

    timestamps()
  end

  @doc "The things a subscription can be charged per unit of."
  def kinds, do: @kinds

  def changeset(item, attrs) do
    item
    |> cast(attrs, [:subscription_id, :kind, :quantity, :unit_amount, :external_item_id])
    |> validate_required([:kind, :quantity])
    |> validate_inclusion(:kind, @kinds)
    |> validate_number(:quantity, greater_than_or_equal_to: 0)
    |> validate_number(:unit_amount, greater_than_or_equal_to: 0)
    |> unique_constraint(:kind,
      name: :subscription_items_subscription_id_kind_index,
      message: "is already on this subscription"
    )
    |> foreign_key_constraint(:subscription_id)
  end

  @doc "What this line adds to the bill."
  @spec amount(t()) :: Decimal.t()
  def amount(%__MODULE__{quantity: quantity, unit_amount: unit}),
    do: Money.round_working(Money.mult(unit, quantity))
end
