defmodule Kaarobar.Payments.Intent do
  @moduledoc """
  A request for money that has not yet been answered.

  ## It starts pending and stays there until a webhook says otherwise

  The browser redirect that lands a customer on the success page is a hint, not
  a fact. Customers close tabs, lose signal, and hit back. Treating the
  redirect as proof of payment is how a shop hands over goods for nothing, so
  the intent only moves on a signed callback — or on `fetch_status`, which asks
  the provider directly.

  ## `sale_id` is nullable on purpose

  The intent usually exists before the sale does: money is requested, and the
  sale is written once it is known to have arrived. Requiring a sale up front
  would mean writing one before it is paid for, and then having to unwind it
  when the card declines.

  ## `requires_action` is a state of its own

  A 3-D Secure challenge or a wallet PIN prompt means the *customer* has
  something to do. A till that cannot distinguish that from "waiting on the
  network" either hurries the customer along or gives up on a payment that was
  about to succeed.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Money
  alias Kaarobar.Payments.Provider
  alias Kaarobar.Payments.Transaction
  alias Kaarobar.Sales.Order
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(
    pending processing requires_action authorized captured
    partially_refunded refunded failed cancelled expired
  )
  # States in which the answer is still to come.
  @open_statuses ~w(pending processing requires_action authorized)
  # States in which money has actually moved.
  @settled_statuses ~w(captured partially_refunded refunded)

  schema "payment_intents" do
    field :reference, :string
    field :status, :string, default: "pending"

    field :amount, :decimal
    field :currency, :string
    field :captured_amount, :decimal, default: Decimal.new(0)
    field :refunded_amount, :decimal, default: Decimal.new(0)

    field :external_id, :string
    field :checkout_url, :string
    field :expires_at, :utc_datetime_usec

    field :failure_code, :string
    field :failure_message, :string
    field :metadata, :map, default: %{}

    field :authorized_at, :utc_datetime_usec
    field :captured_at, :utc_datetime_usec
    field :failed_at, :utc_datetime_usec
    field :cancelled_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :payment_provider, Provider
    belongs_to :sale, Sale
    belongs_to :order, Order
    belongs_to :customer, Customer
    belongs_to :created_by, User

    has_many :transactions, Transaction,
      foreign_key: :payment_intent_id,
      preload_order: [asc: :occurred_at]

    timestamps()
  end

  @doc "Every state an intent can be in."
  def statuses, do: @statuses

  @doc "The states in which the answer is still to come."
  def open_statuses, do: @open_statuses

  @doc "The states in which money has actually moved."
  def settled_statuses, do: @settled_statuses

  def changeset(intent, attrs) do
    intent
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :payment_provider_id,
      :sale_id,
      :order_id,
      :customer_id,
      :reference,
      :amount,
      :currency,
      :expires_at,
      :metadata,
      :created_by_id
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :payment_provider_id,
      :reference,
      :amount,
      :currency
    ])
    |> validate_number(:amount, greater_than: 0)
    |> unique_constraint(:reference, name: :payment_intents_business_id_reference_index)
    |> foreign_key_constraint(:payment_provider_id)
  end

  @doc """
  Records what the provider said.

  Statuses only ever move forward: a late "pending" webhook arriving after a
  capture must not un-capture the payment. Gateways do deliver out of order,
  and this is the guard against it.
  """
  def result_changeset(intent, result) do
    next = Kaarobar.Payments.Gateway.intent_status(result.status)

    if regression?(intent.status, next) do
      change(intent, %{})
    else
      intent
      |> change(status: next)
      |> put_external_id(result)
      |> put_optional(:checkout_url, Map.get(result, :checkout_url))
      |> put_optional(:failure_code, Map.get(result, :failure_code))
      |> put_optional(:failure_message, Map.get(result, :failure_message))
      |> stamp(next)
    end
  end

  @doc "Records a capture, in whole or in part."
  def capture_changeset(intent, amount) do
    captured = Money.add(intent.captured_amount, amount)

    intent
    |> change(
      captured_amount: Money.round(captured),
      status: if(Money.zero?(Money.sub(intent.amount, captured)), do: "captured", else: "processing"),
      captured_at: intent.captured_at || DateTime.utc_now()
    )
    |> validate_capture_within_amount()
  end

  @doc "Records a refund, moving the status with it."
  def refund_changeset(intent, amount) do
    refunded = Money.add(intent.refunded_amount, amount)

    status =
      if Decimal.compare(refunded, intent.captured_amount) == :lt,
        do: "partially_refunded",
        else: "refunded"

    intent
    |> change(refunded_amount: Money.round(refunded), status: status)
    |> validate_refund_within_captured()
  end

  @doc "True when the answer is still to come."
  @spec open?(t()) :: boolean()
  def open?(%__MODULE__{status: status}), do: status in @open_statuses

  @doc "True when money has actually moved."
  @spec settled?(t()) :: boolean()
  def settled?(%__MODULE__{status: status}), do: status in @settled_statuses

  @doc "How much of this intent may still be refunded."
  @spec refundable_amount(t()) :: Decimal.t()
  def refundable_amount(%__MODULE__{} = intent),
    do: intent.captured_amount |> Money.sub(intent.refunded_amount) |> Money.clamp_non_negative()

  @doc """
  True when the intent has been waiting long enough to chase.

  Used by the reconciliation job: a webhook that has not arrived in five
  minutes is one that may never arrive, and the till has a customer standing
  in front of it.
  """
  @spec stale?(t(), DateTime.t(), non_neg_integer()) :: boolean()
  def stale?(%__MODULE__{} = intent, now, seconds \\ 300) do
    open?(intent) and DateTime.diff(now, intent.inserted_at, :second) > seconds
  end

  # Gateways deliver out of order. A "pending" arriving after a "captured" is
  # stale news, and applying it would un-capture a payment that succeeded.
  defp regression?(current, next) do
    rank(next) < rank(current)
  end

  defp rank("pending"), do: 0
  defp rank("processing"), do: 1
  defp rank("requires_action"), do: 2
  defp rank("authorized"), do: 3
  defp rank("captured"), do: 4
  defp rank("partially_refunded"), do: 5
  defp rank("refunded"), do: 6
  # Terminal failures outrank everything: once a payment is refused or called
  # off, a late success would be the gateway contradicting itself, and the safe
  # reading is that the money did not move.
  defp rank("failed"), do: 7
  defp rank("cancelled"), do: 7
  defp rank("expired"), do: 7
  defp rank(_other), do: 0

  defp put_external_id(changeset, %{external_id: id}) when is_binary(id),
    do: put_change(changeset, :external_id, id)

  defp put_external_id(changeset, _result), do: changeset

  defp put_optional(changeset, _field, nil), do: changeset
  defp put_optional(changeset, field, value), do: put_change(changeset, field, value)

  defp stamp(changeset, "authorized"),
    do: put_change(changeset, :authorized_at, DateTime.utc_now())

  defp stamp(changeset, "captured"), do: put_change(changeset, :captured_at, DateTime.utc_now())
  defp stamp(changeset, "failed"), do: put_change(changeset, :failed_at, DateTime.utc_now())

  defp stamp(changeset, "cancelled"),
    do: put_change(changeset, :cancelled_at, DateTime.utc_now())

  defp stamp(changeset, _status), do: changeset

  defp validate_capture_within_amount(changeset) do
    amount = get_field(changeset, :amount)
    captured = get_field(changeset, :captured_amount)

    if amount && captured && Decimal.compare(captured, amount) == :gt do
      add_error(changeset, :captured_amount, "cannot exceed the amount requested")
    else
      changeset
    end
  end

  defp validate_refund_within_captured(changeset) do
    captured = get_field(changeset, :captured_amount)
    refunded = get_field(changeset, :refunded_amount)

    if captured && refunded && Decimal.compare(refunded, captured) == :gt do
      add_error(changeset, :refunded_amount, "cannot exceed what was captured")
    else
      changeset
    end
  end
end
