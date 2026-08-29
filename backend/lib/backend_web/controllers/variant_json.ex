defmodule KaarobarWeb.VariantJSON do
  @moduledoc false

  alias KaarobarWeb.CatalogSerializers

  def index(%{variants: variants}) do
    %{data: Enum.map(variants, &CatalogSerializers.variant/1)}
  end

  def show(%{variant: variant}) do
    %{data: CatalogSerializers.variant(variant)}
  end

  def barcode(%{barcode: barcode}) do
    %{data: CatalogSerializers.barcode(barcode)}
  end
end
