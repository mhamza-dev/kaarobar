defmodule Kaarobar.Purchasing.SupplierLedgerEntry do
  @moduledoc """
  One immutable line of what the shop owes a supplier.

  The mirror of the customer ledger, and append-only for the same reason: a
  statement that does not add up should show the row where it stopped adding
  up. `amount` is signed — positive increases the debt, negative reduces it —
  and `balance_after` snapshots the running total.
  """

  use Kaarobar.Schema

  alias Kaarobar.Purchasing.Supplier
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @kinds ~w(opening bill payment credit_note adjustment)

  schema "supplier_ledger_entries" do
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
    belongs_to :supplier, Supplier

    timestamps(updated_at: false)
  end

  @doc "The kinds of entry the ledger records."
  def kinds, do: @kinds

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :supplier_id,
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
      :supplier_id,
      :kind,
      :amount,
      :balance_after,
      :occurred_at
    ])
    |> validate_inclusion(:kind, @kinds)
    |> validate_non_zero_amount()
    |> foreign_key_constraint(:supplier_id)
  end

  @doc "True when the entry increases what is owed."
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
