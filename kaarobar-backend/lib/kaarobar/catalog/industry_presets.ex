defmodule Kaarobar.Catalog.IndustryPresets do
  @moduledoc """
  Default product categories seeded per `Business.industry` (TEN-FR-011).

  Industries are fixed on `Business` (`retail`, `restaurant`, `salon`, `pharmacy`,
  `supermarket`, `wholesale`, `general`). Category lists below cover the common
  shop types owners map onto those presets (fashion, cafe, clinic, cash & carry, etc.).
  """

  @presets %{
    # Apparel shops, electronics, gifts, hardware, stationery, general merchandise
    "retail" => [
      "General",
      "Apparel",
      "Footwear",
      "Accessories",
      "Electronics",
      "Mobiles & Accessories",
      "Home",
      "Furniture",
      "Kitchenware",
      "Toys & Kids",
      "Stationery",
      "Books",
      "Gifts & Decor",
      "Hardware",
      "Sports",
      "Beauty Retail",
      "Deals"
    ],
    # Kiryana, hypermarkets, specialty grocery
    "supermarket" => [
      "Grocery",
      "Fresh Produce",
      "Meat & Seafood",
      "Dairy",
      "Bakery",
      "Frozen",
      "Beverages",
      "Snacks",
      "Household",
      "Personal Care",
      "Baby Care",
      "Pet Care",
      "Cleaning",
      "Bulk Packs",
      "Deals"
    ],
    # Restaurants, cafes, bakeries, sweet shops, QSR / cloud kitchen
    "restaurant" => [
      "Starters",
      "Mains",
      "Grills & BBQ",
      "Biryani & Rice",
      "Breads",
      "Sides",
      "Salads",
      "Soups",
      "Burgers & Sandwiches",
      "Pizza & Pasta",
      "Seafood",
      "Vegetarian",
      "Desserts",
      "Sweets",
      "Bakery",
      "Beverages",
      "Hot Drinks",
      "Cold Drinks",
      "Shakes & Smoothies",
      "Combos",
      "Deals",
      "Catering"
    ],
    # Hair salons, barbers, makeup artists, nail studios, aesthetic / derma clinics
    "salon" => [
      "Hair",
      "Barber",
      "Nails",
      "Skin",
      "Facials",
      "Makeup",
      "Bridal",
      "Aesthetic",
      "Laser",
      "Spa & Massage",
      "Waxing",
      "Threading",
      "Packages",
      "Memberships",
      "Retail Products",
      "Deals"
    ],
    # Retail pharmacies, medical stores, wellness counters
    "pharmacy" => [
      "OTC",
      "Rx",
      "Antibiotics",
      "Chronic Care",
      "Vitamins & Supplements",
      "Personal Care",
      "Baby Care",
      "First Aid",
      "Devices",
      "Diagnostics",
      "Surgical",
      "Herbal / Hikmat",
      "Wellness",
      "Deals"
    ],
    # Distributors, cash & carry, B2B packs
    "wholesale" => [
      "Bulk",
      "Cases",
      "Units",
      "FMCG",
      "Foodservice",
      "Packaging",
      "Raw Materials",
      "Hardware Bulk",
      "Textiles Bulk",
      "Electronics Bulk",
      "Agro / Feed",
      "Cash & Carry",
      "Deals"
    ],
    # Catch-all / mixed shops, services, repair, agencies
    "general" => [
      "General",
      "Goods",
      "Services",
      "Repairs",
      "Rentals",
      "Packages",
      "Fees",
      "Misc",
      "Deals"
    ]
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
