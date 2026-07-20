defmodule Kaarobar.Catalog.IndustryPresets do
  @moduledoc "Default product categories per business industry."

  @presets %{
    "retail" => ["General", "Apparel", "Electronics", "Home"],
    "supermarket" => ["Grocery", "Dairy", "Bakery", "Household"],
    "restaurant" => ["Beverages", "Food", "Desserts", "Sides"],
    "salon" => ["Hair", "Nails", "Skin", "Packages"],
    "pharmacy" => ["OTC", "Rx", "Personal Care", "Devices"],
    "wholesale" => ["Bulk", "Cases", "Units"],
    "general" => ["General", "Services", "Misc"]
  }

  def categories_for(industry) when is_binary(industry) do
    Map.get(@presets, industry, @presets["general"])
  end

  def categories_for(_), do: @presets["general"]

  def slugify(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "-")
    |> String.trim("-")
  end
end
