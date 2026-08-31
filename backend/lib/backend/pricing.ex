defmodule Kaarobar.Pricing do
  @moduledoc """
  What one line costs, and why.

  ## The order of operations

  This is the whole of it, and the order is not negotiable — each step changes
  the base the next one works from:

  1. **Base price** — the variant's shelf price.
  2. **Price list** — the first matching list by priority, honouring quantity
     breaks. Lists override rather than stack.
  3. **Modifiers** — add-ons chosen at the counter, added per unit.
  4. **Promotions** — in `priority` order. The first non-stackable rule that
     applies wins and stops the walk; stackable rules keep accumulating.
  5. **Tax** — computed on the discounted amount, in the direction the business
     quotes prices in.

  Discounting before tax rather than after is not a preference. Tax is owed on
  what the customer actually paid, and a system that taxes the pre-discount
  amount overcharges the customer and over-remits to the revenue authority.

  ## Load the context once, quote many lines

  A ten-line cart should not run ten sets of promotion queries. `context/2`
  loads every live rule and price list for the business once; `quote_line/3`
  then works entirely in memory. That also makes the whole cart consistent —
  every line is priced against the same instant, so a happy hour cannot expire
  between line three and line four.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Catalog.Category
  alias Kaarobar.Money
  alias Kaarobar.Pricing.Context
  alias Kaarobar.Pricing.PriceList
  alias Kaarobar.Pricing.PriceListItem
  alias Kaarobar.Pricing.PriceRule
  alias Kaarobar.Pricing.Quote
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Taxes.Calculation

  # ===========================================================================
  # Context
  # ===========================================================================

  @doc """
  Loads everything needed to price a cart, once.

  ## Options

    * `:at` — the instant to price against. Defaults to now, and is fixed for
      the whole cart so a time-limited promotion cannot expire mid-sale.
    * `:branch_id` — defaults to the scope's branch.
    * `:channel` — `"pos"`, `"online"`, `"phone"`, `"wholesale"`.
    * `:coupon_codes` — codes the customer quoted. Rules requiring a code are
      inert without one.
  """
  @spec context(Scope.t(), keyword()) :: Context.t()
  def context(%Scope{} = scope, opts \\ []) do
    at = Keyword.get(opts, :at, DateTime.utc_now())
    branch_id = Keyword.get(opts, :branch_id) || Scope.branch_id(scope)
    channel = Keyword.get(opts, :channel, "pos")
    codes = opts |> Keyword.get(:coupon_codes, []) |> normalize_codes()

    filters = [at: at, branch_id: branch_id, channel: channel]

    %Context{
      at: at,
      branch_id: branch_id,
      channel: channel,
      currency: scope.business && scope.business.currency,
      tax_inclusive: tax_inclusive?(scope),
      coupon_codes: codes,
      price_lists: scope |> load_price_lists() |> Enum.filter(&PriceList.applies?(&1, filters)),
      rules:
        scope
        |> load_rules()
        |> Enum.filter(&PriceRule.applies?(&1, filters))
        |> Enum.filter(&usable_code?(&1, codes))
        |> Enum.sort_by(& &1.priority)
    }
  end

  defp tax_inclusive?(%Scope{business: nil}), do: false
  defp tax_inclusive?(%Scope{business: business}), do: business.prices_include_tax

  # A coded rule is inert unless the customer quoted the code; an uncoded rule
  # is always in play.
  defp usable_code?(%PriceRule{} = rule, codes) do
    not PriceRule.requires_code?(rule) or String.upcase(rule.code) in codes
  end

  defp normalize_codes(codes) do
    codes
    |> List.wrap()
    |> Enum.filter(&is_binary/1)
    |> Enum.map(&(&1 |> String.trim() |> String.upcase()))
    |> Enum.reject(&(&1 == ""))
  end

  # ===========================================================================
  # Quoting
  # ===========================================================================

  @doc """
  Prices one line.

  `line` carries the variant, its product, the quantity, any chosen modifiers
  and the product's tax rates. Everything else comes from the context, so this
  performs no queries.

  ## Example

      ctx = Pricing.context(scope, channel: "pos")

      Pricing.quote_line(ctx, %{
        variant: variant,
        product: product,
        quantity: Decimal.new(3),
        modifiers: [extra_cheese],
        taxes: [gst]
      })
  """
  @spec quote_line(Context.t(), map()) :: Quote.t()
  def quote_line(%Context{} = ctx, line) do
    variant = Map.fetch!(line, :variant)
    product = Map.get(line, :product)
    quantity = line |> Map.get(:quantity, Decimal.new(1)) |> Money.to_decimal()
    modifiers = Map.get(line, :modifiers, [])
    taxes = Map.get(line, :taxes, [])

    base_price = variant.price
    {list_price, price_list_id} = apply_price_list(ctx, variant, quantity, base_price)
    modifier_total = modifier_delta(modifiers)
    pre_discount = Money.add(list_price, modifier_total)

    {discounted_unit, discounts} =
      apply_rules(ctx, pre_discount, quantity, targeting(variant, product))

    unit_price = Money.round_working(discounted_unit)
    subtotal = unit_price |> Money.mult(quantity) |> Money.round(ctx.currency)

    tax =
      Calculation.compute(subtotal, taxes,
        inclusive: ctx.tax_inclusive,
        currency: ctx.currency
      )

    %Quote{
      variant_id: variant.id,
      product_id: product && product.id,
      currency: ctx.currency,
      quantity: quantity,
      base_price: base_price,
      list_price: list_price,
      price_list_id: price_list_id,
      modifier_total: modifier_total,
      discounts: discounts,
      discount_total: scale_discounts(discounts, quantity, ctx.currency),
      unit_price: unit_price,
      subtotal: subtotal,
      net: tax.net,
      tax_total: tax.tax_total,
      tax_lines: tax.lines,
      gross: tax.gross,
      tax_inclusive: ctx.tax_inclusive
    }
  end

  @doc """
  Prices a whole cart, returning the quotes and their totals.

  Order-level thresholds — "10% off over 5,000" — are checked against the
  subtotal of the already-priced lines, which is why they cannot be handled
  inside `quote_line/2`.
  """
  @spec quote_cart(Context.t(), [map()]) :: %{
          lines: [Quote.t()],
          subtotal: Decimal.t(),
          discount_total: Decimal.t(),
          tax_total: Decimal.t(),
          total: Decimal.t()
        }
  def quote_cart(%Context{} = ctx, lines) do
    quotes = Enum.map(lines, &quote_line(ctx, &1))

    %{
      lines: quotes,
      subtotal: quotes |> Enum.map(& &1.subtotal) |> Money.sum(),
      discount_total: quotes |> Enum.map(& &1.discount_total) |> Money.sum(),
      tax_total: quotes |> Enum.map(& &1.tax_total) |> Money.sum(),
      total: quotes |> Enum.map(& &1.gross) |> Money.sum()
    }
  end

  # --- Price lists ------------------------------------------------------------

  # The first list by priority that prices this variant wins. Lists override
  # each other rather than stacking, so a trade customer at a branch on
  # promotion gets one price with one explanation.
  defp apply_price_list(%Context{price_lists: []}, _variant, _quantity, base_price),
    do: {base_price, nil}

  defp apply_price_list(%Context{} = ctx, variant, quantity, base_price) do
    ctx.price_lists
    |> Enum.sort_by(& &1.priority)
    |> Enum.find_value({base_price, nil}, fn list ->
      case matching_item(list, variant.id, quantity) do
        nil -> nil
        item -> {item.price, list.id}
      end
    end)
  end

  defp matching_item(%PriceList{items: items}, variant_id, quantity) when is_list(items) do
    items
    |> Enum.filter(&(&1.variant_id == variant_id))
    |> PriceListItem.best_for_quantity(quantity)
  end

  defp matching_item(%PriceList{}, _variant_id, _quantity), do: nil

  # --- Modifiers --------------------------------------------------------------

  defp modifier_delta(modifiers) do
    modifiers
    |> Enum.map(&Map.get(&1, :price_delta, Money.zero()))
    |> Money.sum()
  end

  # --- Promotions -------------------------------------------------------------

  # Walks the rules in priority order. A non-stackable rule that applies is the
  # last word; stackable ones keep accumulating on the running price.
  defp apply_rules(%Context{rules: []}, price, _quantity, _target), do: {price, []}

  defp apply_rules(%Context{} = ctx, price, quantity, target) do
    ctx.rules
    |> Enum.filter(&PriceRule.targets?(&1, target))
    |> Enum.filter(&meets_quantity?(&1, quantity))
    |> Enum.reduce_while({price, []}, fn rule, {running, applied} ->
      case discount_for(rule, running, quantity, ctx.currency) do
        nil ->
          {:cont, {running, applied}}

        amount ->
          next = running |> Money.sub(amount) |> Money.clamp_non_negative()
          entry = %{rule_id: rule.id, name: rule.name, kind: rule.kind, amount: amount}

          if rule.stackable do
            {:cont, {next, applied ++ [entry]}}
          else
            {:halt, {next, applied ++ [entry]}}
          end
      end
    end)
  end

  defp meets_quantity?(%PriceRule{min_quantity: nil}, _quantity), do: true

  defp meets_quantity?(%PriceRule{min_quantity: minimum}, quantity),
    do: Decimal.compare(quantity, minimum) != :lt

  # Returns the per-unit discount, or nil when the rule produces nothing.
  #
  # These stay at working precision — four places — and are *not* rounded to the
  # currency. A per-unit figure rounded to the penny and then multiplied back up
  # cannot reproduce the line total it was derived from: buy-two-get-one on
  # three units at 100 gives a saving of 33.33 each, and 66.67 x 3 is 200.01,
  # not the 200.00 the shop advertised. Rounding happens once, on the line
  # subtotal, where the customer is actually charged.
  defp discount_for(%PriceRule{kind: "percent_off"} = rule, price, _quantity, _currency) do
    price
    |> Money.percent_of(rule.value)
    |> cap(rule.max_discount_amount)
    |> Money.round_working()
    |> nil_if_zero()
  end

  defp discount_for(%PriceRule{kind: "amount_off"} = rule, price, _quantity, _currency) do
    rule.value
    |> Money.min(price)
    |> Money.round_working()
    |> nil_if_zero()
  end

  defp discount_for(%PriceRule{kind: "override_price"} = rule, price, _quantity, _currency) do
    price
    |> Money.sub(rule.value)
    |> Money.clamp_non_negative()
    |> Money.round_working()
    |> nil_if_zero()
  end

  # Buy-two-get-one is expressed per unit so it composes with everything else:
  # the total saving is spread across the whole line rather than zeroing one
  # unit, which keeps the unit price on the receipt honest.
  defp discount_for(%PriceRule{kind: "bogo"} = rule, price, quantity, _currency) do
    group_size = Money.add(rule.buy_quantity, rule.get_quantity)

    if Decimal.compare(quantity, group_size) == :lt do
      nil
    else
      complete_groups = quantity |> Money.div(group_size) |> Decimal.round(0, :floor)
      free_units = Money.mult(complete_groups, rule.get_quantity)

      total_saving =
        price
        |> Money.mult(free_units)
        |> Money.percent_of(rule.get_discount_percent || Decimal.new(100))

      total_saving
      |> Money.div(quantity)
      |> Money.round_working()
      |> nil_if_zero()
    end
  end

  defp discount_for(%PriceRule{}, _price, _quantity, _currency), do: nil

  defp cap(amount, nil), do: amount
  defp cap(amount, maximum), do: Money.min(amount, maximum)

  defp nil_if_zero(amount), do: if(Money.positive?(amount), do: amount, else: nil)

  # Discounts are computed per unit; the line's saving is that times quantity.
  defp scale_discounts(discounts, quantity, currency) do
    discounts
    |> Enum.map(& &1.amount)
    |> Money.sum()
    |> Money.mult(quantity)
    |> Money.round(currency)
  end

  # The facts a rule matches against. Category ancestry is included so a rule
  # on "Beverages" also catches things filed under "Beverages / Hot".
  defp targeting(variant, nil), do: [variant_id: variant.id]

  defp targeting(variant, product) do
    [
      variant_id: variant.id,
      product_id: product.id,
      brand_id: product.brand_id,
      category_ids: category_ancestry(product)
    ]
  end

  # Matching on the struct rather than a bare map matters: an unloaded
  # association is also a struct, and reading `path` off it would crash the
  # whole quote rather than falling back to the id.
  defp category_ancestry(%{category: %Category{} = category}) do
    [category.id | Category.ancestor_ids(category)]
  end

  defp category_ancestry(%{category_id: nil}), do: []
  defp category_ancestry(%{category_id: category_id}), do: [category_id]
  defp category_ancestry(_product), do: []

  # ===========================================================================
  # Price lists — CRUD
  # ===========================================================================

  @doc "Lists the business's price lists."
  @spec list_price_lists(Scope.t()) :: [PriceList.t()]
  def list_price_lists(%Scope{} = scope) do
    PriceList
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> order_by([list], asc: list.priority, asc: list.name)
    |> preload(:items)
    |> Repo.all()
  end

  @doc "Fetches a price list."
  @spec fetch_price_list(Scope.t(), Ecto.UUID.t()) ::
          {:ok, PriceList.t()} | {:error, :not_found}
  def fetch_price_list(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      PriceList
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([list], list.id == ^id)
      |> preload(:items)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        list -> {:ok, list}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Creates a price list."
  @spec create_price_list(Scope.t(), map()) :: {:ok, PriceList.t()} | {:error, Ecto.Changeset.t()}
  def create_price_list(%Scope{} = scope, attrs) do
    %PriceList{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> PriceList.changeset(default_currency(scope, attrs))
    |> Repo.insert()
  end

  @doc "Updates a price list."
  @spec update_price_list(Scope.t(), PriceList.t(), map()) ::
          {:ok, PriceList.t()} | {:error, Ecto.Changeset.t()}
  def update_price_list(%Scope{}, %PriceList{} = list, attrs) do
    list |> PriceList.changeset(attrs) |> Repo.update()
  end

  @doc "Soft-deletes a price list."
  @spec delete_price_list(Scope.t(), PriceList.t()) ::
          {:ok, PriceList.t()} | {:error, Ecto.Changeset.t()}
  def delete_price_list(%Scope{}, %PriceList{} = list) do
    list |> PriceList.soft_delete_changeset() |> Repo.update()
  end

  @doc """
  Sets a variant's price on a list, replacing any existing entry at the same
  quantity break.
  """
  @spec put_price(Scope.t(), PriceList.t(), map()) ::
          {:ok, PriceListItem.t()} | {:error, Ecto.Changeset.t()}
  def put_price(%Scope{}, %PriceList{} = list, attrs) do
    attrs = attrs |> stringify() |> Map.put("price_list_id", list.id)

    %PriceListItem{}
    |> PriceListItem.changeset(attrs)
    |> Repo.insert(
      on_conflict: {:replace, [:price, :updated_at]},
      conflict_target: [:price_list_id, :variant_id, :min_quantity]
    )
  end

  @doc "Removes a variant's price from a list."
  @spec delete_price(Scope.t(), PriceList.t(), Ecto.UUID.t()) :: :ok
  def delete_price(%Scope{}, %PriceList{} = list, variant_id) do
    Repo.delete_all(
      from item in PriceListItem,
        where: item.price_list_id == ^list.id and item.variant_id == ^variant_id
    )

    :ok
  end

  # ===========================================================================
  # Promotions — CRUD
  # ===========================================================================

  @doc "Lists the business's promotions, most important first."
  @spec list_rules(Scope.t()) :: [PriceRule.t()]
  def list_rules(%Scope{} = scope) do
    PriceRule
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> order_by([rule], asc: rule.priority, desc: rule.inserted_at)
    |> Repo.all()
  end

  @doc "Fetches a promotion."
  @spec fetch_rule(Scope.t(), Ecto.UUID.t()) :: {:ok, PriceRule.t()} | {:error, :not_found}
  def fetch_rule(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      PriceRule
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([rule], rule.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        rule -> {:ok, rule}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Creates a promotion."
  @spec create_rule(Scope.t(), map()) :: {:ok, PriceRule.t()} | {:error, Ecto.Changeset.t()}
  def create_rule(%Scope{} = scope, attrs) do
    %PriceRule{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> PriceRule.changeset(attrs)
    |> Repo.insert()
  end

  @doc "Updates a promotion."
  @spec update_rule(Scope.t(), PriceRule.t(), map()) ::
          {:ok, PriceRule.t()} | {:error, Ecto.Changeset.t()}
  def update_rule(%Scope{}, %PriceRule{} = rule, attrs) do
    rule |> PriceRule.changeset(attrs) |> Repo.update()
  end

  @doc "Soft-deletes a promotion."
  @spec delete_rule(Scope.t(), PriceRule.t()) ::
          {:ok, PriceRule.t()} | {:error, Ecto.Changeset.t()}
  def delete_rule(%Scope{}, %PriceRule{} = rule) do
    rule |> PriceRule.soft_delete_changeset() |> Repo.update()
  end

  @doc """
  Records that a usage-limited promotion was redeemed.

  An atomic increment rather than a read-modify-write: two tills redeeming the
  last use of a coupon at the same moment must not both succeed.
  """
  @spec record_usage(PriceRule.t(), pos_integer()) :: :ok
  def record_usage(%PriceRule{} = rule, count \\ 1) do
    Repo.update_all(
      from(r in PriceRule, where: r.id == ^rule.id),
      inc: [used_count: count]
    )

    :ok
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp load_price_lists(%Scope{} = scope) do
    PriceList
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([list], list.is_active)
    |> preload(:items)
    |> Repo.all()
  end

  defp load_rules(%Scope{} = scope) do
    PriceRule
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([rule], rule.is_active)
    |> Repo.all()
  end

  defp default_currency(%Scope{business: nil}, attrs), do: stringify(attrs)

  defp default_currency(%Scope{business: business}, attrs) do
    attrs |> stringify() |> Map.put_new("currency", business.currency)
  end

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
  end

  defp stringify(_attrs), do: %{}
end
