defmodule Kaarobar.Sales.Payment do
  @moduledoc """
  One tender against a sale.

  A sale has many, because customers split them: two thousand on a card, the
  rest in cash; a voucher plus the difference; half now and half on account.
  Modelling payment as a column on the sale makes the common case
  unrepresentable, and shops work around it by ringing two sales — which
  destroys the basket analysis and doubles the transaction count.

  ## Credit is a tender that moves no money

  Paying on account settles the sale from the shop's point of view and moves
  the debt to the customer ledger. Treating it as a tender keeps the arithmetic
  uniform: every sale's tenders sum to its total, whatever mix of real and
  deferred money that is.
  """

  use Kaarobar.Schema

  alias Kaarobar.Money
  alias Kaarobar.Registers.Shift
  alias Kaarobar.Sales.PaymentRefund
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @methods ~w(cash card wallet bank_transfer cheque credit gift_card loyalty store_credit other)
  # Tenders that put money in the drawer, and so affect the shift's cash count.
  @cash_methods ~w(cash)
  # Tenders that move no money now.
  @deferred_methods ~w(credit)

  schema "payments" do
    field :method, :string
    field :amount, :decimal
    field :tendered_amount, :decimal
    field :refunded_amount, :decimal, default: Decimal.new(0)
    field :currency, :string

    field :reference, :string
    field :card_last_four, :string
    field :card_scheme, :string
    field :gateway_transaction_id, :string
    field :status, :string, default: "captured"

    field :occurred_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :sale, Sale
    belongs_to :shift, Shift

    has_many :refunds, PaymentRefund

    timestamps()
  end

  @doc "Every tender the platform accepts."
  def methods, do: @methods

  @doc "Tenders that put physical money in the drawer."
  def cash_methods, do: @cash_methods

  @doc "Tenders that settle a sale without money changing hands now."
  def deferred_methods, do: @deferred_methods

  def changeset(payment, attrs) do
    payment
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :sale_id,
      :shift_id,
      :method,
      :amount,
      :tendered_amount,
      :currency,
      :reference,
      :card_last_four,
      :card_scheme,
      :gateway_transaction_id,
      :status,
      :occurred_at
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :sale_id,
      :method,
      :amount,
      :currency,
      :occurred_at
    ])
    |> validate_inclusion(:method, @methods)
    |> validate_inclusion(:status, ~w(pending captured failed voided))
    |> validate_number(:amount, greater_than: 0)
    |> validate_length(:card_last_four, is: 4)
    |> validate_tendered_covers_amount()
    |> foreign_key_constraint(:sale_id)
  end

  @doc "Changeset recording a further refund through this tender."
  def refund_changeset(payment, amount) do
    payment
    |> change(refunded_amount: Money.add(payment.refunded_amount, amount))
    |> validate_not_over_refunded()
  end

  @doc "True when this tender put money in the drawer."
  @spec cash?(t()) :: boolean()
  def cash?(%__MODULE__{method: method}), do: method in @cash_methods

  @doc "True when this tender settled the sale without money changing hands."
  @spec deferred?(t()) :: boolean()
  def deferred?(%__MODULE__{method: method}), do: method in @deferred_methods

  @doc "How much of this tender may still be refunded."
  @spec refundable_amount(t()) :: Decimal.t()
  def refundable_amount(%__MODULE__{amount: amount, refunded_amount: refunded}),
    do: amount |> Money.sub(refunded) |> Money.clamp_non_negative()

  @doc """
  Change owed on this tender.

  Only cash produces change: handing back the difference on a card payment
  would be giving money away.
  """
  @spec change_due(t()) :: Decimal.t()
  def change_due(%__MODULE__{tendered_amount: nil}), do: Money.zero()

  def change_due(%__MODULE__{} = payment) do
    if cash?(payment) do
      payment.tendered_amount |> Money.sub(payment.amount) |> Money.clamp_non_negative()
    else
      Money.zero()
    end
  end

  # Handing over less than the amount being recorded is not a payment, it is
  # an arithmetic error that would leave the sale looking settled.
  defp validate_tendered_covers_amount(changeset) do
    amount = get_field(changeset, :amount)
    tendered = get_field(changeset, :tendered_amount)

    if amount && tendered && Decimal.compare(tendered, amount) == :lt do
      add_error(changeset, :tendered_amount, "cannot be less than the amount paid")
    else
      changeset
    end
  end

  defp validate_not_over_refunded(changeset) do
    amount = get_field(changeset, :amount)
    refunded = get_field(changeset, :refunded_amount)

    if amount && refunded && Decimal.compare(refunded, amount) == :gt do
      add_error(changeset, :refunded_amount, "would exceed what was paid on this tender")
    else
      changeset
    end
  end
end
