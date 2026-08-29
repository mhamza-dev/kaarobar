defmodule Kaarobar.Registers.Shift do
  @moduledoc """
  A period of trading on one till, with a person's name on it.

  This exists so that "is the drawer short?" is answerable. A shift opens with a
  counted float, accumulates every tender taken on that register, and closes
  with a second count. The difference between what the system expected and what
  was actually there is the single most useful number a shop owner gets each
  day.

  ## Expected cash is derived, not stored

  `expected_cash/1` computes from the parts — opening float, cash sales, cash
  refunds, pay-ins, pay-outs — rather than reading one saved figure. When a
  drawer is short, the shopkeeper needs to see *which* part is wrong, and a
  single stored number cannot tell them.

  Only cash is counted this way. A card total is checked against the terminal's
  own settlement, not against what is in the drawer.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Money
  alias Kaarobar.Registers.Register
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(open closing closed)

  schema "shifts" do
    field :number, :string
    field :status, :string, default: "open"

    field :opened_at, :utc_datetime_usec
    field :closed_at, :utc_datetime_usec

    field :opening_float, :decimal, default: Decimal.new(0)

    field :sales_count, :integer, default: 0
    field :gross_sales, :decimal, default: Decimal.new(0)
    field :discount_total, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :refund_total, :decimal, default: Decimal.new(0)

    # Keyed by tender: %{"cash" => "4200.00", "card" => "8150.00"}.
    field :tender_totals, :map, default: %{}

    field :cash_in, :decimal, default: Decimal.new(0)
    field :cash_out, :decimal, default: Decimal.new(0)

    field :declared_cash, :decimal
    field :declared_tenders, :map
    field :expected_cash, :decimal
    field :cash_variance, :decimal

    field :notes, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :register, Register
    belongs_to :opened_by, User
    belongs_to :closed_by, User

    timestamps()
  end

  @doc "The states a shift moves through."
  def statuses, do: @statuses

  @doc "Changeset for opening a shift with a counted float."
  def open_changeset(shift, attrs) do
    shift
    |> cast(attrs, [:register_id, :branch_id, :opening_float, :notes])
    |> validate_required([:register_id, :branch_id])
    |> validate_number(:opening_float, greater_than_or_equal_to: 0)
    |> put_change(:status, "open")
    |> put_change(:opened_at, DateTime.utc_now())
    |> unique_constraint(:register_id,
      name: :shifts_single_open_per_register_index,
      message: "already has an open shift"
    )
    |> foreign_key_constraint(:register_id)
  end

  @doc """
  Changeset for closing, with what was actually counted out of the drawer.

  The variance is computed here rather than sent by the client: a till that
  could report its own variance could report zero.
  """
  def close_changeset(shift, attrs, user_id) do
    shift
    |> cast(attrs, [:declared_cash, :declared_tenders, :notes])
    |> validate_required([:declared_cash], message: "is required to close a shift")
    |> validate_number(:declared_cash, greater_than_or_equal_to: 0)
    |> put_change(:status, "closed")
    |> put_change(:closed_at, DateTime.utc_now())
    |> put_change(:closed_by_id, user_id)
    |> put_expected_and_variance(shift)
  end

  @doc """
  What should be in the drawer right now.

  Float, plus cash taken, less cash refunded, plus pay-ins, less pay-outs and
  drops. Cash movements are already signed, so they simply add.
  """
  @spec expected_cash(t()) :: Decimal.t()
  def expected_cash(%__MODULE__{} = shift) do
    shift.opening_float
    |> Money.add(tender_total(shift, "cash"))
    |> Money.add(shift.cash_in)
    |> Money.sub(shift.cash_out)
  end

  @doc "The total taken on one tender."
  @spec tender_total(t(), String.t()) :: Decimal.t()
  def tender_total(%__MODULE__{tender_totals: totals}, method) do
    totals |> Map.get(method, "0") |> Money.to_decimal()
  end

  @doc "Adds an amount to one tender's running total."
  @spec add_tender(t(), String.t(), Decimal.t()) :: map()
  def add_tender(%__MODULE__{} = shift, method, amount) do
    updated = shift |> tender_total(method) |> Money.add(amount)

    Map.put(shift.tender_totals, method, Decimal.to_string(updated, :normal))
  end

  @doc "True when sales may still be rung on this shift."
  @spec open?(t()) :: boolean()
  def open?(%__MODULE__{status: "open"}), do: true
  def open?(%__MODULE__{}), do: false

  @doc """
  True when the drawer did not balance.

  Any difference at all, in either direction. A till that is consistently over
  is as worth investigating as one that is short.
  """
  @spec balanced?(t()) :: boolean()
  def balanced?(%__MODULE__{cash_variance: nil}), do: true
  def balanced?(%__MODULE__{cash_variance: variance}), do: Money.zero?(variance)

  @doc "The takings, net of refunds."
  @spec net_sales(t()) :: Decimal.t()
  def net_sales(%__MODULE__{gross_sales: gross, refund_total: refunds}),
    do: Money.sub(gross, refunds)

  defp put_expected_and_variance(changeset, %__MODULE__{} = shift) do
    expected = expected_cash(shift)
    declared = get_field(changeset, :declared_cash)

    if declared do
      changeset
      |> put_change(:expected_cash, expected)
      |> put_change(:cash_variance, Money.sub(declared, expected))
    else
      changeset
    end
  end
end
