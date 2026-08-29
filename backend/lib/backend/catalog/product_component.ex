defmodule Kaarobar.Catalog.ProductComponent do
  @moduledoc """
  What a sellable thing is made of, or bundled from.

  Two arrangements sharing one table, told apart by `kind`:

    * **`bundle`** — a meal deal, a cut-and-colour package. The customer knows
      they are buying several things, and each component's stock falls.
    * **`recipe`** — a burger consumes a bun and a patty. The customer orders
      one thing; the components are ingredients they never see.

  The mechanics are identical — selling one parent consumes this much of that
  child — so they share the walk that checkout performs. They differ only where
  it matters: a bundle may reprice its components, and a recipe wastes a
  percentage of everything it touches.

  `wastage_percent` is not bookkeeping pedantry. A kitchen that trims 8% off
  every onion and never records it shows a stock count that drifts further from
  reality every week, until the count is abandoned.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Catalog.Unit
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @kinds ~w(bundle recipe)
  @price_modes ~w(included add_price override)

  schema "product_components" do
    field :kind, :string, default: "bundle"
    field :quantity, :decimal
    field :wastage_percent, :decimal, default: Decimal.new(0)
    field :price_mode, :string, default: "included"
    field :price_override, :decimal
    field :is_optional, :boolean, default: false
    field :position, :integer, default: 0

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :parent_variant, ProductVariant
    belongs_to :component_variant, ProductVariant
    belongs_to :unit, Unit

    timestamps()
  end

  @doc "The kinds of composition supported."
  def kinds, do: @kinds

  @doc "How a bundle component contributes to the price."
  def price_modes, do: @price_modes

  def changeset(component, attrs) do
    component
    |> cast(attrs, [
      :parent_variant_id,
      :component_variant_id,
      :kind,
      :quantity,
      :unit_id,
      :wastage_percent,
      :price_mode,
      :price_override,
      :is_optional,
      :position
    ])
    |> validate_required([:parent_variant_id, :component_variant_id, :kind, :quantity])
    |> validate_inclusion(:kind, @kinds)
    |> validate_inclusion(:price_mode, @price_modes)
    |> validate_number(:quantity, greater_than: 0)
    |> validate_number(:wastage_percent,
      greater_than_or_equal_to: 0,
      less_than: 100
    )
    |> validate_override_price()
    |> validate_not_self_referential()
    |> foreign_key_constraint(:parent_variant_id)
    |> foreign_key_constraint(:component_variant_id)
    |> foreign_key_constraint(:unit_id)
    |> unique_constraint([:parent_variant_id, :component_variant_id, :kind],
      message: "is already a component of this product"
    )
  end

  @doc """
  The quantity actually consumed, once wastage is added.

  A recipe calling for 100 g with 10% wastage draws down 111.11 g, because the
  10% is lost from what is issued, not added to what is used. Getting this
  backwards understates consumption on every single sale.
  """
  @spec consumed_quantity(t()) :: Decimal.t()
  def consumed_quantity(%__MODULE__{quantity: quantity, wastage_percent: wastage}) do
    remaining = Decimal.sub(Decimal.new(100), wastage)

    if Decimal.compare(remaining, 0) == :gt do
      quantity
      |> Decimal.mult(Decimal.new(100))
      |> Decimal.div(remaining)
      |> Decimal.round(6)
    else
      quantity
    end
  end

  defp validate_override_price(changeset) do
    if get_field(changeset, :price_mode) == "override" and
         is_nil(get_field(changeset, :price_override)) do
      add_error(changeset, :price_override, "is required when the price is overridden")
    else
      changeset
    end
  end

  # A deeper cycle — A contains B contains A — is caught in `Kaarobar.Catalog`,
  # where the whole graph is visible and the error can name the loop.
  defp validate_not_self_referential(changeset) do
    if get_field(changeset, :parent_variant_id) == get_field(changeset, :component_variant_id) do
      add_error(changeset, :component_variant_id, "cannot contain itself")
    else
      changeset
    end
  end
end
