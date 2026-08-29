defmodule Kaarobar.Catalog.Modifier do
  @moduledoc """
  One choice inside a modifier group.

  `price_delta` may be negative — "no cheese, 20 off" is a real thing on a real
  menu, and forcing it positive means shops encode discounts as separate
  products.

  ## Consuming stock

  A modifier may name a variant it consumes. A kitchen that adds a fried egg to
  every second order is using eggs, and if that is not recorded the egg count
  drifts until nobody trusts it. `consumes_variant_id` and `consumes_quantity`
  make the add-on deduct real stock at checkout, exactly as a recipe component
  does.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ModifierGroup
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Tenancy.Business

  schema "modifiers" do
    field :name, :string
    field :price_delta, :decimal, default: Decimal.new(0)
    field :cost_delta, :decimal, default: Decimal.new(0)
    field :consumes_quantity, :decimal
    field :is_default, :boolean, default: false
    field :position, :integer, default: 0
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :business, Business
    belongs_to :modifier_group, ModifierGroup
    belongs_to :consumes_variant, ProductVariant

    timestamps()
  end

  def changeset(modifier, attrs) do
    modifier
    |> cast(attrs, [
      :modifier_group_id,
      :name,
      :price_delta,
      :cost_delta,
      :consumes_variant_id,
      :consumes_quantity,
      :is_default,
      :position,
      :is_active
    ])
    |> validate_required([:modifier_group_id, :name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 100)
    |> validate_consumption()
    |> foreign_key_constraint(:modifier_group_id)
    |> foreign_key_constraint(:consumes_variant_id)
    |> unique_constraint([:modifier_group_id, :name],
      name: :modifiers_modifier_group_id_name_index,
      message: "is already an option in this group"
    )
  end

  @doc "Soft-deletes the modifier."
  def soft_delete_changeset(modifier), do: change(modifier, deleted_at: DateTime.utc_now())

  @doc "True when choosing this modifier draws down real stock."
  def consumes_stock?(%__MODULE__{consumes_variant_id: nil}), do: false
  def consumes_stock?(%__MODULE__{}), do: true

  # Half a consumption rule is worse than none: a variant with no quantity
  # would deduct nothing, and a quantity with no variant would deduct it from
  # nowhere. The database constraint agrees; this gives the readable message.
  defp validate_consumption(changeset) do
    variant_id = get_field(changeset, :consumes_variant_id)
    quantity = get_field(changeset, :consumes_quantity)

    cond do
      is_nil(variant_id) and is_nil(quantity) ->
        changeset

      is_nil(variant_id) ->
        add_error(changeset, :consumes_variant_id, "is required when a quantity is given")

      is_nil(quantity) ->
        add_error(changeset, :consumes_quantity, "is required when a product is consumed")

      Decimal.compare(quantity, 0) != :gt ->
        add_error(changeset, :consumes_quantity, "must be greater than zero")

      true ->
        changeset
    end
  end
end
