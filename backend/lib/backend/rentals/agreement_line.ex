defmodule Kaarobar.Rentals.AgreementLine do
  @moduledoc """
  One unit committed to one hire, for a period.

  `held_from`/`held_until` are copied from the agreement rather than joined,
  for two reasons. The overlap guard is a `gist` index expression and Postgres
  forbids subqueries in those; and a line returned early frees its unit before
  the agreement ends, so the line's own period is the one that governs
  availability.

  Returning is per line because a customer brings the ladder back and keeps the
  mixer.
  """

  use Kaarobar.Schema

  alias Kaarobar.Money
  alias Kaarobar.Rentals.Agreement
  alias Kaarobar.Rentals.Unit
  alias Kaarobar.Tenancy.Business

  @conditions ~w(good damaged lost late)

  schema "rental_agreement_lines" do
    field :name_snapshot, :string
    field :daily_rate, :decimal
    field :deposit_amount, :decimal, default: Decimal.new(0)

    field :held_from, :utc_datetime_usec
    field :held_until, :utc_datetime_usec

    field :returned_at, :utc_datetime_usec
    field :return_condition, :string
    field :condition_notes, :string
    field :position, :integer, default: 0

    belongs_to :business, Business
    belongs_to :rental_agreement, Agreement
    belongs_to :rental_unit, Unit

    timestamps()
  end

  @doc "The states a unit can come back in."
  def conditions, do: @conditions

  def changeset(line, attrs) do
    line
    |> cast(attrs, [
      :business_id,
      :rental_agreement_id,
      :rental_unit_id,
      :name_snapshot,
      :daily_rate,
      :deposit_amount,
      :held_from,
      :held_until,
      :position
    ])
    |> validate_required([
      :business_id,
      :rental_unit_id,
      :name_snapshot,
      :daily_rate,
      :held_from,
      :held_until
    ])
    |> validate_number(:daily_rate, greater_than_or_equal_to: 0)
    |> validate_number(:deposit_amount, greater_than_or_equal_to: 0)
    |> validate_period()
    |> exclusion_constraint(:rental_unit_id,
      name: :rental_lines_one_live_hire,
      message: "is already out on hire for that period"
    )
    |> foreign_key_constraint(:rental_unit_id)
    |> foreign_key_constraint(:rental_agreement_id)
  end

  @doc "This unit is back, in whatever state it came back in."
  def return_changeset(line, condition, notes) do
    line
    |> change(
      returned_at: DateTime.utc_now(),
      return_condition: condition,
      condition_notes: notes
    )
    |> validate_inclusion(:return_condition, @conditions)
  end

  @doc "True when this unit is still out."
  @spec out?(t()) :: boolean()
  def out?(%__MODULE__{returned_at: nil}), do: true
  def out?(%__MODULE__{}), do: false

  @doc "What this line earns over a number of days."
  @spec charge_for(t(), non_neg_integer()) :: Decimal.t()
  def charge_for(%__MODULE__{daily_rate: rate}, days) when days > 0,
    do: rate |> Money.mult(days) |> Money.round()

  def charge_for(%__MODULE__{}, _days), do: Money.zero()

  defp validate_period(changeset) do
    from = get_field(changeset, :held_from)
    until = get_field(changeset, :held_until)

    if from && until && DateTime.compare(until, from) != :gt do
      add_error(changeset, :held_until, "must be after the hire starts")
    else
      changeset
    end
  end
end
