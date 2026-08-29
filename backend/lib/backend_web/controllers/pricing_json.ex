defmodule KaarobarWeb.PricingJSON do
  @moduledoc false

  import KaarobarWeb.JSONHelpers

  alias KaarobarWeb.CatalogSerializers

  def lists(%{price_lists: lists}),
    do: %{data: Enum.map(lists, &CatalogSerializers.price_list/1)}

  def list(%{price_list: price_list}),
    do: %{data: CatalogSerializers.price_list(price_list)}

  def list_item(%{item: item}), do: %{data: CatalogSerializers.price_list_item(item)}

  def rules(%{price_rules: rules}),
    do: %{data: Enum.map(rules, &CatalogSerializers.price_rule/1)}

  def rule(%{price_rule: rule}), do: %{data: CatalogSerializers.price_rule(rule)}

  def quote(%{result: result}) do
    %{
      data: %{
        lines: Enum.map(result.lines, &CatalogSerializers.quote/1),
        subtotal: money(result.subtotal),
        discount_total: money(result.discount_total),
        tax_total: money(result.tax_total),
        total: money(result.total)
      }
    }
  end
end
