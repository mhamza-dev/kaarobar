defmodule Kaarobar.Purchasing.PurchaseOrder do
  @moduledoc """
  An order placed with a supplier.

  Records intent. It moves no stock — it increments `incoming` on the stock
  items so the shop can see what is on its way, and that is all. Stock arrives
  through `Kaarobar.Purchasing.GoodsReceipt`, priced at what was actually
  charged rather than what was quoted.

  Status is driven by receipts rather than set by hand: an order becomes
  `partially_received` or `received` because deliveries arrived against it, so
  the status can never disagree with the lines.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Money
  alias Kaarobar.Purchasing.PurchaseOrderItem
  alias Kaarobar.Purchasing.Supplier
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(draft awaiting_approval approved sent partially_received received cancelled closed)
  # Statuses where stock is genuinely expected, so `incoming` should count it.
  @open_statuses ~w(approved sent partially_received)

  schema "purchase_orders" do
    field :number, :string
    field :status, :string, default: "draft"

    field :ordered_on, :date
    field :expected_on, :date

    field :currency, :string
    field :exchange_rate, :decimal, default: Decimal.new(1)

    field :subtotal, :decimal, default: Decimal.new(0)
    field :discount_total, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :shipping_total, :decimal, default: Decimal.new(0)
    field :total, :decimal, default: Decimal.new(0)

    field :reference, :string
    field :notes, :string

    field :approved_at, :utc_datetime_usec
    field :cancelled_at, :utc_datetime_usec
    field :closed_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :supplier, Supplier
    belongs_to :created_by, User
    belongs_to :approved_by, User

    has_many :items, PurchaseOrderItem, preload_order: [asc: :position]

    timestamps()
  end

  @doc "The states a purchase order moves through."
  def statuses, do: @statuses

  @doc "States in which stock is genuinely expected to arrive."
  def open_statuses, do: @open_statuses

  def changeset(order, attrs) do
    order
    |> cast(attrs, [
      :branch_id,
      :supplier_id,
      :ordered_on,
      :expected_on,
      :currency,
      :exchange_rate,
      :shipping_total,
      :reference,
      :notes
    ])
    |> validate_required([:branch_id, :supplier_id, :currency])
    |> validate_format(:currency, ~r/^[A-Z]{3}$/,
      message: "must be a three-letter ISO 4217 code"
    )
    |> validate_number(:exchange_rate, greater_than: 0)
    |> validate_number(:shipping_total, greater_than_or_equal_to: 0)
    |> validate_dates()
    |> validate_length(:notes, max: 2000)
    |> unique_constraint([:business_id, :number], message: "is already used")
    |> foreign_key_constraint(:supplier_id)
    |> foreign_key_constraint(:branch_id)
  end

  @doc "Changeset applying recomputed totals."
  def totals_changeset(order, totals) do
    change(order, %{
      subtotal: totals.subtotal,
      discount_total: totals.discount_total,
      tax_total: totals.tax_total,
      total: totals.total
    })
  end

  @doc """
  Changeset for approving an order.

  Approval is the point the exchange rate is locked and stock becomes expected;
  before it, an order is a wish list.
  """
  def approve_changeset(order, user_id) do
    change(order,
      status: "approved",
      approved_at: DateTime.utc_now(),
      approved_by_id: user_id,
      ordered_on: order.ordered_on || Date.utc_today()
    )
  end

  @doc "Changeset for a status driven by what has been received."
  def status_changeset(order, status) when status in @statuses do
    change(order, status: status)
  end

  @doc "Changeset for cancelling."
  def cancel_changeset(order) do
    change(order, status: "cancelled", cancelled_at: DateTime.utc_now())
  end

  @doc """
  Changeset for closing an order short.

  A supplier who is never going to send the last twelve units leaves an order
  that would otherwise sit open forever, holding phantom `incoming` stock
  against every reorder calculation.
  """
  def close_changeset(order) do
    change(order, status: "closed", closed_at: DateTime.utc_now())
  end

  @doc "True when lines may still be changed."
  def editable?(%__MODULE__{status: status}), do: status in ["draft", "awaiting_approval"]

  @doc "True when goods may still be received against this order."
  def receivable?(%__MODULE__{status: status}),
    do: status in ["approved", "sent", "partially_received"]

  @doc "The status implied by how much of the order has arrived."
  @spec status_from_items([PurchaseOrderItem.t()], String.t()) :: String.t()
  def status_from_items(items, current_status) do
    cond do
      Enum.all?(items, &PurchaseOrderItem.fully_received?/1) -> "received"
      Enum.any?(items, &Money.positive?(&1.received_quantity)) -> "partially_received"
      true -> current_status
    end
  end

  defp validate_dates(changeset) do
    ordered = get_field(changeset, :ordered_on)
    expected = get_field(changeset, :expected_on)

    if ordered && expected && Date.compare(expected, ordered) == :lt do
      add_error(changeset, :expected_on, "must be on or after the order date")
    else
      changeset
    end
  end
end
