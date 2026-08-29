defmodule Kaarobar.Catalog.UnitConversion do
  @moduledoc """
  A conversion that cannot be derived from dimensions.

  "One box is twelve pieces" relates two count units whose factors do not
  encode it, and "one drum is 200 litres" is a packaging fact rather than a
  physical one. Within a dimension `Kaarobar.Catalog.Unit.convert/3` already
  does the arithmetic; this table is only for the rest.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.Unit
  alias Kaarobar.Tenancy.Business

  schema "unit_conversions" do
    field :factor, :decimal

    belongs_to :business, Business
    belongs_to :from_unit, Unit
    belongs_to :to_unit, Unit

    timestamps()
  end

  def changeset(conversion, attrs) do
    conversion
    |> cast(attrs, [:business_id, :from_unit_id, :to_unit_id, :factor])
    |> validate_required([:business_id, :from_unit_id, :to_unit_id, :factor])
    |> validate_number(:factor, greater_than: 0)
    |> validate_distinct_units()
    |> unique_constraint(:to_unit_id, name: :unit_conversions_from_unit_id_to_unit_id_index,
      message: "already has a conversion"
    )
    |> foreign_key_constraint(:from_unit_id)
    |> foreign_key_constraint(:to_unit_id)
  end

  defp validate_distinct_units(changeset) do
    if get_field(changeset, :from_unit_id) == get_field(changeset, :to_unit_id) do
      add_error(changeset, :to_unit_id, "must differ from the source unit")
    else
      changeset
    end
  end
end
