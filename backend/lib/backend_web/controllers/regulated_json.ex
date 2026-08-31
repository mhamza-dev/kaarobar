defmodule KaarobarWeb.RegulatedJSON do
  @moduledoc false

  alias KaarobarWeb.TradeSerializers, as: S

  def register(%{entries: entries}), do: %{data: Enum.map(entries, &S.register_entry/1)}

  def products(%{products: products}),
    do: %{data: Enum.map(products, &S.restricted_product/1)}
end
