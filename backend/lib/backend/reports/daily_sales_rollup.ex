defmodule Kaarobar.Reports.DailySalesRollup do
  @moduledoc """
  One finished trading day at one branch, already added up.

  A cache with a rebuild button, never a source of truth. Every figure here can
  be recomputed from `sales` and `sale_items`, which is what makes it safe to
  throw away when a sale is voided a week after the fact.

  `computed_at` is how that is noticed: a rollup older than the newest change
  to the day it summarises is a rollup to rebuild.
  """

  use Kaarobar.Schema

  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "daily_sales_rollups" do
    field :day, :date

    field :sale_count, :integer, default: 0
    field :item_count, :decimal, default: Decimal.new(0)
    field :customer_count, :integer, default: 0

    field :gross_sales, :decimal, default: Decimal.new(0)
    field :discount_total, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :net_sales, :decimal, default: Decimal.new(0)
    field :refund_total, :decimal, default: Decimal.new(0)
    field :cost_total, :decimal, default: Decimal.new(0)

    field :tender_totals, :map, default: %{}
    field :voided_count, :integer, default: 0
    field :computed_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch

    timestamps()
  end

  def changeset(rollup, attrs) do
    rollup
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :day,
      :sale_count,
      :item_count,
      :customer_count,
      :gross_sales,
      :discount_total,
      :tax_total,
      :net_sales,
      :refund_total,
      :cost_total,
      :tender_totals,
      :voided_count
    ])
    |> validate_required([:organization_id, :business_id, :branch_id, :day])
    |> put_change(:computed_at, DateTime.utc_now())
    |> unique_constraint(:day,
      name: :daily_sales_rollups_branch_id_day_index,
      message: "has already been rolled up for this branch"
    )
  end

  @doc """
  What the shop kept on the day, before its own costs.

  Net of refunds and of what the goods cost. Operating expenses are subtracted
  further up, in `Kaarobar.Reports`, because they are not per-branch-per-day.
  """
  @spec gross_profit(t()) :: Decimal.t()
  def gross_profit(%__MODULE__{} = rollup) do
    rollup.net_sales
    |> Money.sub(rollup.refund_total)
    |> Money.sub(rollup.cost_total)
  end

  @doc "Average sale value, or zero on a day with no sales."
  @spec average_sale(t()) :: Decimal.t()
  def average_sale(%__MODULE__{sale_count: 0}), do: Money.zero()

  def average_sale(%__MODULE__{} = rollup),
    do: rollup.net_sales |> Money.div(rollup.sale_count) |> Money.round()
end
