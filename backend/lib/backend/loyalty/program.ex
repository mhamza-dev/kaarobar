defmodule Kaarobar.Loyalty.Program do
  @moduledoc """
  The rules of a shop's points scheme.

  ## Two rates, not one

  `earn_rate` is points per unit of currency spent; `redeem_rate` is what one
  point is worth back. Shops routinely earn at 1 and redeem at 0.01, and a
  single "conversion rate" hides the only number that matters — what the
  scheme costs as a percentage of takings, which is `earn_rate * redeem_rate`.

  ## The caps are the liability controls

  `max_redeem_percent` stops points paying for a whole basket, which would send
  stock out of the door against no cash at all. `points_expire_after_days`
  bounds a liability that otherwise grows quietly for years and is redeemed all
  at once, usually in the week a shop can least afford it.
  """

  use Kaarobar.Schema

  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "loyalty_programs" do
    field :name, :string
    field :points_label, :string, default: "points"

    field :earn_rate, :decimal, default: Decimal.new(1)
    field :redeem_rate, :decimal, default: Decimal.new("0.01")

    field :min_points_to_redeem, :integer, default: 0
    field :max_redeem_percent, :decimal
    field :points_expire_after_days, :integer

    field :earn_on_discounted, :boolean, default: true
    field :earn_on_tax, :boolean, default: false

    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    timestamps()
  end

  def changeset(program, attrs) do
    program
    |> cast(attrs, [
      :name,
      :points_label,
      :earn_rate,
      :redeem_rate,
      :min_points_to_redeem,
      :max_redeem_percent,
      :points_expire_after_days,
      :earn_on_discounted,
      :earn_on_tax,
      :is_active
    ])
    |> validate_required([:name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 80)
    |> validate_number(:earn_rate, greater_than_or_equal_to: 0)
    |> validate_number(:redeem_rate, greater_than_or_equal_to: 0)
    |> validate_number(:min_points_to_redeem, greater_than_or_equal_to: 0)
    |> validate_number(:max_redeem_percent, greater_than: 0, less_than_or_equal_to: 1)
    |> validate_number(:points_expire_after_days, greater_than: 0)
    |> unique_constraint(:is_active,
      name: :loyalty_programs_single_active_index,
      message: "another programme is already running"
    )
  end

  @doc "Soft-deletes the programme. Accrued points keep their balances."
  def soft_delete_changeset(program), do: change(program, deleted_at: DateTime.utc_now())

  @doc """
  Points earned on a spend.

  Rounded down: a scheme that rounds up pays out more than it charges for, a
  fraction at a time, on every transaction.
  """
  @spec points_for(t(), Decimal.t(), Decimal.t()) :: integer()
  def points_for(%__MODULE__{} = program, amount, multiplier \\ nil) do
    if Money.positive?(amount) do
      amount
      |> Decimal.mult(program.earn_rate)
      |> Decimal.mult(multiplier || Decimal.new(1))
      |> Decimal.round(0, :floor)
      |> Decimal.to_integer()
      |> max(0)
    else
      0
    end
  end

  @doc "What a number of points is worth as money."
  @spec value_of(t(), integer()) :: Decimal.t()
  def value_of(%__MODULE__{redeem_rate: rate}, points) when points > 0,
    do: points |> Decimal.new() |> Decimal.mult(rate) |> Money.round()

  def value_of(%__MODULE__{}, _points), do: Money.zero()

  @doc """
  The most that may be redeemed against a bill, in points.

  Bounded by three things at once: what the customer has, what the programme
  allows as a share of the bill, and what the bill is worth at the redeem rate.
  """
  @spec max_redeemable(t(), integer(), Decimal.t()) :: integer()
  def max_redeemable(%__MODULE__{} = program, points_balance, bill_total) do
    if points_balance < program.min_points_to_redeem or not Money.positive?(bill_total) do
      0
    else
      cap = redeem_cap(program, bill_total)
      points_worth_of = points_for_value(program, cap)
      min(points_balance, points_worth_of)
    end
  end

  @doc "True when the customer has enough to redeem anything at all."
  @spec can_redeem?(t(), integer()) :: boolean()
  def can_redeem?(%__MODULE__{min_points_to_redeem: floor_points}, balance),
    do: balance > 0 and balance >= floor_points

  @doc "The date points earned now would expire, or nil when they never do."
  @spec expiry_for(t(), Date.t()) :: Date.t() | nil
  def expiry_for(%__MODULE__{points_expire_after_days: nil}, _on), do: nil

  def expiry_for(%__MODULE__{points_expire_after_days: days}, on), do: Date.add(on, days)

  defp redeem_cap(%__MODULE__{max_redeem_percent: nil}, bill_total), do: bill_total

  defp redeem_cap(%__MODULE__{max_redeem_percent: percent}, bill_total),
    do: bill_total |> Money.rate_of(percent) |> Money.round()

  # How many whole points are needed to cover an amount. Rounded down so a
  # redemption can never exceed the cap it was measured against.
  defp points_for_value(%__MODULE__{redeem_rate: rate}, amount) do
    if Decimal.compare(rate, 0) == :gt do
      amount |> Decimal.div(rate) |> Decimal.round(0, :floor) |> Decimal.to_integer() |> max(0)
    else
      0
    end
  end
end
