defmodule Kaarobar.Finance.BankAccount do
  @moduledoc """
  Somewhere the shop's money sits that is not the till.

  `balance` is a projection: it moves only alongside the row that explains the
  movement, the same shape as stock on hand and a customer's balance. A balance
  that can be set directly is a balance nobody can reconcile.

  The account number is stored as given rather than encrypted. It is printed on
  every cheque the shop writes and read out over the phone to suppliers;
  encrypting it would imply a protection it has never had anywhere else.
  """

  use Kaarobar.Schema

  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "bank_accounts" do
    field :name, :string
    field :bank_name, :string
    field :account_number, :string
    field :iban, :string
    field :currency, :string

    field :balance, :decimal, default: Decimal.new(0)
    field :opening_balance, :decimal, default: Decimal.new(0)

    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    timestamps()
  end

  def changeset(account, attrs) do
    account
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :name,
      :bank_name,
      :account_number,
      :iban,
      :currency,
      :opening_balance,
      :is_active
    ])
    |> validate_required([:organization_id, :business_id, :name, :currency])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 80)
    |> validate_length(:currency, is: 3)
    |> put_opening_balance()
    |> unique_constraint(:name,
      name: :bank_accounts_business_id_name_index,
      message: "is already used by another account"
    )
  end

  @doc "Moves the balance. Only the context that writes the movement calls this."
  def balance_changeset(account, new_balance),
    do: change(account, balance: Money.round(new_balance, account.currency))

  @doc "Soft-deletes the account. Past expenses keep pointing at it."
  def soft_delete_changeset(account), do: change(account, deleted_at: DateTime.utc_now())

  # A new account starts at whatever was already in it. Set once, on creation:
  # editing it afterwards would silently restate every balance since.
  defp put_opening_balance(changeset) do
    case {changeset.data.id, get_change(changeset, :opening_balance)} do
      {nil, opening} when not is_nil(opening) -> put_change(changeset, :balance, opening)
      {nil, nil} -> changeset
      {_existing, _opening} -> delete_change(changeset, :opening_balance)
    end
  end
end
