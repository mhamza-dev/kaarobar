defmodule Kaarobar.Rentals.Agreement do
  @moduledoc """
  A hire: who took what, when it is due back, and what it costs if it is not.

  ## The deposit is held, not taken

  `deposit_held` is the customer's money sitting in the shop against damage.
  It is tracked apart from `hire_total` because it usually goes back — a shop
  that books it as revenue overstates the month and then has to find the cash
  to return it.

  ## `due_back_at` never moves

  It is what was agreed. Extending a hire writes a new agreement rather than
  editing this one, so "they were four days late" stays true even after the
  shop agrees to let them keep it another week. That is also what makes the
  late fee defensible when the customer disputes it.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Money
  alias Kaarobar.Rentals.AgreementLine
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(reserved on_hire returned overdue cancelled written_off)
  # States in which the shop's property is still out.
  @out_statuses ~w(reserved on_hire overdue)

  schema "rental_agreements" do
    field :number, :string
    field :status, :string, default: "reserved"

    field :starts_at, :utc_datetime_usec
    field :due_back_at, :utc_datetime_usec
    field :returned_at, :utc_datetime_usec

    field :hire_total, :decimal, default: Decimal.new(0)
    field :deposit_held, :decimal, default: Decimal.new(0)
    field :deposit_returned, :decimal, default: Decimal.new(0)
    field :late_fee, :decimal, default: Decimal.new(0)
    field :damage_fee, :decimal, default: Decimal.new(0)

    field :notes, :string
    field :cancelled_at, :utc_datetime_usec
    field :cancel_reason, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :customer, Customer
    belongs_to :sale, Sale
    belongs_to :issued_by, User
    belongs_to :returned_to, User

    has_many :lines, AgreementLine,
      foreign_key: :rental_agreement_id,
      preload_order: [asc: :position]

    timestamps()
  end

  @doc "The states a hire moves through."
  def statuses, do: @statuses

  @doc "The states in which the shop's property is still out."
  def out_statuses, do: @out_statuses

  def changeset(agreement, attrs) do
    agreement
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :customer_id,
      :number,
      :starts_at,
      :due_back_at,
      :hire_total,
      :deposit_held,
      :notes,
      :issued_by_id
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :branch_id,
      :customer_id,
      :number,
      :starts_at,
      :due_back_at
    ])
    |> validate_period()
    |> validate_number(:hire_total, greater_than_or_equal_to: 0)
    |> validate_number(:deposit_held, greater_than_or_equal_to: 0)
    |> unique_constraint(:number, name: :rental_agreements_business_id_number_index)
    |> foreign_key_constraint(:customer_id)
  end

  @doc "The goods have gone out."
  def issue_changeset(agreement), do: change(agreement, status: "on_hire")

  @doc """
  Everything is back, with whatever it cost.

  The deposit returned is what is left of it after fees. Netting it here rather
  than making the counter work it out is what stops a shop handing back a full
  deposit on damaged goods at the end of a long day.
  """
  def return_changeset(agreement, attrs, user_id) do
    agreement
    |> cast(attrs, [:late_fee, :damage_fee])
    |> validate_number(:late_fee, greater_than_or_equal_to: 0)
    |> validate_number(:damage_fee, greater_than_or_equal_to: 0)
    |> put_change(:status, "returned")
    |> put_change(:returned_at, DateTime.utc_now())
    |> put_change(:returned_to_id, user_id)
    |> put_deposit_returned()
  end

  @doc "Calls off a hire that has not gone out."
  def cancel_changeset(agreement, reason) do
    agreement
    |> cast(%{cancel_reason: reason}, [:cancel_reason])
    |> validate_required([:cancel_reason], message: "is required to cancel a hire")
    |> put_change(:status, "cancelled")
    |> put_change(:cancelled_at, DateTime.utc_now())
  end

  @doc "Past due and still out."
  def overdue_changeset(agreement), do: change(agreement, status: "overdue")

  @doc "True when the shop's property is still out."
  @spec out?(t()) :: boolean()
  def out?(%__MODULE__{status: status}), do: status in @out_statuses

  @doc """
  How many days late, against the agreed return.

  Zero while it is still in hand, so a caller can charge on the number without
  a special case.
  """
  @spec days_late(t(), DateTime.t()) :: non_neg_integer()
  def days_late(%__MODULE__{due_back_at: nil}, _now), do: 0

  def days_late(%__MODULE__{} = agreement, now) do
    finish = agreement.returned_at || now

    finish
    |> DateTime.diff(agreement.due_back_at, :second)
    |> div(86_400)
    |> max(0)
  end

  @doc """
  What a late return would cost at today's date.

  Charged per unit per day, because a customer keeping three ladders an extra
  week has cost the shop three ladders' worth of hire, not one.
  """
  @spec late_fee_for(t(), DateTime.t()) :: Decimal.t()
  def late_fee_for(%__MODULE__{lines: lines} = agreement, now) when is_list(lines) do
    case days_late(agreement, now) do
      0 ->
        Money.zero()

      days ->
        lines
        |> Enum.reject(& &1.returned_at)
        |> Enum.map(&Money.mult(&1.daily_rate, days))
        |> Money.sum()
        |> Money.round()
    end
  end

  def late_fee_for(%__MODULE__{}, _now), do: Money.zero()

  @doc "What the customer owes in total: hire, plus whatever went wrong."
  @spec total_due(t()) :: Decimal.t()
  def total_due(%__MODULE__{} = agreement) do
    agreement.hire_total
    |> Money.add(agreement.late_fee)
    |> Money.add(agreement.damage_fee)
  end

  defp validate_period(changeset) do
    starts = get_field(changeset, :starts_at)
    due = get_field(changeset, :due_back_at)

    if starts && due && DateTime.compare(due, starts) != :gt do
      add_error(changeset, :due_back_at, "must be after the hire starts")
    else
      changeset
    end
  end

  # What is left of the deposit after the fees come out of it.
  defp put_deposit_returned(changeset) do
    held = get_field(changeset, :deposit_held) || Money.zero()
    late = get_field(changeset, :late_fee) || Money.zero()
    damage = get_field(changeset, :damage_fee) || Money.zero()

    returned =
      held
      |> Money.sub(late)
      |> Money.sub(damage)
      |> Money.clamp_non_negative()

    put_change(changeset, :deposit_returned, Money.round(returned))
  end
end
