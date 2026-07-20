defmodule Kaarobar.Schemas.Product do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @kinds ~w(goods service combo)
  @units ~w(pcs kg g ml l box pack hour session)

  schema "products" do
    field :sku, :string
    field :name, :string
    field :category, :string
    field :barcode, :string
    field :brand, :string
    field :unit, :string, default: "pcs"
    field :description, :string
    field :product_kind, :string, default: "goods"
    field :track_inventory, :boolean, default: true
    field :duration_minutes, :integer
    field :attributes, :map, default: %{}
    field :tax_rate, :decimal
    field :is_active, :boolean, default: true

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :product_category, Kaarobar.Schemas.ProductCategory, foreign_key: :category_id

    has_many :product_branch_prices, Kaarobar.Schemas.ProductBranchPrice
    has_many :inventory_records, Kaarobar.Schemas.InventoryRecord
    has_many :variants, Kaarobar.Schemas.ProductVariant
    has_many :images, Kaarobar.Schemas.ProductImage
    has_many :batches, Kaarobar.Schemas.ProductBatch
    has_many :product_modifier_groups, Kaarobar.Schemas.ProductModifierGroup

    timestamps(type: :utc_datetime)
  end

  def kinds, do: @kinds
  def units, do: @units

  def changeset(product, attrs) do
    product
    |> cast(attrs, [
      :sku,
      :name,
      :category,
      :barcode,
      :brand,
      :unit,
      :description,
      :product_kind,
      :track_inventory,
      :duration_minutes,
      :attributes,
      :tax_rate,
      :is_active,
      :business_id,
      :owner_id,
      :category_id
    ])
    |> validate_required([:sku, :name, :business_id, :owner_id])
    |> maybe_default_kind_unit()
    |> validate_inclusion(:product_kind, @kinds)
    |> validate_inclusion(:unit, @units)
    |> maybe_default_track_inventory()
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:category_id)
    |> unique_constraint([:business_id, :sku])
    |> unique_constraint([:business_id, :barcode])
  end

  defp maybe_default_kind_unit(changeset) do
    changeset
    |> then(fn cs ->
      if get_field(cs, :product_kind) in [nil, ""],
        do: put_change(cs, :product_kind, "goods"),
        else: cs
    end)
    |> then(fn cs ->
      if get_field(cs, :unit) in [nil, ""], do: put_change(cs, :unit, "pcs"), else: cs
    end)
  end

  defp maybe_default_track_inventory(changeset) do
    kind = get_field(changeset, :product_kind)

    if kind == "service" and get_change(changeset, :track_inventory) == nil and
         get_field(changeset, :track_inventory) != false do
      # only auto-set when not explicitly provided on create
      if get_field(changeset, :id) == nil and get_change(changeset, :track_inventory) == nil do
        put_change(changeset, :track_inventory, false)
      else
        changeset
      end
    else
      changeset
    end
  end
end
