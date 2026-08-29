defmodule Kaarobar.Purchasing.GoodsReceipt do
  @moduledoc """
  What actually turned up.

  Separate from the purchase order because deliveries are: a supplier sends
  eighty of the hundred ordered, the rest a fortnight later, and two arrive
  broken. Recording that as an edit to the order would lose the history of what
  arrived and when — which is the only evidence a shop has when a supplier
  disputes an invoice.

  `purchase_order_id` is nullable. Goods do turn up without an order behind
  them, and refusing to book them in means they get sold off a stock level that
  says zero.

  Posting is the moment stock moves. A draft receipt changes nothing, which is
  what lets someone key a delivery in over the course of an afternoon.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Purchasing.GoodsReceiptItem
  alias Kaarobar.Purchasing.PurchaseOrder
  alias Kaarobar.Purchasing.Supplier
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(draft posted cancelled)

  schema "goods_receipts" do
    field :number, :string
    field :status, :string, default: "draft"

    field :received_on, :date
    field :supplier_reference, :string

    field :subtotal, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :shipping_total, :decimal, default: Decimal.new(0)
    field :total, :decimal, default: Decimal.new(0)

    field :notes, :string
    field :posted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :purchase_order, PurchaseOrder
    belongs_to :supplier, Supplier
    belongs_to :received_by, User

    has_many :items, GoodsReceiptItem, preload_order: [asc: :position]

    timestamps()
  end

  @doc "The states a receipt may be in."
  def statuses, do: @statuses

  def changeset(receipt, attrs) do
    receipt
    |> cast(attrs, [
      :branch_id,
      :supplier_id,
      :purchase_order_id,
      :received_on,
      :supplier_reference,
      :shipping_total,
      :notes
    ])
    |> validate_required([:branch_id, :supplier_id, :received_on])
    |> validate_number(:shipping_total, greater_than_or_equal_to: 0)
    |> validate_length(:supplier_reference, max: 64)
    |> validate_length(:notes, max: 2000)
    |> unique_constraint(:number, name: :goods_receipts_business_id_number_index, message: "is already used")
    |> foreign_key_constraint(:supplier_id)
    |> foreign_key_constraint(:branch_id)
  end

  @doc "Changeset for posting: stock is about to move."
  def post_changeset(receipt, totals) do
    change(receipt, %{
      status: "posted",
      posted_at: DateTime.utc_now(),
      subtotal: totals.subtotal,
      tax_total: totals.tax_total,
      total: totals.total
    })
  end

  @doc "True when lines may still be edited."
  def editable?(%__MODULE__{status: "draft"}), do: true
  def editable?(%__MODULE__{}), do: false

  @doc "True when this receipt has moved stock."
  def posted?(%__MODULE__{status: "posted"}), do: true
  def posted?(%__MODULE__{}), do: false
end
