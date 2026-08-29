defmodule Kaarobar.Inventory.StockMove do
  @moduledoc """
  One immutable line of the stock ledger.

  There is no update changeset and there never will be — the database refuses
  `UPDATE` on this table. A mistake is corrected by posting an opposing move,
  which is what a paper stock book does and for the same reason: the record of
  the mistake is often more useful than the corrected number.

  `quantity` is signed. Negative leaves, positive arrives. One column rather
  than a quantity plus a direction, so summing the ledger *is* the balance and
  there is no second field to get out of step.

  `balance_after` is the running total at this row. Redundant, deliberately:
  it makes the ledger self-verifying, so a discrepancy shows at the row where
  it started rather than as a total that is merely wrong.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Inventory.SerialNumber
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @kinds ~w(
    opening purchase purchase_return sale sale_return adjustment
    transfer_out transfer_in wastage production_in production_out count
  )

  # Kinds that add stock. Everything else removes it, and the ledger enforces
  # the sign so a caller cannot post a "purchase" that decrements.
  @inbound_kinds ~w(opening purchase sale_return transfer_in production_in)
  @outbound_kinds ~w(purchase_return sale transfer_out wastage production_out)
  # Adjustments and counts go either way by nature.
  @signless_kinds ~w(adjustment count)

  schema "stock_moves" do
    field :kind, :string
    field :quantity, :decimal
    field :unit_cost, :decimal
    field :total_cost, :decimal
    field :balance_after, :decimal

    field :reference_type, :string
    field :reference_id, Kaarobar.Ecto.UUIDv7

    field :reason, :string
    field :note, :string

    field :actor_user_id, Kaarobar.Ecto.UUIDv7
    field :actor_label, :string

    field :occurred_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :variant, ProductVariant
    belongs_to :batch, Batch
    belongs_to :serial, SerialNumber

    timestamps(updated_at: false)
  end

  @doc "Every kind of movement the ledger records."
  def kinds, do: @kinds

  @doc "Kinds that always add stock."
  def inbound_kinds, do: @inbound_kinds

  @doc "Kinds that always remove stock."
  def outbound_kinds, do: @outbound_kinds

  @doc """
  Changeset for a move.

  Written only by `Kaarobar.Inventory.Ledger`, which supplies `balance_after`
  after taking a row lock. A move built anywhere else would race.
  """
  def changeset(move, attrs) do
    move
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :variant_id,
      :kind,
      :quantity,
      :unit_cost,
      :total_cost,
      :balance_after,
      :batch_id,
      :serial_id,
      :reference_type,
      :reference_id,
      :reason,
      :note,
      :actor_user_id,
      :actor_label,
      :occurred_at
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :branch_id,
      :variant_id,
      :kind,
      :quantity,
      :balance_after,
      :occurred_at
    ])
    |> validate_inclusion(:kind, @kinds)
    |> validate_non_zero_quantity()
    |> validate_sign_matches_kind()
    |> validate_length(:reason, max: 120)
    |> foreign_key_constraint(:variant_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:batch_id)
  end

  @doc "True when this kind of move always adds stock."
  @spec inbound?(String.t()) :: boolean()
  def inbound?(kind), do: kind in @inbound_kinds

  @doc "True when this kind of move always removes stock."
  @spec outbound?(String.t()) :: boolean()
  def outbound?(kind), do: kind in @outbound_kinds

  @doc """
  Normalises a quantity to the sign its kind requires.

  A caller asking to record a sale of 3 means minus three, and one asking to
  record a sale of minus three means the same thing. Normalising here rather
  than trusting the sign stops a mistyped minus from turning a sale into a
  delivery.
  """
  @spec directional_quantity(String.t(), Decimal.t()) :: Decimal.t()
  def directional_quantity(kind, %Decimal{} = quantity) do
    magnitude = Decimal.abs(quantity)

    cond do
      kind in @inbound_kinds -> magnitude
      kind in @outbound_kinds -> Decimal.negate(magnitude)
      # Adjustments and counts carry their own sign, which is the whole point.
      true -> quantity
    end
  end

  defp validate_non_zero_quantity(changeset) do
    case get_field(changeset, :quantity) do
      nil -> changeset
      quantity -> if Decimal.compare(quantity, 0) == :eq,
        do: add_error(changeset, :quantity, "must not be zero"),
        else: changeset
    end
  end

  defp validate_sign_matches_kind(changeset) do
    kind = get_field(changeset, :kind)
    quantity = get_field(changeset, :quantity)

    cond do
      is_nil(kind) or is_nil(quantity) -> changeset
      kind in @signless_kinds -> changeset
      kind in @inbound_kinds and Decimal.compare(quantity, 0) == :lt ->
        add_error(changeset, :quantity, "must be positive for an inbound move")

      kind in @outbound_kinds and Decimal.compare(quantity, 0) == :gt ->
        add_error(changeset, :quantity, "must be negative for an outbound move")

      true ->
        changeset
    end
  end
end
