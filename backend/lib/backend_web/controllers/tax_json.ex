defmodule KaarobarWeb.TaxJSON do
  @moduledoc false

  alias KaarobarWeb.CatalogSerializers

  def index(%{taxes: taxes}), do: %{data: Enum.map(taxes, &CatalogSerializers.tax/1)}

  def show(%{tax: tax}), do: %{data: CatalogSerializers.tax(tax)}

  def groups(%{tax_groups: groups}),
    do: %{data: Enum.map(groups, &CatalogSerializers.tax_group/1)}

  def group(%{tax_group: group}), do: %{data: CatalogSerializers.tax_group(group)}
end
