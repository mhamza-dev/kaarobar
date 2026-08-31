defmodule Kaarobar.Commissions.Entry do
  @moduledoc """
  Commission earned on one line of one sale, frozen.

  `rate_snapshot` and `basis_snapshot` are copied at the moment of sale.
  Recomputing last month's commission against this month's rate restates what
  somebody has already been paid, which is the fastest way to lose a stylist —
  and the calculation would silently change again the next time the owner
  adjusted anything.

  A reversal is its own state rather than a deletion, so a refunded sale leaves
  the original accrual visible next to the reversal. Staff notice their pay
  going down; they should be able to see why.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Commissions.Rule
  alias Kaarobar.Money
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Sales.SaleItem
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(accrued approved paid reversed)

  schema "commissions" do
    field :basis_snapshot, :string
    field :rate_snapshot, :decimal
    field :base_amount, :decimal
    field :amount, :decimal

    field :status, :string, default: "accrued"
    field :earned_on, :date
    field :paid_at, :utc_datetime_usec
    field :reversed_at, :utc_datetime_usec
    field :note, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :user, User
    belongs_to :sale, Sale
    belongs_to :sale_item, SaleItem
    belongs_to :commission_rule, Rule

    timestamps()
  end

  @doc "The states an accrual moves through."
  def statuses, do: @statuses

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :user_id,
      :sale_id,
      :sale_item_id,
      :commission_rule_id,
      :basis_snapshot,
      :rate_snapshot,
      :base_amount,
      :amount,
      :earned_on,
      :note
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :user_id,
      :sale_id,
      :basis_snapshot,
      :base_amount,
      :amount,
      :earned_on
    ])
    |> validate_number(:amount, greater_than_or_equal_to: 0)
    |> unique_constraint(:sale_item_id,
      name: :commissions_one_per_line_index,
      message: "has already been paid on this line"
    )
    |> foreign_key_constraint(:sale_id)
  end

  @doc "Signed off, but not yet paid."
  def approve_changeset(entry), do: change(entry, status: "approved")

  @doc "Paid out."
  def pay_changeset(entry), do: change(entry, status: "paid", paid_at: DateTime.utc_now())

  @doc """
  Takes it back, because the sale was refunded.

  A state rather than a deletion: staff notice their pay going down and should
  be able to see the reversal sitting next to the accrual it undoes.
  """
  def reverse_changeset(entry, reason) do
    change(entry,
      status: "reversed",
      reversed_at: DateTime.utc_now(),
      note: reason
    )
  end

  @doc "True when this still counts towards what is owed to the person."
  @spec payable?(t()) :: boolean()
  def payable?(%__MODULE__{status: status}), do: status in ["accrued", "approved"]

  @doc "The effective rate, for a payslip line that has to explain itself."
  @spec effective_rate(t()) :: Decimal.t()
  def effective_rate(%__MODULE__{rate_snapshot: rate}) when not is_nil(rate), do: rate

  def effective_rate(%__MODULE__{base_amount: base, amount: amount}) do
    if Money.positive?(base), do: Money.div(amount, base), else: Money.zero()
  end
end
