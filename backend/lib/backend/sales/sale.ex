defmodule Kaarobar.Sales.Sale do
  @moduledoc """
  A completed sale — the financial record the shop is judged on.

  There is no update changeset for its money. A sale is written once and then
  only voided or refunded, both of which leave the original intact beside the
  reversal. A sale that can be quietly edited afterwards is one an auditor
  cannot rely on and a shopkeeper cannot prove anything with.

  Every figure on it is a snapshot: the totals, the tax that was charged, and
  the cost of what was sold. Recomputing any of them from today's catalog would
  restate last year's revenue every time a price changed.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Money
  alias Kaarobar.Registers.Register
  alias Kaarobar.Registers.Shift
  alias Kaarobar.Sales.Order
  alias Kaarobar.Sales.Payment
  alias Kaarobar.Sales.SaleItem
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(completed voided partially_refunded refunded)
  @channels ~w(pos online phone wholesale)

  schema "sales" do
    field :number, :string
    field :status, :string, default: "completed"
    field :channel, :string, default: "pos"
    field :currency, :string

    field :subtotal, :decimal, default: Decimal.new(0)
    field :discount_total, :decimal, default: Decimal.new(0)
    field :order_discount, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :rounding, :decimal, default: Decimal.new(0)
    field :total, :decimal, default: Decimal.new(0)

    field :paid_total, :decimal, default: Decimal.new(0)
    field :change_due, :decimal, default: Decimal.new(0)
    field :refunded_total, :decimal, default: Decimal.new(0)
    field :cost_total, :decimal, default: Decimal.new(0)
    # What this sale put on the customer's account. Frozen at checkout; what is
    # still owed on it comes from `Kaarobar.Credit`, not from here.
    field :credit_total, :decimal, default: Decimal.new(0)

    field :prices_include_tax, :boolean, default: false

    field :service_mode, :string
    field :cashier_label, :string
    field :notes, :string
    field :discount_reason, :string

    field :voided_at, :utc_datetime_usec
    field :void_reason, :string
    field :sold_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :register, Register
    belongs_to :shift, Shift
    belongs_to :order, Order
    belongs_to :customer, Customer
    belongs_to :cashier, User
    belongs_to :served_by_user, User
    belongs_to :voided_by, User
    belongs_to :discount_approved_by, User

    has_many :items, SaleItem, preload_order: [asc: :position]
    has_many :payments, Payment

    timestamps()
  end

  @doc "The states a sale may be in."
  def statuses, do: @statuses

  @doc "Where a sale came from."
  def channels, do: @channels

  @doc """
  Changeset for a completed sale.

  Written only by `Kaarobar.Sales.Checkout`, which computes every figure from
  the priced lines rather than accepting them. A client that could send its own
  totals could send any total.
  """
  def create_changeset(sale, attrs) do
    sale
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :register_id,
      :shift_id,
      :order_id,
      :customer_id,
      :number,
      :status,
      :channel,
      :currency,
      :subtotal,
      :discount_total,
      :order_discount,
      :tax_total,
      :rounding,
      :total,
      :paid_total,
      :change_due,
      :cost_total,
      :credit_total,
      :prices_include_tax,
      :service_mode,
      :served_by_user_id,
      :cashier_id,
      :cashier_label,
      :notes,
      :discount_reason,
      :discount_approved_by_id,
      :sold_at
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :branch_id,
      :number,
      :currency,
      :total,
      :sold_at
    ])
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:channel, @channels)
    |> validate_inclusion(:service_mode, ~w(dine_in takeaway delivery))
    |> validate_number(:total, greater_than_or_equal_to: 0)
    |> validate_number(:subtotal, greater_than_or_equal_to: 0)
    |> unique_constraint(:number, name: :sales_business_id_number_index, message: "has already been issued")
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:customer_id)
  end

  @doc """
  Changeset for voiding a sale in full.

  A reason is required and enforced by the database. A void is the one action
  that erases a whole transaction from the day's takings, so an unexplained one
  is exactly what somebody covering a shortfall would leave behind.
  """
  def void_changeset(sale, user_id, reason) do
    sale
    |> cast(%{void_reason: reason}, [:void_reason])
    |> validate_required([:void_reason], message: "is required to void a sale")
    |> validate_length(:void_reason, min: 3, max: 200)
    |> put_change(:status, "voided")
    |> put_change(:voided_at, DateTime.utc_now())
    |> put_change(:voided_by_id, user_id)
  end

  @doc "Changeset recording a further refund against this sale."
  def refund_changeset(sale, amount) do
    refunded = Money.add(sale.refunded_total, amount)

    change(sale, refunded_total: refunded, status: refund_status(sale, refunded))
  end

  @doc "What is still refundable on this sale."
  @spec refundable_amount(t()) :: Decimal.t()
  def refundable_amount(%__MODULE__{status: "voided"}), do: Money.zero()

  def refundable_amount(%__MODULE__{total: total, refunded_total: refunded}),
    do: total |> Money.sub(refunded) |> Money.clamp_non_negative()

  @doc """
  True when this sale was, wholly or partly, sold on account.

  What is still owed on it is `Kaarobar.Credit.outstanding_on/2` — a voided
  sale owes nothing regardless of what it charged.
  """
  @spec on_credit?(t()) :: boolean()
  def on_credit?(%__MODULE__{status: "voided"}), do: false
  def on_credit?(%__MODULE__{credit_total: total}), do: Money.positive?(total)

  @doc "True when the sale still counts towards the day's takings."
  @spec counts_towards_takings?(t()) :: boolean()
  def counts_towards_takings?(%__MODULE__{status: "voided"}), do: false
  def counts_towards_takings?(%__MODULE__{}), do: true

  @doc "True when anything may still be refunded."
  @spec refundable?(t()) :: boolean()
  def refundable?(%__MODULE__{} = sale), do: Money.positive?(refundable_amount(sale))

  @doc "The margin on this sale, or nil when nothing was costed."
  @spec margin(t()) :: Decimal.t() | nil
  def margin(%__MODULE__{cost_total: cost, subtotal: subtotal}) do
    if Money.positive?(subtotal), do: Money.sub(subtotal, cost)
  end

  defp refund_status(%__MODULE__{total: total}, refunded) do
    if Decimal.compare(refunded, total) != :lt, do: "refunded", else: "partially_refunded"
  end
end
