defmodule Kaarobar.Purchasing.PurchaseReturn do
  @moduledoc """
  Goods sent back to a supplier.

  Posting removes the stock and credits the supplier ledger in one transaction.
  The two have to move together: stock that left the shop but is still owed for
  shows up as a loss, and a credit against stock still on the shelf shows up as
  a windfall.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Purchasing.GoodsReceipt
  alias Kaarobar.Purchasing.PurchaseReturnItem
  alias Kaarobar.Purchasing.Supplier
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(draft posted cancelled)

  schema "purchase_returns" do
    field :number, :string
    field :status, :string, default: "draft"
    field :reason, :string

    field :returned_on, :date
    field :subtotal, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :total, :decimal, default: Decimal.new(0)

    field :notes, :string
    field :posted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :supplier, Supplier
    belongs_to :goods_receipt, GoodsReceipt
    belongs_to :created_by, User

    has_many :items, PurchaseReturnItem, preload_order: [asc: :position]

    timestamps()
  end

  @doc "The states a return may be in."
  def statuses, do: @statuses

  def changeset(purchase_return, attrs) do
    purchase_return
    |> cast(attrs, [
      :branch_id,
      :supplier_id,
      :goods_receipt_id,
      :reason,
      :returned_on,
      :notes
    ])
    |> validate_required([:branch_id, :supplier_id, :returned_on])
    |> validate_length(:reason, max: 200)
    |> validate_length(:notes, max: 2000)
    |> unique_constraint([:business_id, :number], message: "is already used")
    |> foreign_key_constraint(:supplier_id)
  end

  @doc "Changeset for posting: stock leaves and the supplier is credited."
  def post_changeset(purchase_return, totals) do
    change(purchase_return, %{
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
end
