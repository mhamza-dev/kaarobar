defmodule Kaarobar.Payments.Settlement do
  @moduledoc """
  What the gateway actually paid into the bank, against what it says it took.

  The two differ by fees, refunds, chargebacks and timing, and a shop that
  cannot reconcile them cannot tell a fee from a theft. `variance` is the
  number that matters: gross less fees less refunds should equal net, and when
  it does not, somebody needs to know before the month closes.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Money
  alias Kaarobar.Payments.Provider
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(pending paid reconciled disputed)

  schema "settlements" do
    field :external_id, :string
    field :status, :string, default: "pending"

    field :gross_amount, :decimal
    field :fee_amount, :decimal, default: Decimal.new(0)
    field :refund_amount, :decimal, default: Decimal.new(0)
    field :net_amount, :decimal
    field :currency, :string

    field :transaction_count, :integer, default: 0
    field :period_start, :date
    field :period_end, :date
    field :paid_out_at, :utc_datetime_usec

    field :reconciled_at, :utc_datetime_usec
    field :variance, :decimal
    field :notes, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :payment_provider, Provider
    belongs_to :reconciled_by, User

    timestamps()
  end

  @doc "The states a payout moves through."
  def statuses, do: @statuses

  def changeset(settlement, attrs) do
    settlement
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :payment_provider_id,
      :external_id,
      :status,
      :gross_amount,
      :fee_amount,
      :refund_amount,
      :net_amount,
      :currency,
      :transaction_count,
      :period_start,
      :period_end,
      :paid_out_at,
      :notes
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :payment_provider_id,
      :external_id,
      :gross_amount,
      :net_amount,
      :currency
    ])
    |> validate_inclusion(:status, @statuses)
    |> put_variance()
    |> unique_constraint(:external_id,
      name: :settlements_payment_provider_id_external_id_index,
      message: "has already been recorded"
    )
  end

  @doc "Somebody has matched this against the bank."
  def reconcile_changeset(settlement, user_id, notes) do
    change(settlement, %{
      status: "reconciled",
      reconciled_at: DateTime.utc_now(),
      reconciled_by_id: user_id,
      notes: notes
    })
  end

  @doc "True when the arithmetic adds up."
  @spec balanced?(t()) :: boolean()
  def balanced?(%__MODULE__{variance: nil}), do: true
  def balanced?(%__MODULE__{variance: variance}), do: Money.zero?(variance)

  # Gross, less fees, less refunds, should equal net. When it does not, the
  # difference is the thing worth looking at — so it is computed and stored
  # rather than left for somebody to notice.
  defp put_variance(changeset) do
    gross = get_field(changeset, :gross_amount)
    fee = get_field(changeset, :fee_amount) || Money.zero()
    refund = get_field(changeset, :refund_amount) || Money.zero()
    net = get_field(changeset, :net_amount)

    if gross && net do
      expected = gross |> Money.sub(fee) |> Money.sub(refund)
      put_change(changeset, :variance, net |> Money.sub(expected) |> Money.round())
    else
      changeset
    end
  end
end
