defmodule KaarobarWeb.ProductJSON do
  @moduledoc false

  alias KaarobarWeb.CatalogSerializers

  def index(%{products: products, meta: meta}) do
    %{data: Enum.map(products, &CatalogSerializers.product/1), meta: meta}
  end

  def show(%{product: product}) do
    %{data: CatalogSerializers.product(product)}
  end

  def scanned(%{variant: variant}) do
    %{data: CatalogSerializers.variant(variant)}
  end
end
