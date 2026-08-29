defmodule Kaarobar.Purchasing.SupplierPayment do
  @moduledoc """
  Money paid to a supplier.

  `unallocated_amount` is the part not yet matched to a bill — money on
  account. That is a real and common state: a shop pays a round 50,000 against
  a running balance and the bookkeeper decides later which invoices it clears.
  Forcing every payment to name its bills at the moment it is made means
  someone guesses, and the ageing report is wrong from then on.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Money
  alias Kaarobar.Purchasing.Supplier
  alias Kaarobar.Purchasing.SupplierPaymentAllocation
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @methods ~w(cash bank_transfer cheque card wallet other)

  schema "supplier_payments" do
    field :number, :string
    field :method, :string, default: "cash"

    field :amount, :decimal
    field :unallocated_amount, :decimal, default: Decimal.new(0)

    field :currency, :string
    field :exchange_rate, :decimal, default: Decimal.new(1)

    field :paid_on, :date
    field :reference, :string
    field :notes, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :supplier, Supplier
    belongs_to :created_by, User

    has_many :allocations, SupplierPaymentAllocation

    timestamps()
  end

  @doc "How a supplier may be paid."
  def methods, do: @methods

  def changeset(payment, attrs) do
    payment
    |> cast(attrs, [
      :supplier_id,
      :branch_id,
      :method,
      :amount,
      :currency,
      :exchange_rate,
      :paid_on,
      :reference,
      :notes
    ])
    |> validate_required([:supplier_id, :method, :amount, :currency, :paid_on])
    |> validate_inclusion(:method, @methods)
    |> validate_number(:amount, greater_than: 0)
    |> validate_number(:exchange_rate, greater_than: 0)
    |> validate_format(:currency, ~r/^[A-Z]{3}$/,
      message: "must be a three-letter ISO 4217 code"
    )
    |> validate_length(:reference, max: 120)
    |> unique_constraint([:business_id, :number], message: "is already used")
    |> foreign_key_constraint(:supplier_id)
  end

  @doc "Changeset reducing what is left on account after an allocation."
  def allocate_changeset(payment, amount) do
    payment
    |> change(unallocated_amount: Money.sub(payment.unallocated_amount, amount))
    |> validate_number(:unallocated_amount, greater_than_or_equal_to: 0)
  end

  @doc "True when none of this payment has been matched to a bill yet."
  @spec fully_unallocated?(t()) :: boolean()
  def fully_unallocated?(%__MODULE__{amount: amount, unallocated_amount: unallocated}),
    do: Decimal.compare(amount, unallocated) == :eq

  @doc "How much of this payment is still sitting on account."
  @spec on_account(t()) :: Decimal.t()
  def on_account(%__MODULE__{unallocated_amount: unallocated}), do: unallocated
end
