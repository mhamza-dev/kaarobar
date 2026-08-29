defmodule KaarobarWeb.TaxonomyJSON do
  @moduledoc """
  Shared views for categories, brands, units and option types.

  One module because they are rendered by four controllers that otherwise
  duplicate the same six lines each.
  """

  alias KaarobarWeb.CatalogSerializers

  def index(%{categories: categories}),
    do: %{data: Enum.map(categories, &CatalogSerializers.category/1)}

  def index(%{brands: brands}), do: %{data: Enum.map(brands, &CatalogSerializers.brand/1)}

  def index(%{units: units}), do: %{data: Enum.map(units, &CatalogSerializers.unit/1)}

  def index(%{option_types: option_types}),
    do: %{data: Enum.map(option_types, &CatalogSerializers.option_type/1)}

  def show(%{category: category}), do: %{data: CatalogSerializers.category(category)}
  def show(%{brand: brand}), do: %{data: CatalogSerializers.brand(brand)}
  def show(%{unit: unit}), do: %{data: CatalogSerializers.unit(unit)}

  def show(%{option_type: option_type}),
    do: %{data: CatalogSerializers.option_type(option_type)}
end
