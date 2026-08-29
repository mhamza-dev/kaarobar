defmodule Kaarobar.Inventory.StockItem do
  @moduledoc """
  How much of one variant is at one branch.

  A **projection**, not a record. `on_hand` is derived from `stock_moves` and
  maintained in the same transaction as the move that changed it. Nothing
  outside `Kaarobar.Inventory.Ledger` may write it: the moment the projection
  and the ledger disagree, only one of them can be shown to an auditor, and it
  will not be this one.

  `available/1` — `on_hand` less `reserved` — is the number a cashier should
  actually be stopped by. Stock promised to an open restaurant ticket is
  physically present and not for sale, and a till that only checks `on_hand`
  will happily sell the same last unit twice.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "stock_items" do
    field :on_hand, :decimal, default: Decimal.new(0)
    field :reserved, :decimal, default: Decimal.new(0)
    field :incoming, :decimal, default: Decimal.new(0)
    field :average_cost, :decimal, default: Decimal.new(0)

    field :reorder_point, :decimal
    field :reorder_quantity, :decimal
    field :max_stock, :decimal

    field :bin_location, :string

    field :last_counted_at, :utc_datetime_usec
    field :last_movement_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :variant, ProductVariant

    timestamps()
  end

  @doc """
  Changeset for the settings a person may edit.

  Quantities are deliberately absent. Stock is changed by posting a move, never
  by setting a number — a hand-edited `on_hand` is a correction with no reason,
  no author and no audit trail.
  """
  def changeset(stock_item, attrs) do
    stock_item
    |> cast(attrs, [:reorder_point, :reorder_quantity, :max_stock, :bin_location])
    |> validate_number(:reorder_point, greater_than_or_equal_to: 0)
    |> validate_number(:reorder_quantity, greater_than: 0)
    |> validate_number(:max_stock, greater_than: 0)
    |> validate_length(:bin_location, max: 40)
    |> validate_reorder_bounds()
  end

  @doc false
  def new(attrs) do
    %__MODULE__{}
    |> cast(attrs, [:organization_id, :business_id, :branch_id, :variant_id])
    |> validate_required([:organization_id, :business_id, :branch_id, :variant_id])
    |> unique_constraint([:branch_id, :variant_id],
      name: :stock_items_branch_id_variant_id_index
    )
  end

  @doc """
  What may actually be sold: on hand, less what is already promised.
  """
  @spec available(t()) :: Decimal.t()
  def available(%__MODULE__{on_hand: on_hand, reserved: reserved}), do: Money.sub(on_hand, reserved)

  @doc "True when available stock has fallen to or below the reorder point."
  @spec below_reorder_point?(t()) :: boolean()
  def below_reorder_point?(%__MODULE__{reorder_point: nil}), do: false

  def below_reorder_point?(%__MODULE__{reorder_point: point} = item) do
    Decimal.compare(available(item), point) != :gt
  end

  @doc """
  How many to order to reach the maximum, or the standing reorder quantity.

  Ordering the reorder quantity regardless of what is already on the way is how
  a shop ends up with three deliveries of the same thing, so `incoming` counts
  against the gap.
  """
  @spec suggested_order_quantity(t()) :: Decimal.t()
  def suggested_order_quantity(%__MODULE__{max_stock: nil} = item) do
    item.reorder_quantity || Money.zero()
  end

  def suggested_order_quantity(%__MODULE__{max_stock: max} = item) do
    max
    |> Money.sub(available(item))
    |> Money.sub(item.incoming)
    |> Money.clamp_non_negative()
  end

  @doc "What this line of stock is worth at its average cost."
  @spec value(t()) :: Decimal.t()
  def value(%__MODULE__{on_hand: on_hand, average_cost: cost}), do: Money.mult(on_hand, cost)

  defp validate_reorder_bounds(changeset) do
    point = get_field(changeset, :reorder_point)
    max = get_field(changeset, :max_stock)

    if point && max && Decimal.compare(max, point) == :lt do
      add_error(changeset, :max_stock, "must be at least the reorder point")
    else
      changeset
    end
  end
end
