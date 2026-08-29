defmodule Kaarobar.Purchasing.SupplierBill do
  @moduledoc """
  An invoice received from a supplier.

  Separate from the goods receipt because suppliers invoice on their own
  schedule: one invoice may cover three deliveries, and one delivery may be
  invoiced twice by mistake. Treating the receipt as the invoice makes both of
  those unrepresentable, and the shop finds out by paying for something twice.

  The unique index on `(supplier_id, supplier_invoice_number)` is the guard
  against exactly that — the single most common way a small business pays an
  invoice it has already paid.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Money
  alias Kaarobar.Purchasing.GoodsReceipt
  alias Kaarobar.Purchasing.PurchaseOrder
  alias Kaarobar.Purchasing.Supplier
  alias Kaarobar.Purchasing.SupplierBillItem
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(draft posted partially_paid paid cancelled)

  schema "supplier_bills" do
    field :number, :string
    field :supplier_invoice_number, :string
    field :status, :string, default: "draft"

    field :issued_on, :date
    field :due_on, :date

    field :currency, :string
    field :exchange_rate, :decimal, default: Decimal.new(1)

    field :subtotal, :decimal, default: Decimal.new(0)
    field :discount_total, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :shipping_total, :decimal, default: Decimal.new(0)
    field :total, :decimal, default: Decimal.new(0)
    field :paid_total, :decimal, default: Decimal.new(0)

    field :notes, :string
    field :posted_at, :utc_datetime_usec
    field :cancelled_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :supplier, Supplier
    belongs_to :goods_receipt, GoodsReceipt
    belongs_to :purchase_order, PurchaseOrder
    belongs_to :created_by, User

    has_many :items, SupplierBillItem, preload_order: [asc: :position]

    timestamps()
  end

  @doc "The states a bill moves through."
  def statuses, do: @statuses

  def changeset(bill, attrs) do
    bill
    |> cast(attrs, [
      :supplier_id,
      :goods_receipt_id,
      :purchase_order_id,
      :supplier_invoice_number,
      :issued_on,
      :due_on,
      :currency,
      :exchange_rate,
      :shipping_total,
      :discount_total,
      :notes
    ])
    |> validate_required([:supplier_id, :issued_on, :currency])
    |> validate_format(:currency, ~r/^[A-Z]{3}$/,
      message: "must be a three-letter ISO 4217 code"
    )
    |> validate_number(:exchange_rate, greater_than: 0)
    |> validate_number(:shipping_total, greater_than_or_equal_to: 0)
    |> validate_due_date()
    |> unique_constraint([:business_id, :number], message: "is already used")
    |> unique_constraint([:supplier_id, :supplier_invoice_number],
      name: :supplier_bills_unique_supplier_invoice_index,
      message: "has already been entered for this supplier"
    )
    |> foreign_key_constraint(:supplier_id)
  end

  @doc "Changeset for posting: the debt becomes real and hits the ledger."
  def post_changeset(bill, totals) do
    change(bill, %{
      status: "posted",
      posted_at: DateTime.utc_now(),
      subtotal: totals.subtotal,
      tax_total: totals.tax_total,
      total: totals.total
    })
  end

  @doc "Changeset recording a further payment against this bill."
  def payment_changeset(bill, amount) do
    paid = Money.add(bill.paid_total, amount)

    change(bill, paid_total: paid, status: payment_status(bill, paid))
  end

  @doc "Changeset for cancelling."
  def cancel_changeset(bill) do
    change(bill, status: "cancelled", cancelled_at: DateTime.utc_now())
  end

  @doc "What is still owed on this bill."
  @spec outstanding(t()) :: Decimal.t()
  def outstanding(%__MODULE__{total: total, paid_total: paid}),
    do: total |> Money.sub(paid) |> Money.clamp_non_negative()

  @doc "True when the bill is settled."
  @spec settled?(t()) :: boolean()
  def settled?(%__MODULE__{} = bill), do: Money.zero?(outstanding(bill))

  @doc """
  True when the bill is past the terms agreed with this supplier.

  A bill is not overdue because it is old, but because it is older than what
  was agreed — which is why `due_on` is stored rather than inferred from age.
  """
  @spec overdue?(t(), Date.t()) :: boolean()
  def overdue?(%__MODULE__{due_on: nil}, _today), do: false

  def overdue?(%__MODULE__{due_on: due_on} = bill, today),
    do: not settled?(bill) and Date.compare(today, due_on) == :gt

  @doc "True when it may still be edited."
  def editable?(%__MODULE__{status: "draft"}), do: true
  def editable?(%__MODULE__{}), do: false

  defp payment_status(%__MODULE__{total: total}, paid) do
    cond do
      Decimal.compare(paid, total) != :lt -> "paid"
      Money.positive?(paid) -> "partially_paid"
      true -> "posted"
    end
  end

  defp validate_due_date(changeset) do
    issued = get_field(changeset, :issued_on)
    due = get_field(changeset, :due_on)

    if issued && due && Date.compare(due, issued) == :lt do
      add_error(changeset, :due_on, "must be on or after the issue date")
    else
      changeset
    end
  end
end
