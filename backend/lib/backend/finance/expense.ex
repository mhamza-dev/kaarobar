defmodule Kaarobar.Finance.Expense do
  @moduledoc """
  Money leaving the business that is not a payment to a supplier for stock.

  Rent, wages, electricity, repairs, the tea for the counter. Supplier bills
  have their own ledger in `Kaarobar.Purchasing`, because what is owed to a
  supplier is a running account and an expense is a single settled fact.

  ## `spent_on` is not `inserted_at`

  The bill paid on the 2nd for last month's electricity is last month's cost.
  Reporting reads the date the money belongs to; the audit trail reads the date
  it was typed in. Conflating them puts a shop's costs in the wrong month every
  time somebody catches up on paperwork.

  ## Approval is optional and off by default

  Most shops have one person who spends and the same person who records it, and
  making them approve their own entry is theatre. `pending` exists for the
  shops that do separate the two, and `approved_at` is enforced by the database
  so an approved expense always says when.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Finance.BankAccount
  alias Kaarobar.Finance.Category
  alias Kaarobar.Money
  alias Kaarobar.Purchasing.Supplier
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(pending recorded approved rejected)
  @methods ~w(cash card bank cheque wallet other)
  # The states in which the money is treated as actually spent.
  @counted ~w(recorded approved)

  schema "expenses" do
    field :number, :string
    field :description, :string
    field :amount, :decimal
    field :tax_amount, :decimal, default: Decimal.new(0)
    field :currency, :string

    field :method, :string, default: "cash"
    field :reference, :string
    field :spent_on, :date

    field :status, :string, default: "recorded"
    field :approved_at, :utc_datetime_usec

    field :notes, :string
    field :attachment_path, :string
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :expense_category, Category
    belongs_to :bank_account, BankAccount
    belongs_to :supplier, Supplier
    belongs_to :approved_by, User
    belongs_to :recorded_by, User

    timestamps()
  end

  @doc "Every state an expense may be in."
  def statuses, do: @statuses

  @doc "How the money left."
  def methods, do: @methods

  @doc "The states in which an expense counts against profit."
  def counted_statuses, do: @counted

  def changeset(expense, attrs) do
    expense
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :expense_category_id,
      :bank_account_id,
      :supplier_id,
      :recorded_by_id,
      :number,
      :description,
      :amount,
      :tax_amount,
      :currency,
      :method,
      :reference,
      :spent_on,
      :status,
      :notes,
      :attachment_path
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :expense_category_id,
      :number,
      :description,
      :amount,
      :currency,
      :spent_on
    ])
    |> update_change(:description, &String.trim/1)
    |> validate_length(:description, min: 1, max: 200)
    |> validate_number(:amount, greater_than: 0)
    |> validate_number(:tax_amount, greater_than_or_equal_to: 0)
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:method, @methods)
    |> validate_not_future()
    |> unique_constraint(:number,
      name: :expenses_business_id_number_index,
      message: "has already been issued"
    )
    |> foreign_key_constraint(:expense_category_id)
    |> foreign_key_constraint(:bank_account_id)
  end

  @doc "Approves the expense, recording who and when."
  def approve_changeset(expense, user_id) do
    change(expense, %{
      status: "approved",
      approved_by_id: user_id,
      approved_at: DateTime.utc_now()
    })
  end

  @doc """
  Rejects the expense.

  Kept rather than deleted: "this was refused" is a different fact from "this
  never happened", and the person who submitted it is entitled to see which.
  """
  def reject_changeset(expense, user_id) do
    change(expense, %{
      status: "rejected",
      approved_by_id: user_id,
      approved_at: DateTime.utc_now()
    })
  end

  @doc "Soft-deletes the expense, keeping it out of every total."
  def soft_delete_changeset(expense), do: change(expense, deleted_at: DateTime.utc_now())

  @doc "What this expense costs in total, tax included."
  @spec gross(t()) :: Decimal.t()
  def gross(%__MODULE__{amount: amount, tax_amount: tax}), do: Money.add(amount, tax || Money.zero())

  @doc "True when this expense should be subtracted from profit."
  @spec counts?(t()) :: boolean()
  def counts?(%__MODULE__{deleted_at: at}) when not is_nil(at), do: false
  def counts?(%__MODULE__{status: status}), do: status in @counted

  @doc "True when the money has left a bank account rather than the till."
  @spec from_bank?(t()) :: boolean()
  def from_bank?(%__MODULE__{bank_account_id: nil}), do: false
  def from_bank?(%__MODULE__{}), do: true

  # A cost dated next month is a typo, and it would sit in a future period
  # nobody looks at until it quietly appears in a month that had already been
  # reported on.
  defp validate_not_future(changeset) do
    validate_change(changeset, :spent_on, fn :spent_on, spent_on ->
      if Date.compare(spent_on, Date.utc_today()) == :gt do
        [spent_on: "cannot be in the future"]
      else
        []
      end
    end)
  end
end
