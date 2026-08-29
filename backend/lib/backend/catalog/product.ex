defmodule Kaarobar.Catalog.Product do
  @moduledoc """
  A sellable thing, whatever kind of shop is selling it.

  The columns here are the ones every sellable thing has. Vertical-specific
  fields are nullable and only meaningful when `Kaarobar.Verticals` says the
  business type enables them — a `service_duration_minutes` on a bag of rice is
  not an error, it is simply never read.

  A product carries no price and no stock level. Both live on
  `Kaarobar.Catalog.ProductVariant`, and every product has at least one variant
  even when it has no options at all. That uniformity is what stops "does this
  have variants?" from becoming a branch in every stock query and every sale
  line.

  ## Kind decides tracking

  Only `item` and `rental` may track stock, enforced by a database constraint.
  A haircut with a stock level produces low-stock alerts for haircuts, which is
  how staff learn to ignore alerts.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.Brand
  alias Kaarobar.Catalog.Category
  alias Kaarobar.Catalog.ProductModifierGroup
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Catalog.Unit
  alias Kaarobar.Slug
  alias Kaarobar.Taxes.TaxGroup
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization
  alias Kaarobar.Verticals

  @kinds ~w(item service bundle deal rental membership gift_card fee)
  @stockable_kinds ~w(item rental)

  schema "products" do
    field :name, :string
    field :slug, :string
    field :description, :string
    field :short_description, :string

    field :kind, :string, default: "item"

    field :tracks_stock, :boolean, default: true
    field :tracks_batch, :boolean, default: false
    field :tracks_serial, :boolean, default: false
    field :is_weighted, :boolean, default: false

    # Vertical-specific.
    field :service_duration_minutes, :integer
    field :kitchen_station, :string
    field :hazard_class, :string
    field :registration_number, :string
    field :requires_prescription, :boolean, default: false
    field :rental_period_minutes, :integer
    field :membership_days, :integer

    field :attributes, :map, default: %{}
    field :image_url, :string
    field :images, {:array, :string}, default: []

    field :sort_order, :integer, default: 0
    field :is_active, :boolean, default: true
    field :is_featured, :boolean, default: false
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :category, Category
    belongs_to :brand, Brand
    belongs_to :unit, Unit
    belongs_to :tax_group, TaxGroup

    has_many :variants, ProductVariant
    has_many :product_modifier_groups, ProductModifierGroup
    has_many :modifier_groups, through: [:product_modifier_groups, :modifier_group]

    timestamps()
  end

  @doc "Every product kind the platform understands."
  def kinds, do: @kinds

  @doc "The kinds that may carry a stock level."
  def stockable_kinds, do: @stockable_kinds

  @doc """
  Changeset for a product.

  Takes the owning business so the kind can be checked against the vertical: a
  barbershop should not be able to create a `rental`, and finding that out at
  the till is too late.
  """
  def changeset(product, attrs, business) do
    product
    |> cast(attrs, castable_fields())
    |> maybe_generate_slug()
    |> validate_required([:name, :slug, :kind])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 200)
    |> validate_length(:short_description, max: 300)
    |> validate_length(:description, max: 5000)
    |> validate_format(:slug, ~r/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      message: "may only contain lowercase letters, numbers and hyphens"
    )
    |> validate_inclusion(:kind, @kinds)
    |> validate_kind_for_business(business)
    |> apply_tracking_rules()
    |> validate_vertical_fields(business)
    |> validate_number(:service_duration_minutes, greater_than: 0)
    |> validate_number(:rental_period_minutes, greater_than: 0)
    |> validate_number(:membership_days, greater_than: 0)
    |> validate_length(:image_url, max: 2048)
    |> unique_constraint([:business_id, :slug],
      name: :products_business_id_slug_index,
      message: "is already taken"
    )
    |> foreign_key_constraint(:category_id)
    |> foreign_key_constraint(:brand_id)
    |> foreign_key_constraint(:unit_id)
    |> foreign_key_constraint(:tax_group_id)
  end

  @doc "Soft-deletes the product."
  def soft_delete_changeset(product), do: change(product, deleted_at: DateTime.utc_now())

  @doc "True when the product is sellable."
  def active?(%__MODULE__{deleted_at: nil, is_active: true}), do: true
  def active?(%__MODULE__{}), do: false

  @doc "True when selling this reduces a stock level."
  def stocked?(%__MODULE__{tracks_stock: true, kind: kind}), do: kind in @stockable_kinds
  def stocked?(%__MODULE__{}), do: false

  @doc "The default variant, when variants are loaded."
  @spec default_variant(t()) :: ProductVariant.t() | nil
  def default_variant(%__MODULE__{variants: variants}) when is_list(variants) do
    Enum.find(variants, & &1.is_default) || List.first(variants)
  end

  def default_variant(%__MODULE__{}), do: nil

  defp castable_fields do
    [
      :name,
      :slug,
      :description,
      :short_description,
      :kind,
      :tracks_stock,
      :tracks_batch,
      :tracks_serial,
      :is_weighted,
      :service_duration_minutes,
      :kitchen_station,
      :hazard_class,
      :registration_number,
      :requires_prescription,
      :rental_period_minutes,
      :membership_days,
      :attributes,
      :image_url,
      :images,
      :sort_order,
      :is_active,
      :is_featured,
      :category_id,
      :brand_id,
      :unit_id,
      :tax_group_id
    ]
  end

  defp validate_kind_for_business(changeset, nil), do: changeset

  defp validate_kind_for_business(changeset, business) do
    validate_change(changeset, :kind, fn :kind, kind ->
      if Verticals.product_kind_allowed?(business.business_type, kind) do
        []
      else
        [kind: "is not sold by a #{Verticals.label(business.business_type)}"]
      end
    end)
  end

  # Tracking flags are corrected rather than rejected. A client that sends
  # `tracks_stock` on a service is describing a product it does not understand,
  # and the useful response is the product it meant, not an error about a
  # checkbox it never showed the user.
  defp apply_tracking_rules(changeset) do
    kind = get_field(changeset, :kind)

    changeset =
      if kind in @stockable_kinds do
        changeset
      else
        put_change(changeset, :tracks_stock, false)
      end

    # Batch and serial tracking are meaningless without stock behind them.
    if get_field(changeset, :tracks_stock) do
      changeset
    else
      changeset
      |> put_change(:tracks_batch, false)
      |> put_change(:tracks_serial, false)
    end
  end

  # The regulated verticals must record batch and expiry. Recalls happen by lot
  # number and expired stock is illegal to sell, so this is applied rather than
  # left to whoever fills in the form.
  defp validate_vertical_fields(changeset, nil), do: changeset

  defp validate_vertical_fields(changeset, business) do
    changeset =
      if Verticals.requires_batch?(business.business_type) and
           get_field(changeset, :tracks_stock) do
        put_change(changeset, :tracks_batch, true)
      else
        changeset
      end

    if Verticals.requires_served_by?(business.business_type) and
         get_field(changeset, :kind) == "service" do
      validate_required(changeset, [:service_duration_minutes],
        message: "is required so the appointment book can allocate time"
      )
    else
      changeset
    end
  end

  defp maybe_generate_slug(changeset) do
    case get_field(changeset, :slug) do
      nil -> put_change(changeset, :slug, Slug.slugify(get_field(changeset, :name), "product"))
      _slug -> update_change(changeset, :slug, &Slug.slugify(&1, "product"))
    end
  end
end
