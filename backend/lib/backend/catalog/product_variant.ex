defmodule Kaarobar.Catalog.ProductVariant do
  @moduledoc """
  The thing that is actually sold, counted and scanned.

  Stock levels, barcodes, price-list entries, sale lines and recipe components
  all reference a variant, never a product. Every product has at least one —
  created with it — so a grocer selling one kind of rice and a clothing shop
  selling a size-and-colour matrix use the same code paths.

  `barcode` is denormalised here as well as living in `product_barcodes`. The
  scan is the hottest read in the whole system: a cashier holding a scanner
  with a customer waiting, and it should cost one indexed lookup and no join.
  The side table holds the extras — the same item from two suppliers, or a
  weighted label printed by a scale.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.Product
  alias Kaarobar.Catalog.ProductBarcode
  alias Kaarobar.Catalog.VariantOptionValue
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "product_variants" do
    field :sku, :string
    field :name, :string
    field :barcode, :string

    field :price, :decimal
    field :cost, :decimal
    field :compare_at_price, :decimal

    field :weight_grams, :decimal
    field :image_url, :string

    field :is_default, :boolean, default: false
    field :position, :integer, default: 0

    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :product, Product

    has_many :variant_option_values, VariantOptionValue, foreign_key: :variant_id
    has_many :option_values, through: [:variant_option_values, :option_value]
    has_many :barcodes, ProductBarcode, foreign_key: :variant_id

    timestamps()
  end

  @doc "Changeset for a variant."
  def changeset(variant, attrs) do
    variant
    |> cast(attrs, [
      :sku,
      :name,
      :barcode,
      :price,
      :cost,
      :compare_at_price,
      :weight_grams,
      :image_url,
      :position,
      :is_active
    ])
    |> validate_required([:price])
    |> normalize_blank(:sku)
    |> normalize_blank(:barcode)
    |> validate_length(:sku, max: 64)
    |> validate_length(:barcode, max: 64)
    |> validate_length(:name, max: 200)
    |> validate_number(:price, greater_than_or_equal_to: 0)
    |> validate_number(:cost, greater_than_or_equal_to: 0)
    |> validate_number(:compare_at_price, greater_than_or_equal_to: 0)
    |> validate_number(:weight_grams, greater_than_or_equal_to: 0)
    |> unique_constraint(:sku,
      name: :product_variants_business_id_sku_index,
      message: "is already used by another product"
    )
    |> unique_constraint(:barcode,
      name: :product_variants_business_id_barcode_index,
      message: "is already used by another product"
    )
    |> foreign_key_constraint(:product_id)
  end

  @doc """
  Changeset for the default variant created alongside a product.

  Marked `is_default` so the POS knows what to add when nobody picks an option,
  and so a product that later grows options keeps a stable identity for its
  original stock and sales history.
  """
  def default_changeset(variant, attrs) do
    variant
    |> changeset(attrs)
    |> put_change(:is_default, true)
    |> unique_constraint(:is_default,
      name: :product_variants_single_default_index,
      message: "this product already has a default variant"
    )
  end

  @doc "Soft-deletes the variant."
  def soft_delete_changeset(variant), do: change(variant, deleted_at: DateTime.utc_now())

  @doc "True when the variant may be sold."
  def active?(%__MODULE__{deleted_at: nil, is_active: true}), do: true
  def active?(%__MODULE__{}), do: false

  @doc """
  The name shown on a receipt or a till button.

  A default variant has no name of its own, so it borrows the product's; a
  variant with options reads "Shirt — Blue / L".
  """
  @spec display_name(t(), Product.t() | nil) :: String.t()
  def display_name(%__MODULE__{name: name}, nil) when is_binary(name), do: name
  def display_name(%__MODULE__{name: nil}, %Product{name: name}), do: name
  def display_name(%__MODULE__{name: ""}, %Product{name: name}), do: name

  def display_name(%__MODULE__{name: name}, %Product{name: product_name}),
    do: "#{product_name} — #{name}"

  def display_name(%__MODULE__{name: name}, _product) when is_binary(name), do: name
  def display_name(%__MODULE__{}, _product), do: ""

  @doc """
  Builds a variant's name from its option values: "Blue / L".

  Ordered by option type so the same combination always reads the same way —
  "Blue / L", never sometimes "L / Blue".
  """
  @spec build_name([%{value: String.t(), position: integer()}]) :: String.t() | nil
  def build_name([]), do: nil

  def build_name(option_values) do
    option_values
    |> Enum.sort_by(&Map.get(&1, :position, 0))
    |> Enum.map_join(" / ", & &1.value)
  end

  @doc """
  The margin on this variant, as a fraction, or `nil` without a cost.

  Returned rather than stored: a stored margin is wrong the moment either
  number changes, and the two numbers change independently.
  """
  @spec margin(t()) :: Decimal.t() | nil
  def margin(%__MODULE__{cost: nil}), do: nil

  def margin(%__MODULE__{price: price, cost: cost}) do
    if Decimal.compare(price, 0) == :gt do
      price |> Decimal.sub(cost) |> Decimal.div(price) |> Decimal.round(4)
    end
  end

  # An empty string is not a barcode; it is an empty form field, and storing it
  # would collide with the next product whose barcode was also left blank.
  defp normalize_blank(changeset, field) do
    update_change(changeset, field, fn
      nil -> nil
      value -> if String.trim(value) == "", do: nil, else: String.trim(value)
    end)
  end
end
