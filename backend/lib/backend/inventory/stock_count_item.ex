defmodule Kaarobar.Inventory.StockCountItem do
  @moduledoc """
  One line of a stock take.

  `expected_quantity` is snapshotted when the line is created, not read at
  approval. The variance has to be against what the system believed at the
  moment of counting — otherwise a sale rung up while the count was in progress
  turns into a phantom discrepancy, and the person counting gets blamed for it.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Inventory.StockCount
  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Business

  schema "stock_count_items" do
    field :expected_quantity, :decimal
    field :counted_quantity, :decimal
    field :variance, :decimal
    field :unit_cost, :decimal
    field :variance_value, :decimal

    field :counted_at, :utc_datetime_usec
    field :reason, :string
    field :note, :string

    belongs_to :business, Business
    belongs_to :stock_count, StockCount
    belongs_to :variant, ProductVariant
    belongs_to :batch, Batch
    belongs_to :counted_by, User

    timestamps()
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :business_id,
      :stock_count_id,
      :variant_id,
      :batch_id,
      :expected_quantity,
      :unit_cost
    ])
    |> validate_required([:business_id, :stock_count_id, :variant_id, :expected_quantity])
    |> validate_number(:unit_cost, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:variant_id)
    |> unique_constraint([:stock_count_id, :variant_id],
      name: :stock_count_items_variant_unique_index,
      message: "is already on this count"
    )
  end

  @doc """
  Changeset recording what was found on the shelf.

  Computes the variance and what it is worth, so the header summary and the
  approval screen read from stored numbers rather than recomputing them
  differently in three places.
  """
  def count_changeset(item, attrs, user_id) do
    item
    |> cast(attrs, [:counted_quantity, :reason, :note])
    |> validate_required([:counted_quantity])
    |> validate_number(:counted_quantity, greater_than_or_equal_to: 0)
    |> put_change(:counted_by_id, user_id)
    |> put_change(:counted_at, DateTime.utc_now())
    |> put_variance()
  end

  @doc "The difference between what was found and what was expected, or zero."
  @spec variance_of(t()) :: Decimal.t()
  def variance_of(%__MODULE__{counted_quantity: nil}), do: Money.zero()

  def variance_of(%__MODULE__{counted_quantity: counted, expected_quantity: expected}),
    do: Money.sub(counted, expected)

  @doc "True when this line has been counted."
  @spec counted?(t()) :: boolean()
  def counted?(%__MODULE__{counted_quantity: nil}), do: false
  def counted?(%__MODULE__{}), do: true

  @doc """
  True when this line would change stock.

  Only differing lines produce a ledger move: writing a zero-variance move for
  every line of a full count would bury the real corrections in noise.
  """
  @spec adjusts_stock?(t()) :: boolean()
  def adjusts_stock?(%__MODULE__{} = item) do
    counted?(item) and not Money.zero?(variance_of(item))
  end

  defp put_variance(changeset) do
    counted = get_field(changeset, :counted_quantity)
    expected = get_field(changeset, :expected_quantity)
    unit_cost = get_field(changeset, :unit_cost) || Money.zero()

    if counted && expected do
      variance = Money.sub(counted, expected)

      changeset
      |> put_change(:variance, variance)
      |> put_change(:variance_value, Money.mult(variance, unit_cost))
    else
      changeset
    end
  end
end
