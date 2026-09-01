defmodule Kaarobar.Reports.ProductDailyRollup do
  @moduledoc """
  One product's day at one branch.

  Keyed on the variant, because that is what a sale line references and what a
  shop actually counts: "we sold eleven of the large blue" is the answer, and
  "we sold thirty-one shirts" is a roll-up of it.

  `category_id` is denormalised so a report by category does not have to join
  through the product to the category on every row of a year.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.Category
  alias Kaarobar.Catalog.Product
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "product_daily_rollups" do
    field :day, :date

    field :quantity, :decimal, default: Decimal.new(0)
    field :refunded_quantity, :decimal, default: Decimal.new(0)
    field :net_sales, :decimal, default: Decimal.new(0)
    field :discount_total, :decimal, default: Decimal.new(0)
    field :cost_total, :decimal, default: Decimal.new(0)

    field :computed_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :variant, ProductVariant
    belongs_to :product, Product
    belongs_to :category, Category

    timestamps()
  end

  def changeset(rollup, attrs) do
    rollup
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :variant_id,
      :product_id,
      :category_id,
      :day,
      :quantity,
      :refunded_quantity,
      :net_sales,
      :discount_total,
      :cost_total
    ])
    |> validate_required([:organization_id, :business_id, :branch_id, :variant_id, :day])
    |> put_change(:computed_at, DateTime.utc_now())
    |> unique_constraint(:variant_id,
      name: :product_daily_rollups_branch_variant_day_index,
      message: "has already been rolled up for this day"
    )
  end

  @doc "What this product made after what it cost."
  @spec margin(t()) :: Decimal.t()
  def margin(%__MODULE__{} = rollup), do: Money.sub(rollup.net_sales, rollup.cost_total)

  @doc "Units that stayed sold."
  @spec net_quantity(t()) :: Decimal.t()
  def net_quantity(%__MODULE__{} = rollup),
    do: rollup.quantity |> Money.sub(rollup.refunded_quantity) |> Money.clamp_non_negative()
end
