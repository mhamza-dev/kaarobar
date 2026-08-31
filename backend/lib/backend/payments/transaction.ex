defmodule Kaarobar.Payments.Transaction do
  @moduledoc """
  One thing the gateway actually did.

  An intent may have several: a declined card retried, a 3-D Secure challenge,
  a customer who tries a second card. Collapsing them into a single status
  loses exactly the history a chargeback dispute is argued with.

  `raw_response` keeps the provider's payload whole. When a dispute turns on
  what the gateway actually said, a parsed subset of it is not enough — and the
  fields worth having are rarely the ones anyone thought to extract.
  """

  use Kaarobar.Schema

  alias Kaarobar.Money
  alias Kaarobar.Payments.Intent
  alias Kaarobar.Tenancy.Business

  @kinds ~w(authorize capture sale refund void chargeback payout)
  @statuses ~w(pending succeeded failed)

  schema "gateway_transactions" do
    field :kind, :string
    field :status, :string
    field :amount, :decimal
    field :currency, :string

    field :external_id, :string
    field :provider_status, :string
    field :failure_code, :string
    field :failure_message, :string

    field :fee_amount, :decimal
    field :net_amount, :decimal

    field :card_last_four, :string
    field :card_scheme, :string
    field :wallet_msisdn, :string

    field :raw_response, :map
    field :occurred_at, :utc_datetime_usec

    belongs_to :business, Business
    belongs_to :payment_intent, Intent

    timestamps(updated_at: false)
  end

  @doc "The things a gateway can do."
  def kinds, do: @kinds

  @doc "How each of them can turn out."
  def statuses, do: @statuses

  def changeset(transaction, attrs) do
    transaction
    |> cast(attrs, [
      :business_id,
      :payment_intent_id,
      :kind,
      :status,
      :amount,
      :currency,
      :external_id,
      :provider_status,
      :failure_code,
      :failure_message,
      :fee_amount,
      :raw_response,
      :card_last_four,
      :card_scheme,
      :wallet_msisdn,
      :occurred_at
    ])
    |> validate_required([:business_id, :payment_intent_id, :kind, :status, :amount, :currency])
    |> validate_inclusion(:kind, @kinds)
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:amount, greater_than_or_equal_to: 0)
    |> put_occurred_at()
    |> put_net_amount()
    |> foreign_key_constraint(:payment_intent_id)
  end

  @doc "True when the money moved."
  @spec succeeded?(t()) :: boolean()
  def succeeded?(%__MODULE__{status: "succeeded"}), do: true
  def succeeded?(%__MODULE__{}), do: false

  # Net is what actually reaches the bank. A shop that only tracks gross can
  # never make its statement agree with its takings, because the difference is
  # the fee and nobody wrote it down.
  defp put_net_amount(changeset) do
    amount = get_field(changeset, :amount)
    fee = get_field(changeset, :fee_amount)

    if amount && fee do
      put_change(changeset, :net_amount, amount |> Money.sub(fee) |> Money.round())
    else
      changeset
    end
  end

  defp put_occurred_at(changeset) do
    case get_field(changeset, :occurred_at) do
      nil -> put_change(changeset, :occurred_at, DateTime.utc_now())
      _set -> changeset
    end
  end
end
