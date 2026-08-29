defmodule Kaarobar.Catalog.VariantOptionValue do
  @moduledoc """
  Joins a variant to one of the option values that define it.

  A variant with two rows here — Blue and L — is the Blue/L shirt. The
  combination is not stored as a string anywhere, so renaming an option value
  renames it everywhere it appears rather than leaving stale copies on old
  variants.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.OptionValue
  alias Kaarobar.Catalog.ProductVariant

  schema "variant_option_values" do
    belongs_to :variant, ProductVariant
    belongs_to :option_value, OptionValue

    timestamps(updated_at: false)
  end

  def changeset(variant_option_value, attrs) do
    variant_option_value
    |> cast(attrs, [:variant_id, :option_value_id])
    |> validate_required([:variant_id, :option_value_id])
    |> foreign_key_constraint(:variant_id)
    |> foreign_key_constraint(:option_value_id)
    |> unique_constraint(:option_value_id, name: :variant_option_values_variant_id_option_value_id_index,
      message: "is already set on this variant"
    )
  end
end
