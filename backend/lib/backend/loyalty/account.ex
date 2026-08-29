defmodule Kaarobar.Loyalty.Account do
  @moduledoc """
  One customer's standing in one programme.

  `points_balance` is a projection of `Kaarobar.Loyalty.Transaction`, maintained
  in the same transaction as the entries that move it — the fifth ledger in the
  system to work this way, and for the same reason: when a customer says their
  points are wrong, the answer is the list of movements, not an apology.

  `lifetime_earned` is kept separately because tiers are earned on what someone
  has ever spent, not on what they have left. Redeeming should not demote you.
  """

  use Kaarobar.Schema

  alias Kaarobar.Customers.Customer
  alias Kaarobar.Loyalty.Program
  alias Kaarobar.Loyalty.Transaction
  alias Kaarobar.Tenancy.Business

  schema "loyalty_accounts" do
    field :points_balance, :integer, default: 0
    field :lifetime_earned, :integer, default: 0
    field :lifetime_redeemed, :integer, default: 0

    field :tier, :string
    field :enrolled_at, :utc_datetime_usec
    field :last_activity_at, :utc_datetime_usec

    belongs_to :business, Business
    belongs_to :loyalty_program, Program
    belongs_to :customer, Customer

    has_many :transactions, Transaction

    timestamps()
  end

  def changeset(account, attrs) do
    account
    |> cast(attrs, [:business_id, :loyalty_program_id, :customer_id, :tier, :enrolled_at])
    |> validate_required([:business_id, :loyalty_program_id, :customer_id])
    |> put_enrolled_at()
    |> unique_constraint(:customer_id,
      name: :loyalty_accounts_program_customer_index,
      message: "is already enrolled in this programme"
    )
    |> foreign_key_constraint(:customer_id)
    |> foreign_key_constraint(:loyalty_program_id)
  end

  @doc """
  Moves the balance, and the lifetime totals with it.

  Only the ledger calls this, alongside writing the transaction that explains
  the move. A balance that could go negative would mean points spent twice, so
  it is refused here as well as by the database.
  """
  def balance_changeset(account, points) do
    balance = account.points_balance + points

    account
    |> change(
      points_balance: balance,
      lifetime_earned: account.lifetime_earned + max(points, 0),
      lifetime_redeemed: account.lifetime_redeemed + max(-points, 0),
      last_activity_at: DateTime.utc_now()
    )
    |> validate_number(:points_balance, greater_than_or_equal_to: 0)
  end

  @doc "True when there are points to spend."
  @spec has_points?(t()) :: boolean()
  def has_points?(%__MODULE__{points_balance: balance}), do: balance > 0
end
