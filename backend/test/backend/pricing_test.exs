defmodule Kaarobar.PricingTest do
  @moduledoc """
  What a line costs, and why.

  The order of operations is the thing being tested. Each step changes the base
  the next one works from, so getting the sequence wrong produces numbers that
  look plausible and are wrong by a few percent on every sale.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Catalog.Product
  alias Kaarobar.Pricing
  alias Kaarobar.Pricing.Quote
  alias Kaarobar.Taxes

  defp d(value), do: Decimal.new(value)

  defp assert_money(actual, expected) do
    assert Decimal.equal?(actual, Decimal.new(expected)),
           "expected #{expected}, got #{Decimal.to_string(actual, :normal)}"
  end

  defp line(variant, quantity, opts \\ []) do
    %{
      variant: variant,
      product: Keyword.get(opts, :product),
      quantity: d(quantity),
      modifiers: Keyword.get(opts, :modifiers, []),
      taxes: Keyword.get(opts, :taxes, [])
    }
  end

  setup do
    %{scope: scope, business: business} = owner_scope()
    product = product_fixture(scope, %{"name" => "Widget", "price" => "100.00"})

    %{
      scope: scope,
      business: business,
      product: product,
      variant: Product.default_variant(product)
    }
  end

  # ===========================================================================
  # Base price
  # ===========================================================================

  describe "with nothing configured" do
    test "the shelf price is the price", %{scope: scope, variant: variant} do
      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      assert_money(quote.base_price, "100.00")
      assert_money(quote.unit_price, "100.00")
      assert_money(quote.subtotal, "100.00")
      assert_money(quote.gross, "100.00")
      assert quote.discounts == []
    end

    test "quantity multiplies the line", %{scope: scope, variant: variant} do
      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "3"))

      assert_money(quote.subtotal, "300.00")
    end

    test "a fractional quantity works, for goods sold by weight", %{
      scope: scope,
      variant: variant
    } do
      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "2.5"))

      assert_money(quote.subtotal, "250.00")
    end
  end

  # ===========================================================================
  # Price lists
  # ===========================================================================

  describe "price lists" do
    test "override the shelf price", %{scope: scope, variant: variant} do
      price_list_fixture(scope, %{"name" => "Trade"}, [
        %{"variant_id" => variant.id, "price" => "85.00"}
      ])

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      assert_money(quote.base_price, "100.00")
      assert_money(quote.list_price, "85.00")
      assert_money(quote.gross, "85.00")
      refute is_nil(quote.price_list_id)
    end

    test "honour quantity breaks", %{scope: scope, variant: variant} do
      price_list_fixture(scope, %{"name" => "Breaks"}, [
        %{"variant_id" => variant.id, "price" => "100.00", "min_quantity" => "1"},
        %{"variant_id" => variant.id, "price" => "85.00", "min_quantity" => "12"}
      ])

      ctx = Pricing.context(scope)

      single = Pricing.quote_line(ctx, line(variant, "1"))
      dozen = Pricing.quote_line(ctx, line(variant, "12"))

      assert_money(single.list_price, "100.00")
      assert_money(dozen.list_price, "85.00")
      assert_money(dozen.subtotal, "1020.00")
    end

    test "the lowest priority wins, and lists do not stack", %{scope: scope, variant: variant} do
      price_list_fixture(scope, %{"name" => "General", "priority" => 100}, [
        %{"variant_id" => variant.id, "price" => "90.00"}
      ])

      price_list_fixture(scope, %{"name" => "Branch", "priority" => 10}, [
        %{"variant_id" => variant.id, "price" => "80.00"}
      ])

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      # 80, not 90 and not 72.
      assert_money(quote.list_price, "80.00")
    end

    test "an expired list does not apply", %{scope: scope, variant: variant} do
      past = DateTime.add(DateTime.utc_now(), -86_400, :second)

      price_list_fixture(
        scope,
        %{"name" => "Ended", "starts_at" => DateTime.add(past, -86_400), "ends_at" => past},
        [%{"variant_id" => variant.id, "price" => "50.00"}]
      )

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      assert_money(quote.list_price, "100.00")
    end

    test "a list for another branch does not apply", %{scope: scope, variant: variant} do
      {:ok, other_branch} = Kaarobar.Tenancy.create_branch(scope, %{"name" => "Elsewhere"})

      price_list_fixture(
        scope,
        %{"name" => "Other branch", "kind" => "branch", "branch_id" => other_branch.id},
        [%{"variant_id" => variant.id, "price" => "50.00"}]
      )

      ctx = Pricing.context(scope, branch_id: scope.branch.id)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      assert_money(quote.list_price, "100.00")
    end
  end

  # ===========================================================================
  # Promotions
  # ===========================================================================

  describe "promotions" do
    test "a percentage comes off the line", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{"name" => "10% off", "kind" => "percent_off", "value" => "10"})

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "2"))

      assert_money(quote.unit_price, "90.00")
      assert_money(quote.subtotal, "180.00")
      assert_money(quote.discount_total, "20.00")
      assert Quote.discount_names(quote) == ["10% off"]
    end

    test "a fixed amount comes off each unit", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{"kind" => "amount_off", "value" => "15"})

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      assert_money(quote.unit_price, "85.00")
    end

    test "an override sets the price outright", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{"kind" => "override_price", "value" => "60"})

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      assert_money(quote.unit_price, "60.00")
    end

    test "a discount cannot make the price negative", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{"kind" => "amount_off", "value" => "500"})

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      refute Kaarobar.Money.negative?(quote.unit_price)
      assert_money(quote.unit_price, "0")
    end

    test "a percentage discount can be capped", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{
        "kind" => "percent_off",
        "value" => "50",
        "max_discount_amount" => "20"
      })

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      # 50% of 100 is 50, capped at 20.
      assert_money(quote.unit_price, "80.00")
    end

    test "a minimum quantity gates the rule", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{
        "kind" => "percent_off",
        "value" => "10",
        "min_quantity" => "5"
      })

      ctx = Pricing.context(scope)

      assert_money(Pricing.quote_line(ctx, line(variant, "4")).unit_price, "100.00")
      assert_money(Pricing.quote_line(ctx, line(variant, "5")).unit_price, "90.00")
    end
  end

  describe "stacking" do
    test "is off by default — the first rule that applies is the last word", %{
      scope: scope,
      variant: variant
    } do
      price_rule_fixture(scope, %{
        "name" => "First",
        "kind" => "percent_off",
        "value" => "20",
        "priority" => 10
      })

      price_rule_fixture(scope, %{
        "name" => "Second",
        "kind" => "percent_off",
        "value" => "50",
        "priority" => 20
      })

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      # 80, not 40. A shop running two promotions almost never means both.
      assert_money(quote.unit_price, "80.00")
      assert Quote.discount_names(quote) == ["First"]
    end

    test "stackable rules accumulate in priority order", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{
        "name" => "First",
        "kind" => "percent_off",
        "value" => "10",
        "priority" => 10,
        "stackable" => true
      })

      price_rule_fixture(scope, %{
        "name" => "Second",
        "kind" => "amount_off",
        "value" => "20",
        "priority" => 20,
        "stackable" => true
      })

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      # 100 less 10% is 90; less 20 is 70.
      assert_money(quote.unit_price, "70.00")
      assert length(quote.discounts) == 2
    end
  end

  describe "buy-one-get-one" do
    test "spreads the saving across the line", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{
        "kind" => "bogo",
        "buy_quantity" => "2",
        "get_quantity" => "1"
      })

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "3"))

      # Three units, one free: 200 for the line, and a unit price that still
      # reads honestly on the receipt.
      assert_money(quote.subtotal, "200.00")
    end

    test "does not apply below the group size", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{
        "kind" => "bogo",
        "buy_quantity" => "2",
        "get_quantity" => "1"
      })

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "2"))

      assert_money(quote.subtotal, "200.00")
      assert quote.discounts == []
    end

    test "applies once per complete group", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{
        "kind" => "bogo",
        "buy_quantity" => "2",
        "get_quantity" => "1"
      })

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "6"))

      # Two complete groups, so two free.
      assert_money(quote.subtotal, "400.00")
    end
  end

  describe "targeting" do
    test "a rule on one product leaves others alone", %{
      scope: scope,
      product: product,
      variant: variant
    } do
      other = product_fixture(scope, %{"name" => "Other", "price" => "100.00"})
      other_variant = Product.default_variant(other)

      price_rule_fixture(scope, %{
        "kind" => "percent_off",
        "value" => "10",
        "scope" => "product",
        "target_id" => product.id
      })

      ctx = Pricing.context(scope)

      assert_money(Pricing.quote_line(ctx, line(variant, "1", product: product)).unit_price, "90.00")

      assert_money(
        Pricing.quote_line(ctx, line(other_variant, "1", product: other)).unit_price,
        "100.00"
      )
    end

    test "a category rule catches products in its subtree", %{scope: scope} do
      root = category_fixture(scope, %{"name" => "Beverages"})
      child = category_fixture(scope, %{"name" => "Hot", "parent_id" => root.id})

      tea = product_fixture(scope, %{"name" => "Tea", "price" => "100", "category_id" => child.id})
      {:ok, tea} = Kaarobar.Catalog.fetch_product(scope, tea.id)

      price_rule_fixture(scope, %{
        "kind" => "percent_off",
        "value" => "10",
        "scope" => "category",
        "target_id" => root.id
      })

      ctx = Pricing.context(scope)

      quote =
        Pricing.quote_line(ctx, line(Product.default_variant(tea), "1", product: tea))

      assert_money(quote.unit_price, "90.00")
    end
  end

  describe "coupon codes" do
    test "a coded rule is inert until the code is quoted", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{
        "kind" => "percent_off",
        "value" => "25",
        "code" => "SUMMER"
      })

      without = Pricing.context(scope)
      with_code = Pricing.context(scope, coupon_codes: ["SUMMER"])

      assert_money(Pricing.quote_line(without, line(variant, "1")).unit_price, "100.00")
      assert_money(Pricing.quote_line(with_code, line(variant, "1")).unit_price, "75.00")
    end

    test "the code is matched case-insensitively", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{"kind" => "percent_off", "value" => "25", "code" => "SUMMER"})

      ctx = Pricing.context(scope, coupon_codes: ["summer"])

      assert_money(Pricing.quote_line(ctx, line(variant, "1")).unit_price, "75.00")
    end

    test "a wrong code does nothing", %{scope: scope, variant: variant} do
      price_rule_fixture(scope, %{"kind" => "percent_off", "value" => "25", "code" => "SUMMER"})

      ctx = Pricing.context(scope, coupon_codes: ["WINTER"])

      assert_money(Pricing.quote_line(ctx, line(variant, "1")).unit_price, "100.00")
    end

    test "an exhausted rule stops applying", %{scope: scope, variant: variant} do
      rule =
        price_rule_fixture(scope, %{
          "kind" => "percent_off",
          "value" => "25",
          "usage_limit" => 1
        })

      :ok = Pricing.record_usage(rule)

      ctx = Pricing.context(scope)

      assert_money(Pricing.quote_line(ctx, line(variant, "1")).unit_price, "100.00")
    end
  end

  # ===========================================================================
  # Tax interaction
  # ===========================================================================

  describe "tax" do
    test "is charged on the discounted amount, not the shelf price", %{
      scope: scope,
      variant: variant
    } do
      tax = tax_fixture(scope, %{"rate" => "0.17"})
      price_rule_fixture(scope, %{"kind" => "percent_off", "value" => "10"})

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1", taxes: [tax]))

      # Tax is owed on what the customer paid — 90, not 100. Taxing the
      # pre-discount amount overcharges the customer and over-remits.
      assert_money(quote.net, "90.00")
      assert_money(quote.tax_total, "15.30")
      assert_money(quote.gross, "105.30")
    end

    test "an inclusive business backs the tax out of the shelf price", %{
      scope: scope,
      business: business,
      variant: variant
    } do
      {:ok, _updated} =
        Kaarobar.Tenancy.update_business(scope, business, %{"prices_include_tax" => true})

      {:ok, reloaded} = Kaarobar.Tenancy.fetch_business(scope, business.id)
      inclusive_scope = Kaarobar.Scope.put_business(scope, reloaded)

      tax = tax_fixture(inclusive_scope, %{"rate" => "0.17"})

      ctx = Pricing.context(inclusive_scope)
      quote = Pricing.quote_line(ctx, line(variant, "1", taxes: [tax]))

      assert quote.tax_inclusive
      assert_money(quote.gross, "100.00")
      assert_money(quote.net, "85.47")
      assert_money(quote.tax_total, "14.53")
    end

    test "rates come from the product's tax group", %{scope: scope} do
      tax = tax_fixture(scope, %{"rate" => "0.17"})
      group = tax_group_fixture(scope, [tax])

      product = product_fixture(scope, %{"price" => "100.00", "tax_group_id" => group.id})
      {:ok, product} = Kaarobar.Catalog.fetch_product(scope, product.id)

      rates = Taxes.rates_for(scope, product)

      assert [%{id: tax_id}] = rates
      assert tax_id == tax.id
    end
  end

  # ===========================================================================
  # Modifiers
  # ===========================================================================

  describe "modifiers" do
    test "add to the unit price before discounting", %{scope: scope, variant: variant} do
      extra_cheese = %{price_delta: d("50.00")}
      price_rule_fixture(scope, %{"kind" => "percent_off", "value" => "10"})

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1", modifiers: [extra_cheese]))

      # 100 plus 50 is 150; less 10% is 135. Discounting before the add-on
      # would give 140, which is a different promise to the customer.
      assert_money(quote.modifier_total, "50.00")
      assert_money(quote.unit_price, "135.00")
    end

    test "a negative delta is honoured", %{scope: scope, variant: variant} do
      no_cheese = %{price_delta: d("-20.00")}

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1", modifiers: [no_cheese]))

      assert_money(quote.unit_price, "80.00")
    end
  end

  # ===========================================================================
  # Carts
  # ===========================================================================

  describe "quote_cart/2" do
    test "totals the lines", %{scope: scope, variant: variant} do
      other = product_fixture(scope, %{"name" => "Other", "price" => "250.00"})

      ctx = Pricing.context(scope)

      result =
        Pricing.quote_cart(ctx, [
          line(variant, "2"),
          line(Product.default_variant(other), "1")
        ])

      assert length(result.lines) == 2
      assert_money(result.subtotal, "450.00")
      assert_money(result.total, "450.00")
    end

    test "prices every line at the same instant", %{scope: scope, variant: variant} do
      ctx = Pricing.context(scope)

      # The context fixes `at`, so a time-limited promotion cannot expire
      # between line three and line four of the same sale.
      assert %DateTime{} = ctx.at

      result = Pricing.quote_cart(ctx, [line(variant, "1"), line(variant, "1")])

      assert [first, second] = result.lines
      assert Decimal.equal?(first.unit_price, second.unit_price)
    end
  end

  # ===========================================================================
  # Isolation
  # ===========================================================================

  describe "tenant isolation" do
    test "another shop's promotions do not apply", %{scope: scope, variant: variant} do
      %{scope: other} = owner_scope()
      price_rule_fixture(other, %{"kind" => "percent_off", "value" => "50"})

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      assert_money(quote.unit_price, "100.00")
    end

    test "another shop's price lists do not apply", %{scope: scope, variant: variant} do
      %{scope: other} = owner_scope()
      other_variant = variant_fixture(other, %{"price" => "999"})

      price_list_fixture(other, %{"name" => "Theirs"}, [
        %{"variant_id" => other_variant.id, "price" => "1.00"}
      ])

      ctx = Pricing.context(scope)
      quote = Pricing.quote_line(ctx, line(variant, "1"))

      assert_money(quote.list_price, "100.00")
    end
  end
end
