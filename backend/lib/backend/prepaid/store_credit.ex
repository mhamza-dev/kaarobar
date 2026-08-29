defmodule Kaarobar.Prepaid.StoreCredit do
  @moduledoc """
  Money the shop already took and owes back.

  Almost always the result of a return where the customer did not want cash, or
  did not have the original tender to refund to. It belongs to a named customer
  and does not expire by default — refusing to honour it later is refusing a
  refund, which is a different and worse conversation than the one that created
  it.

  `balance` is a projection of `Kaarobar.Prepaid.StoreCreditTransaction`,
  maintained in the same transaction as the entries that move it.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "store_credits" do
    field :number, :string
    field :currency, :string

    field :issued_amount, :decimal
    field :balance, :decimal

    field :reason, :string
    field :reference_type, :string
    field :reference_id, Kaarobar.Ecto.UUIDv7

    field :issued_at, :utc_datetime_usec
    field :expires_on, :date
    field :voided_at, :utc_datetime_usec
    field :void_reason, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :customer, Customer
    belongs_to :issued_by, User

    timestamps()
  end

  def changeset(credit, attrs) do
    credit
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :customer_id,
      :number,
      :currency,
      :issued_amount,
      :balance,
      :reason,
      :reference_type,
      :reference_id,
      :issued_by_id,
      :issued_at,
      :expires_on
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :customer_id,
      :number,
      :currency,
      :issued_amount,
      :issued_at
    ])
    |> validate_number(:issued_amount, greater_than: 0)
    |> put_initial_balance()
    |> unique_constraint(:number,
      name: :store_credits_business_id_number_index,
      message: "has already been issued"
    )
    |> foreign_key_constraint(:customer_id)
  end

  @doc "Moves the balance. Only the ledger calls this."
  def balance_changeset(credit, new_balance) do
    credit
    |> change(balance: Money.round(new_balance))
    |> validate_number(:balance, greater_than_or_equal_to: 0)
  end

  @doc "Cancels an unspent credit. A reason is required."
  def void_changeset(credit, reason) do
    credit
    |> cast(%{void_reason: reason}, [:void_reason])
    |> validate_required([:void_reason], message: "is required to void store credit")
    |> put_change(:voided_at, DateTime.utc_now())
    |> put_change(:balance, Money.zero())
  end

  @doc """
  True when this credit may be spent today.

  Voided credit and expired credit are both dead, but for different reasons —
  the caller usually wants to say which.
  """
  @spec spendable?(t(), Date.t()) :: boolean()
  def spendable?(%__MODULE__{voided_at: voided}, _today) when not is_nil(voided), do: false

  def spendable?(%__MODULE__{} = credit, today) do
    Money.positive?(credit.balance) and not expired?(credit, today)
  end

  @doc "True when the credit is past its date."
  @spec expired?(t(), Date.t()) :: boolean()
  def expired?(%__MODULE__{expires_on: nil}, _today), do: false
  def expired?(%__MODULE__{expires_on: on}, today), do: Date.compare(on, today) == :lt

  @doc "How much of this credit has been spent."
  @spec spent(t()) :: Decimal.t()
  def spent(%__MODULE__{issued_amount: issued, balance: balance}), do: Money.sub(issued, balance)

  defp put_initial_balance(changeset) do
    case get_field(changeset, :balance) do
      nil -> put_change(changeset, :balance, get_field(changeset, :issued_amount))
      _balance -> changeset
    end
  end
end
