defmodule Kaarobar.Customers.CustomerLedgerEntry do
  @moduledoc """
  One immutable line of what a customer owes.

  Append-only, enforced by a database trigger rather than by convention: the
  reason to keep a ledger at all is that nobody can go back and tidy it. When a
  statement does not add up, `balance_after` shows the row where it stopped
  adding up.

  `amount` is signed — positive increases what the customer owes, negative
  reduces it — so a statement is a running sum with no special cases.
  """

  use Kaarobar.Schema

  alias Kaarobar.Customers.Customer
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @kinds ~w(opening sale payment refund credit_note adjustment)
  # Kinds that increase the debt.
  @debit_kinds ~w(opening sale)

  schema "customer_ledger_entries" do
    field :kind, :string
    field :amount, :decimal
    field :balance_after, :decimal

    field :reference_type, :string
    field :reference_id, Kaarobar.Ecto.UUIDv7

    field :note, :string
    field :occurred_at, :utc_datetime_usec

    field :actor_user_id, Kaarobar.Ecto.UUIDv7
    field :actor_label, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :customer, Customer

    timestamps(updated_at: false)
  end

  @doc "The kinds of entry the ledger records."
  def kinds, do: @kinds

  @doc "The kinds that increase what the customer owes."
  def debit_kinds, do: @debit_kinds

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :customer_id,
      :kind,
      :amount,
      :balance_after,
      :reference_type,
      :reference_id,
      :note,
      :occurred_at,
      :actor_user_id,
      :actor_label
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :customer_id,
      :kind,
      :amount,
      :balance_after,
      :occurred_at
    ])
    |> validate_inclusion(:kind, @kinds)
    |> validate_non_zero_amount()
    |> foreign_key_constraint(:customer_id)
  end

  @doc "True when the entry increases what the customer owes."
  @spec debit?(t()) :: boolean()
  def debit?(%__MODULE__{amount: amount}), do: Decimal.compare(amount, 0) == :gt

  defp validate_non_zero_amount(changeset) do
    case get_field(changeset, :amount) do
      nil ->
        changeset

      amount ->
        if Decimal.compare(amount, 0) == :eq do
          add_error(changeset, :amount, "must not be zero")
        else
          changeset
        end
    end
  end
end
