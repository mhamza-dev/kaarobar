defmodule Kaarobar.Sales.SaleReturn do
  @moduledoc """
  Goods coming back, and money going out.

  A return never edits the sale it came from. The original stays exactly as it
  was rung, and this record sits beside it — which is the only arrangement an
  auditor can work with, and the only one that lets a shop prove what it
  actually charged.

  `cost_total` mirrors the sale's: taking back stock at today's cost would
  restate the margin on a sale made months ago.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Registers.Register
  alias Kaarobar.Registers.Shift
  alias Kaarobar.Sales.RefundRequest
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Sales.SaleReturnItem
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "sale_returns" do
    field :number, :string
    field :reason, :string

    field :subtotal, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :total, :decimal, default: Decimal.new(0)
    field :cost_total, :decimal, default: Decimal.new(0)

    field :processed_by_label, :string
    field :returned_at, :utc_datetime_usec
    field :notes, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :register, Register
    belongs_to :shift, Shift
    belongs_to :sale, Sale
    belongs_to :customer, Customer
    belongs_to :refund_request, RefundRequest
    belongs_to :processed_by, User

    has_many :items, SaleReturnItem, preload_order: [asc: :position]

    timestamps()
  end

  def changeset(sale_return, attrs) do
    sale_return
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :register_id,
      :shift_id,
      :sale_id,
      :customer_id,
      :refund_request_id,
      :number,
      :reason,
      :subtotal,
      :tax_total,
      :total,
      :cost_total,
      :processed_by_id,
      :processed_by_label,
      :returned_at,
      :notes
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :branch_id,
      :sale_id,
      :number,
      :total,
      :returned_at
    ])
    |> validate_number(:total, greater_than_or_equal_to: 0)
    |> unique_constraint([:business_id, :number],
      name: :sale_returns_business_id_number_index
    )
    |> foreign_key_constraint(:sale_id)
  end

  @doc "The loss or gain given up by taking these goods back."
  @spec margin_reversed(t()) :: Decimal.t()
  def margin_reversed(%__MODULE__{subtotal: subtotal, cost_total: cost}),
    do: Kaarobar.Money.sub(subtotal, cost)
end
