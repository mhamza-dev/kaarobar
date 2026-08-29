defmodule Kaarobar.Customers.CustomerPayment do
  @moduledoc """
  A customer settling part or all of what they owe.

  Distinct from a `Kaarobar.Sales.Payment`, which pays for one particular sale.
  This is money against the account: a wholesale customer paying off six weeks
  of invoices at once, which is how most credit is actually collected.

  `shift_id` is set when the money was taken at a till, so it lands in that
  drawer's count. Collected in the back office, it does not.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @methods ~w(cash card bank_transfer wallet cheque other)
  # Methods that put money in the drawer, and so affect a shift's cash count.
  @cash_methods ~w(cash)

  schema "customer_payments" do
    field :number, :string
    field :method, :string, default: "cash"
    field :amount, :decimal

    field :paid_on, :date
    field :reference, :string
    field :notes, :string

    field :shift_id, Kaarobar.Ecto.UUIDv7

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :customer, Customer
    belongs_to :created_by, User

    timestamps()
  end

  @doc "The ways a customer may settle their account."
  def methods, do: @methods

  def changeset(payment, attrs) do
    payment
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :customer_id,
      :number,
      :method,
      :amount,
      :paid_on,
      :reference,
      :notes,
      :created_by_id,
      :shift_id
    ])
    |> validate_required([:organization_id, :business_id, :customer_id, :number, :amount])
    |> validate_inclusion(:method, @methods)
    |> validate_number(:amount, greater_than: 0)
    |> put_default_paid_on()
    |> unique_constraint([:business_id, :number],
      name: :customer_payments_business_id_number_index
    )
    |> foreign_key_constraint(:customer_id)
  end

  @doc "True when this payment put money in a drawer."
  @spec cash?(t()) :: boolean()
  def cash?(%__MODULE__{method: method}), do: method in @cash_methods

  defp put_default_paid_on(changeset) do
    case get_field(changeset, :paid_on) do
      nil -> put_change(changeset, :paid_on, Date.utc_today())
      _date -> changeset
    end
  end
end
