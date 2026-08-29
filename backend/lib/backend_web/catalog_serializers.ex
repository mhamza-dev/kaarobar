defmodule KaarobarWeb.CatalogSerializers do
  @moduledoc """
  Wire shapes for the catalog, tax and pricing records.

  Split from `KaarobarWeb.Serializers` because the catalog is the largest
  surface in the API and keeping it here stops one module becoming the place
  every serialisation change collides.

  Money is rendered as a string throughout — see `KaarobarWeb.JSONHelpers` for
  why. A price that arrives in a browser as an IEEE-754 double has already lost
  the argument.
  """

  import KaarobarWeb.JSONHelpers

  alias Kaarobar.Catalog.Brand
  alias Kaarobar.Catalog.Category
  alias Kaarobar.Catalog.Modifier
  alias Kaarobar.Catalog.ModifierGroup
  alias Kaarobar.Catalog.OptionType
  alias Kaarobar.Catalog.OptionValue
  alias Kaarobar.Catalog.Product
  alias Kaarobar.Catalog.ProductBarcode
  alias Kaarobar.Catalog.ProductComponent
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Catalog.Unit
  alias Kaarobar.Pricing.PriceList
  alias Kaarobar.Pricing.PriceListItem
  alias Kaarobar.Pricing.PriceRule
  alias Kaarobar.Pricing.Quote
  alias Kaarobar.Taxes.Tax
  alias Kaarobar.Taxes.TaxGroup

  # --- Taxonomy ---------------------------------------------------------------

  def unit(%Unit{} = unit) do
    %{
      id: unit.id,
      code: unit.code,
      name: unit.name,
      dimension: unit.dimension,
      factor_to_base: quantity(unit.factor_to_base),
      precision: unit.precision,
      is_base: unit.is_base,
      is_active: unit.is_active
    }
  end

  def category(%Category{} = category) do
    %{
      id: category.id,
      parent_id: category.parent_id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image_url: category.image_url,
      depth: category.depth,
      # The client builds its tree from these rather than re-deriving ancestry.
      ancestor_ids: Category.ancestor_ids(category),
      sort_order: category.sort_order,
      is_active: category.is_active
    }
  end

  def brand(%Brand{} = brand) do
    %{
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logo_url: brand.logo_url,
      is_active: brand.is_active
    }
  end

  def option_type(%OptionType{} = type) do
    %{
      id: type.id,
      name: type.name,
      presentation: type.presentation,
      position: type.position,
      is_active: type.is_active,
      values: preloaded(type.option_values, &option_value/1)
    }
  end

  def option_value(%OptionValue{} = value) do
    %{
      id: value.id,
      option_type_id: value.option_type_id,
      value: value.value,
      hex_color: value.hex_color,
      position: value.position
    }
  end

  # --- Products ---------------------------------------------------------------

  def product(%Product{} = product) do
    %{
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      short_description: product.short_description,
      kind: product.kind,
      tracks_stock: product.tracks_stock,
      tracks_batch: product.tracks_batch,
      tracks_serial: product.tracks_serial,
      is_weighted: product.is_weighted,
      service_duration_minutes: product.service_duration_minutes,
      kitchen_station: product.kitchen_station,
      hazard_class: product.hazard_class,
      registration_number: product.registration_number,
      requires_prescription: product.requires_prescription,
      rental_period_minutes: product.rental_period_minutes,
      membership_days: product.membership_days,
      attributes: product.attributes,
      image_url: product.image_url,
      images: product.images,
      sort_order: product.sort_order,
      is_active: product.is_active,
      is_featured: product.is_featured,
      category_id: product.category_id,
      brand_id: product.brand_id,
      unit_id: product.unit_id,
      tax_group_id: product.tax_group_id,
      category: preloaded(product.category, &category/1),
      brand: preloaded(product.brand, &brand/1),
      unit: preloaded(product.unit, &unit/1),
      tax_group: preloaded(product.tax_group, &tax_group/1),
      variants: preloaded(product.variants, &variant/1),
      inserted_at: timestamp(product.inserted_at)
    }
  end

  def product_summary(%Product{} = product) do
    %{
      id: product.id,
      name: product.name,
      kind: product.kind,
      image_url: product.image_url,
      tracks_stock: product.tracks_stock
    }
  end

  def product_summary(_other), do: nil

  def variant(%ProductVariant{} = variant) do
    %{
      id: variant.id,
      product_id: variant.product_id,
      sku: variant.sku,
      name: variant.name,
      barcode: variant.barcode,
      price: money(variant.price),
      cost: money(variant.cost),
      compare_at_price: money(variant.compare_at_price),
      margin: variant.cost && quantity(ProductVariant.margin(variant)),
      weight_grams: quantity(variant.weight_grams),
      image_url: variant.image_url,
      is_default: variant.is_default,
      position: variant.position,
      is_active: variant.is_active,
      option_values: variant_option_values(variant),
      product: preloaded(variant.product, &product_summary/1)
    }
  end

  defp variant_option_values(%ProductVariant{variant_option_values: values})
       when is_list(values) do
    Enum.map(values, fn link ->
      case link.option_value do
        %OptionValue{} = value -> option_value(value)
        _not_loaded -> %{id: link.option_value_id}
      end
    end)
  end

  defp variant_option_values(%ProductVariant{}), do: []

  def barcode(%ProductBarcode{} = barcode) do
    %{
      id: barcode.id,
      variant_id: barcode.variant_id,
      barcode: barcode.barcode,
      kind: barcode.kind,
      embedded_value: barcode.embedded_value
    }
  end

  # --- Modifiers --------------------------------------------------------------

  def modifier_group(%ModifierGroup{} = group) do
    %{
      id: group.id,
      name: group.name,
      description: group.description,
      selection: group.selection,
      min_select: group.min_select,
      max_select: group.max_select,
      required: ModifierGroup.required?(group),
      position: group.position,
      is_active: group.is_active,
      modifiers: preloaded(group.modifiers, &modifier/1)
    }
  end

  def modifier(%Modifier{} = modifier) do
    %{
      id: modifier.id,
      modifier_group_id: modifier.modifier_group_id,
      name: modifier.name,
      price_delta: money(modifier.price_delta),
      cost_delta: money(modifier.cost_delta),
      consumes_variant_id: modifier.consumes_variant_id,
      consumes_quantity: quantity(modifier.consumes_quantity),
      is_default: modifier.is_default,
      position: modifier.position,
      is_active: modifier.is_active
    }
  end

  def component(%ProductComponent{} = component) do
    %{
      id: component.id,
      parent_variant_id: component.parent_variant_id,
      component_variant_id: component.component_variant_id,
      kind: component.kind,
      quantity: quantity(component.quantity),
      # What is actually drawn from stock once wastage is added.
      consumed_quantity: quantity(ProductComponent.consumed_quantity(component)),
      unit_id: component.unit_id,
      wastage_percent: quantity(component.wastage_percent),
      price_mode: component.price_mode,
      price_override: money(component.price_override),
      is_optional: component.is_optional,
      position: component.position,
      component_variant: preloaded(component.component_variant, &variant/1)
    }
  end

  # --- Tax --------------------------------------------------------------------

  def tax(%Tax{} = tax) do
    %{
      id: tax.id,
      name: tax.name,
      code: tax.code,
      label: Tax.display_label(tax),
      kind: tax.kind,
      rate: quantity(tax.rate),
      jurisdiction: tax.jurisdiction,
      is_compound: tax.is_compound,
      is_active: tax.is_active
    }
  end

  def tax_group(%TaxGroup{} = group) do
    %{
      id: group.id,
      name: group.name,
      code: group.code,
      is_default: group.is_default,
      is_exempt: group.is_exempt,
      is_active: group.is_active,
      taxes: group |> TaxGroup.ordered_taxes() |> Enum.map(&tax/1)
    }
  end

  def tax_group(_other), do: nil

  def tax_line(line) do
    %{
      tax_id: line.tax_id,
      name: line.name,
      label: line.label,
      rate: quantity(line.rate),
      kind: line.kind,
      compound: line.compound,
      amount: money(line.amount)
    }
  end

  # --- Pricing ----------------------------------------------------------------

  def price_list(%PriceList{} = list) do
    %{
      id: list.id,
      name: list.name,
      code: list.code,
      currency: list.currency,
      kind: list.kind,
      branch_id: list.branch_id,
      channel: list.channel,
      priority: list.priority,
      starts_at: timestamp(list.starts_at),
      ends_at: timestamp(list.ends_at),
      is_active: list.is_active,
      items: preloaded(list.items, &price_list_item/1)
    }
  end

  def price_list_item(%PriceListItem{} = item) do
    %{
      id: item.id,
      price_list_id: item.price_list_id,
      variant_id: item.variant_id,
      price: money(item.price),
      min_quantity: quantity(item.min_quantity)
    }
  end

  def price_rule(%PriceRule{} = rule) do
    %{
      id: rule.id,
      name: rule.name,
      description: rule.description,
      code: rule.code,
      kind: rule.kind,
      scope: rule.scope,
      target_id: rule.target_id,
      value: money(rule.value),
      buy_quantity: quantity(rule.buy_quantity),
      get_quantity: quantity(rule.get_quantity),
      get_discount_percent: quantity(rule.get_discount_percent),
      min_quantity: quantity(rule.min_quantity),
      min_subtotal: money(rule.min_subtotal),
      max_discount_amount: money(rule.max_discount_amount),
      weekdays_mask: rule.weekdays_mask,
      start_time: rule.start_time && Time.to_iso8601(rule.start_time),
      end_time: rule.end_time && Time.to_iso8601(rule.end_time),
      valid_from: timestamp(rule.valid_from),
      valid_to: timestamp(rule.valid_to),
      branch_ids: rule.branch_ids,
      channel: rule.channel,
      priority: rule.priority,
      stackable: rule.stackable,
      usage_limit: rule.usage_limit,
      used_count: rule.used_count,
      requires_code: PriceRule.requires_code?(rule),
      is_active: rule.is_active
    }
  end

  @doc """
  A priced line, with every step of the derivation.

  The client shows the customer one number and the cashier all of them — "why
  is this 340?" is a question asked at the counter, and it should be answerable
  without opening a report.
  """
  def quote(%Quote{} = quote) do
    %{
      variant_id: quote.variant_id,
      product_id: quote.product_id,
      currency: quote.currency,
      quantity: quantity(quote.quantity),
      base_price: money(quote.base_price),
      list_price: money(quote.list_price),
      price_list_id: quote.price_list_id,
      modifier_total: money(quote.modifier_total),
      discounts: Enum.map(quote.discounts, &discount/1),
      discount_total: money(quote.discount_total),
      total_saving: money(Quote.total_saving(quote)),
      unit_price: money(quote.unit_price),
      subtotal: money(quote.subtotal),
      net: money(quote.net),
      tax_total: money(quote.tax_total),
      tax_lines: Enum.map(quote.tax_lines, &tax_line/1),
      gross: money(quote.gross),
      tax_inclusive: quote.tax_inclusive
    }
  end

  defp discount(entry) do
    %{
      rule_id: entry.rule_id,
      name: entry.name,
      kind: entry.kind,
      amount: money(entry.amount)
    }
  end
end
