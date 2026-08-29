defmodule Kaarobar.Prepaid.StoreCreditTransaction do
  @moduledoc """
  One immutable movement against a store credit.

  `amount` is signed — positive issues or restores, negative spends — and
  `balance_after` snapshots the running total, so a customer who says their
  credit is short gets the list of movements rather than an assurance.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Prepaid.StoreCredit
  alias Kaarobar.Tenancy.Business

  @kinds ~w(issue redeem refund expire void adjustment)

  schema "store_credit_transactions" do
    field :kind, :string
    field :amount, :decimal
    field :balance_after, :decimal

    field :reference_type, :string
    field :reference_id, Kaarobar.Ecto.UUIDv7
    field :note, :string
    field :occurred_at, :utc_datetime_usec

    belongs_to :business, Business
    belongs_to :store_credit, StoreCredit
    belongs_to :actor_user, User

    timestamps(updated_at: false)
  end

  @doc "The kinds of movement recorded."
  def kinds, do: @kinds

  def changeset(transaction, attrs) do
    transaction
    |> cast(attrs, [
      :business_id,
      :store_credit_id,
      :kind,
      :amount,
      :balance_after,
      :reference_type,
      :reference_id,
      :note,
      :occurred_at,
      :actor_user_id
    ])
    |> validate_required([
      :business_id,
      :store_credit_id,
      :kind,
      :amount,
      :balance_after,
      :occurred_at
    ])
    |> validate_inclusion(:kind, @kinds)
    |> validate_non_zero_amount()
    |> foreign_key_constraint(:store_credit_id)
  end

  @doc "True when this movement took value off the credit."
  @spec spending?(t()) :: boolean()
  def spending?(%__MODULE__{amount: amount}), do: Decimal.compare(amount, 0) == :lt

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
