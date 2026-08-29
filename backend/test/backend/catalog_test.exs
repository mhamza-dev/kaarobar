defmodule Kaarobar.CatalogTest do
  @moduledoc """
  The phase gate: one schema, every kind of shop.

  The `describe "one schema, four verticals"` block is the claim this whole
  design rests on. If a clothing matrix, a salon service, a restaurant dish
  with a recipe and a batch-tracked pesticide cannot coexist in these tables,
  the alternative is a products table per vertical and the rest of the system
  branching on which one it is.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Catalog
  alias Kaarobar.Catalog.Category
  alias Kaarobar.Catalog.Product
  alias Kaarobar.Catalog.ProductVariant

  defp d(value), do: Decimal.new(value)

  defp first_allowed_kind(type) do
    type |> Kaarobar.Verticals.product_kinds_for() |> List.first()
  end

  # ===========================================================================
  # The gate
  # ===========================================================================

  describe "one schema, four verticals" do
    test "a clothing shop gets a size × colour matrix" do
      %{scope: scope} = owner_scope(business_type: "fashion")

      sizes = option_type_fixture(scope, "Size", ["S", "M", "L"])
      colours = option_type_fixture(scope, "Colour", ["Blue", "Red"])

      shirt = product_fixture(scope, %{"name" => "Oxford Shirt", "price" => "2500.00"})

      {:ok, variants} =
        Catalog.generate_matrix(
          scope,
          shirt,
          [Enum.map(sizes.option_values, & &1.id), Enum.map(colours.option_values, & &1.id)],
          %{"price" => "2500.00"}
        )

      # Three sizes times two colours.
      assert length(variants) == 6

      names = Enum.map(variants, & &1.name) |> Enum.sort()
      assert "S / Blue" in names
      assert "L / Red" in names

      # Plus the default variant the product was created with.
      assert length(Catalog.list_variants(scope, shirt)) == 7
    end

    test "a salon gets a service with a duration and no stock" do
      %{scope: scope} = owner_scope(business_type: "salon")

      cut =
        product_fixture(scope, %{
          "name" => "Cut and blow dry",
          "kind" => "service",
          "price" => "1800.00",
          "service_duration_minutes" => 45
        })

      assert cut.kind == "service"
      assert cut.service_duration_minutes == 45
      # A haircut with a stock level produces low-stock alerts for haircuts.
      refute cut.tracks_stock
      refute Product.stocked?(cut)
    end

    test "a restaurant gets a dish with modifiers and a recipe" do
      %{scope: scope} = owner_scope(business_type: "restaurant")

      bun = variant_fixture(scope, %{"name" => "Burger bun", "price" => "30.00"})
      patty = variant_fixture(scope, %{"name" => "Beef patty", "price" => "180.00"})

      burger = product_fixture(scope, %{"name" => "Beef Burger", "price" => "650.00"})
      burger_variant = Product.default_variant(burger)

      {:ok, _bun_component} =
        Catalog.add_component(scope, burger_variant, %{
          "component_variant_id" => bun.id,
          "kind" => "recipe",
          "quantity" => "1"
        })

      {:ok, _patty_component} =
        Catalog.add_component(scope, burger_variant, %{
          "component_variant_id" => patty.id,
          "kind" => "recipe",
          "quantity" => "1",
          "wastage_percent" => "10"
        })

      {:ok, spice} =
        Catalog.create_modifier_group(scope, %{
          "name" => "Spice level",
          "selection" => "single",
          "min_select" => 1,
          "modifiers" => [
            %{"name" => "Mild", "price_delta" => "0"},
            %{"name" => "Hot", "price_delta" => "0"}
          ]
        })

      {:ok, _attachment} = Catalog.attach_modifier_group(scope, burger, spice)

      # Selling one burger draws down one bun and, with 10% wastage, more than
      # one patty.
      exploded = Catalog.explode(scope, burger_variant, d("1"))

      assert length(exploded) == 2
      bun_line = Enum.find(exploded, &(&1.variant_id == bun.id))
      patty_line = Enum.find(exploded, &(&1.variant_id == patty.id))

      assert Decimal.equal?(bun_line.quantity, d("1"))
      assert Decimal.compare(patty_line.quantity, d("1")) == :gt
      assert length(spice.modifiers) == 2
    end

    test "a pesticide dealer gets enforced batch tracking, sold by weight" do
      %{scope: scope} = owner_scope(business_type: "agri_supplies")

      {:ok, litre} =
        Catalog.create_unit(scope, %{
          "code" => "l",
          "name" => "Litre",
          "dimension" => "volume",
          "factor_to_base" => "1000",
          "precision" => 3
        })

      herbicide =
        product_fixture(scope, %{
          "name" => "Glyphosate 41%",
          "price" => "1450.00",
          "unit_id" => litre.id,
          "is_weighted" => true,
          "hazard_class" => "III",
          "registration_number" => "PK-2026-0041"
        })

      # Not requested, and not optional: recalls happen by lot number and
      # expired stock is illegal to sell.
      assert herbicide.tracks_batch
      assert herbicide.tracks_stock
      assert herbicide.is_weighted
      assert herbicide.hazard_class == "III"
      assert herbicide.registration_number == "PK-2026-0041"
    end

    test "all four coexist in the same tables" do
      # The point of the gate: these are rows in one products table, not four
      # schemas that merely look alike.
      for type <- ~w(fashion salon restaurant agri_supplies laundry rental) do
        %{scope: scope} = owner_scope(business_type: type)
        product = product_fixture(scope, %{"kind" => first_allowed_kind(type)})

        assert %Product{} = product
        assert %ProductVariant{} = Product.default_variant(product)
      end
    end
  end

  # ===========================================================================
  # The invariant
  # ===========================================================================

  describe "every product has a variant" do
    setup do
      %{scope: scope} = owner_scope()
      %{scope: scope}
    end

    test "created together, in one transaction", %{scope: scope} do
      product = product_fixture(scope, %{"price" => "250.00", "sku" => "RICE-5KG"})

      assert [variant] = Catalog.list_variants(scope, product)
      assert variant.is_default
      assert variant.sku == "RICE-5KG"
      assert Decimal.equal?(variant.price, d("250.00"))
    end

    test "an invalid product creates nothing at all", %{scope: scope} do
      assert {:error, changeset} = Catalog.create_product(scope, %{"price" => "10"})

      assert errors_on(changeset).name != []
      assert Repo.aggregate(ProductVariant, :count) == 0
    end

    test "the default variant cannot be archived", %{scope: scope} do
      product = product_fixture(scope)
      variant = Product.default_variant(product)

      assert {:error, :conflict} = Catalog.archive_variant(scope, variant)
    end

    test "archiving a product archives its variants", %{scope: scope} do
      product = product_fixture(scope)

      {:ok, _archived} = Catalog.archive_product(scope, product)

      assert Catalog.list_variants(scope, product) == []
      assert {:error, :not_found} = Catalog.fetch_product(scope, product.id)
    end
  end

  # ===========================================================================
  # Kind rules
  # ===========================================================================

  describe "product kinds" do
    test "a shop cannot create a kind its vertical does not sell" do
      %{scope: scope} = owner_scope(business_type: "barbershop")

      assert {:error, changeset} =
               Catalog.create_product(scope, %{
                 "name" => "Party marquee",
                 "kind" => "rental",
                 "price" => "5000"
               })

      assert [message] = errors_on(changeset).kind
      assert message =~ "not sold by"
    end

    test "a service never tracks stock, however it is asked for" do
      %{scope: scope} = owner_scope(business_type: "salon")

      service =
        product_fixture(scope, %{
          "name" => "Manicure",
          "kind" => "service",
          "service_duration_minutes" => 30,
          "tracks_stock" => true,
          "tracks_batch" => true
        })

      refute service.tracks_stock
      refute service.tracks_batch
    end

    test "batch and serial tracking require stock behind them" do
      %{scope: scope} = owner_scope()

      product =
        product_fixture(scope, %{
          "tracks_stock" => false,
          "tracks_batch" => true,
          "tracks_serial" => true
        })

      refute product.tracks_batch
      refute product.tracks_serial
    end
  end

  # ===========================================================================
  # Scanning
  # ===========================================================================

  describe "scan/2" do
    setup do
      %{scope: scope} = owner_scope()
      product = product_fixture(scope, %{"barcode" => "8964000123456"})
      %{scope: scope, product: product, variant: Product.default_variant(product)}
    end

    test "finds a variant by its primary barcode", %{scope: scope, variant: variant} do
      assert {:ok, found} = Catalog.scan(scope, "8964000123456")
      assert found.id == variant.id
      assert found.product.id == variant.product_id
    end

    test "tolerates surrounding whitespace from a scanner", %{scope: scope} do
      assert {:ok, _variant} = Catalog.scan(scope, "  8964000123456 ")
    end

    test "finds a variant by an alternate barcode", %{scope: scope, variant: variant} do
      {:ok, _barcode} =
        Catalog.add_barcode(scope, variant, %{"barcode" => "5012345678900", "kind" => "ean13"})

      assert {:ok, found} = Catalog.scan(scope, "5012345678900")
      assert found.id == variant.id
    end

    test "an unknown code finds nothing", %{scope: scope} do
      assert {:error, :not_found} = Catalog.scan(scope, "0000000000000")
      assert {:error, :not_found} = Catalog.scan(scope, "")
    end

    test "another shop's barcode is invisible", %{scope: scope} do
      %{scope: other} = owner_scope()
      product_fixture(other, %{"barcode" => "7777777777777"})

      assert {:error, :not_found} = Catalog.scan(scope, "7777777777777")
    end

    test "an archived product stops scanning", %{scope: scope, product: product} do
      {:ok, _archived} = Catalog.archive_product(scope, product)

      assert {:error, :not_found} = Catalog.scan(scope, "8964000123456")
    end

    test "two products cannot share a barcode", %{scope: scope} do
      assert {:error, changeset} =
               Catalog.create_product(scope, %{
                 "name" => "Impostor",
                 "price" => "10",
                 "barcode" => "8964000123456"
               })

      assert errors_on(changeset).barcode != []
    end
  end

  # ===========================================================================
  # Search
  # ===========================================================================

  describe "search" do
    setup do
      %{scope: scope} = owner_scope()

      product_fixture(scope, %{"name" => "Basmati Rice 5kg", "sku" => "RICE-5", "price" => "2400"})
      product_fixture(scope, %{"name" => "Sunflower Oil 1L", "sku" => "OIL-1", "price" => "600"})

      %{scope: scope}
    end

    test "matches a substring of the name", %{scope: scope} do
      assert [found] = Catalog.list_products(scope, %{"q" => "basmati"})
      assert found.name == "Basmati Rice 5kg"
    end

    test "is case-insensitive", %{scope: scope} do
      assert [_found] = Catalog.list_products(scope, %{"q" => "RICE"})
    end

    test "matches a partial SKU", %{scope: scope} do
      assert [found] = Catalog.list_products(scope, %{"q" => "OIL-"})
      assert found.name == "Sunflower Oil 1L"
    end

    test "returns nothing for no match", %{scope: scope} do
      assert Catalog.list_products(scope, %{"q" => "zzzzz"}) == []
    end

    test "filters by kind", %{scope: scope} do
      assert length(Catalog.list_products(scope, %{"kind" => "item"})) == 2
      assert Catalog.list_products(scope, %{"kind" => "service"}) == []
    end
  end

  # ===========================================================================
  # Categories
  # ===========================================================================

  describe "categories" do
    setup do
      %{scope: scope} = owner_scope()
      %{scope: scope}
    end

    test "a root has depth zero and a bare path", %{scope: scope} do
      root = category_fixture(scope, %{"name" => "Beverages"})

      assert root.depth == 0
      assert root.path == "/"
      assert Category.ancestor_ids(root) == []
    end

    test "a child records its ancestry in its path", %{scope: scope} do
      root = category_fixture(scope, %{"name" => "Beverages"})
      child = category_fixture(scope, %{"name" => "Hot", "parent_id" => root.id})

      assert child.depth == 1
      assert child.path == "/" <> root.id <> "/"
      assert Category.ancestor_ids(child) == [root.id]
    end

    test "nesting is capped", %{scope: scope} do
      deepest =
        Enum.reduce(1..Category.max_depth(), category_fixture(scope, %{"name" => "L0"}), fn n,
                                                                                            parent ->
          category_fixture(scope, %{"name" => "L#{n}", "parent_id" => parent.id})
        end)

      assert {:error, changeset} =
               Catalog.create_category(scope, %{"name" => "Too deep", "parent_id" => deepest.id})

      assert errors_on(changeset).depth != []
    end

    test "moving a category rewrites its descendants' paths", %{scope: scope} do
      old_parent = category_fixture(scope, %{"name" => "Old"})
      new_parent = category_fixture(scope, %{"name" => "New"})
      moved = category_fixture(scope, %{"name" => "Moved", "parent_id" => old_parent.id})
      leaf = category_fixture(scope, %{"name" => "Leaf", "parent_id" => moved.id})

      {:ok, _updated} = Catalog.update_category(scope, moved, %{"parent_id" => new_parent.id})

      {:ok, reloaded_leaf} = Catalog.fetch_category(scope, leaf.id)

      assert new_parent.id in Category.ancestor_ids(reloaded_leaf)
      refute old_parent.id in Category.ancestor_ids(reloaded_leaf)
      assert reloaded_leaf.depth == 2
    end

    test "a category cannot be moved beneath its own descendant", %{scope: scope} do
      parent = category_fixture(scope, %{"name" => "Parent"})
      child = category_fixture(scope, %{"name" => "Child", "parent_id" => parent.id})

      assert {:error, :cyclic} =
               Catalog.update_category(scope, parent, %{"parent_id" => child.id})
    end

    test "a category with children cannot be archived", %{scope: scope} do
      parent = category_fixture(scope, %{"name" => "Parent"})
      _child = category_fixture(scope, %{"name" => "Child", "parent_id" => parent.id})

      assert {:error, :conflict} = Catalog.archive_category(scope, parent)
    end

    test "another shop's category cannot be used as a parent", %{scope: scope} do
      %{scope: other} = owner_scope()
      theirs = category_fixture(other, %{"name" => "Theirs"})

      assert {:error, :not_found} =
               Catalog.create_category(scope, %{"name" => "Mine", "parent_id" => theirs.id})
    end

    test "filtering by category tree includes descendants", %{scope: scope} do
      root = category_fixture(scope, %{"name" => "Beverages"})
      child = category_fixture(scope, %{"name" => "Hot", "parent_id" => root.id})

      product_fixture(scope, %{"name" => "Tea", "category_id" => child.id})
      product_fixture(scope, %{"name" => "Bread"})

      found = Catalog.list_products(scope, %{"in_category_tree" => root.id})

      assert Enum.map(found, & &1.name) == ["Tea"]
    end
  end

  # ===========================================================================
  # Bundles and recipes
  # ===========================================================================

  describe "components" do
    setup do
      %{scope: scope} = owner_scope()
      %{scope: scope}
    end

    test "a bundle explodes into its parts", %{scope: scope} do
      shampoo = variant_fixture(scope, %{"name" => "Shampoo", "price" => "400"})
      conditioner = variant_fixture(scope, %{"name" => "Conditioner", "price" => "450"})

      pack = product_fixture(scope, %{"name" => "Hair pack", "price" => "750"})
      pack_variant = Product.default_variant(pack)

      for component <- [shampoo, conditioner] do
        {:ok, _added} =
          Catalog.add_component(scope, pack_variant, %{
            "component_variant_id" => component.id,
            "kind" => "bundle",
            "quantity" => "1"
          })
      end

      exploded = Catalog.explode(scope, pack_variant, d("2"))

      assert length(exploded) == 2
      assert Enum.all?(exploded, &Decimal.equal?(&1.quantity, d("2")))
    end

    test "wastage increases what is actually consumed", %{scope: scope} do
      onion = variant_fixture(scope, %{"name" => "Onion", "price" => "40"})
      curry = product_fixture(scope, %{"name" => "Curry", "price" => "500"})

      {:ok, component} =
        Catalog.add_component(scope, Product.default_variant(curry), %{
          "component_variant_id" => onion.id,
          "kind" => "recipe",
          "quantity" => "100",
          "wastage_percent" => "10"
        })

      # 100g needed with 10% lost in trimming means issuing 111.11g, not 110.
      consumed = Kaarobar.Catalog.ProductComponent.consumed_quantity(component)

      assert Decimal.compare(consumed, d("111")) == :gt
      assert Decimal.compare(consumed, d("112")) == :lt
    end

    test "a component cannot contain itself", %{scope: scope} do
      variant = variant_fixture(scope)

      assert {:error, :cyclic} =
               Catalog.add_component(scope, variant, %{
                 "component_variant_id" => variant.id,
                 "kind" => "bundle",
                 "quantity" => "1"
               })
    end

    test "an indirect cycle is refused too", %{scope: scope} do
      a = variant_fixture(scope, %{"name" => "A"})
      b = variant_fixture(scope, %{"name" => "B"})
      c = variant_fixture(scope, %{"name" => "C"})

      {:ok, _ab} =
        Catalog.add_component(scope, a, %{
          "component_variant_id" => b.id,
          "kind" => "bundle",
          "quantity" => "1"
        })

      {:ok, _bc} =
        Catalog.add_component(scope, b, %{
          "component_variant_id" => c.id,
          "kind" => "bundle",
          "quantity" => "1"
        })

      # C containing A would close the loop A → B → C → A, and checkout would
      # recurse until it ran out of stack.
      assert {:error, :cyclic} =
               Catalog.add_component(scope, c, %{
                 "component_variant_id" => a.id,
                 "kind" => "bundle",
                 "quantity" => "1"
               })
    end

    test "nested bundles multiply through", %{scope: scope} do
      leaf = variant_fixture(scope, %{"name" => "Leaf", "price" => "10"})
      middle = variant_fixture(scope, %{"name" => "Middle", "price" => "50"})
      top = variant_fixture(scope, %{"name" => "Top", "price" => "200"})

      {:ok, _one} =
        Catalog.add_component(scope, middle, %{
          "component_variant_id" => leaf.id,
          "kind" => "bundle",
          "quantity" => "3"
        })

      {:ok, _two} =
        Catalog.add_component(scope, top, %{
          "component_variant_id" => middle.id,
          "kind" => "bundle",
          "quantity" => "2"
        })

      # One top is two middles is six leaves.
      assert [%{variant_id: leaf_id, quantity: quantity}] = Catalog.explode(scope, top, d("1"))
      assert leaf_id == leaf.id
      assert Decimal.equal?(quantity, d("6"))
    end
  end

  # ===========================================================================
  # Variants
  # ===========================================================================

  describe "variants" do
    setup do
      %{scope: scope} = owner_scope(business_type: "fashion")
      sizes = option_type_fixture(scope, "Size", ["S", "M"])
      %{scope: scope, sizes: sizes}
    end

    test "the same option combination cannot be created twice", %{scope: scope, sizes: sizes} do
      product = product_fixture(scope)
      [small | _rest] = sizes.option_values

      {:ok, _first} =
        Catalog.create_variant(scope, product, %{
          "price" => "100",
          "option_value_ids" => [small.id]
        })

      assert {:error, :duplicate_combination} =
               Catalog.create_variant(scope, product, %{
                 "price" => "100",
                 "option_value_ids" => [small.id]
               })
    end

    test "regenerating a matrix adds only what is new", %{scope: scope, sizes: sizes} do
      product = product_fixture(scope)
      size_ids = Enum.map(sizes.option_values, & &1.id)

      {:ok, first_pass} = Catalog.generate_matrix(scope, product, [size_ids], %{"price" => "100"})
      assert length(first_pass) == 2

      {:ok, large} = Catalog.create_option_value(scope, sizes, %{"value" => "L"})

      {:ok, second_pass} =
        Catalog.generate_matrix(scope, product, [size_ids ++ [large.id]], %{"price" => "100"})

      # Only the new size, not all three again.
      assert length(second_pass) == 1
    end

    test "margin is derived, never stored", %{scope: scope} do
      variant = variant_fixture(scope, %{"price" => "200", "cost" => "150"})

      assert Decimal.equal?(ProductVariant.margin(variant), d("0.25"))
    end

    test "margin is nil without a cost", %{scope: scope} do
      variant = variant_fixture(scope, %{"price" => "200"})

      assert is_nil(ProductVariant.margin(variant))
    end

    test "an empty barcode is stored as nil, not as an empty string", %{scope: scope} do
      # Two products with a blank barcode field would otherwise collide on the
      # unique index.
      first = variant_fixture(scope, %{"barcode" => ""})
      second = variant_fixture(scope, %{"barcode" => "  "})

      assert is_nil(first.barcode)
      assert is_nil(second.barcode)
    end
  end

  # ===========================================================================
  # Units
  # ===========================================================================

  describe "units" do
    test "convert within a dimension" do
      %{scope: scope} = owner_scope()
      {:ok, _count} = Catalog.seed_units(scope)

      units = Catalog.list_units(scope)
      kg = Enum.find(units, &(&1.code == "kg"))
      gram = Enum.find(units, &(&1.code == "g"))

      assert {:ok, grams} = Kaarobar.Catalog.Unit.convert(d("2.5"), kg, gram)
      assert Decimal.equal?(grams, d("2500"))
    end

    test "refuse to convert across dimensions" do
      %{scope: scope} = owner_scope()
      {:ok, _count} = Catalog.seed_units(scope)

      units = Catalog.list_units(scope)
      kg = Enum.find(units, &(&1.code == "kg"))
      litre = Enum.find(units, &(&1.code == "l"))

      # Kilograms into litres is not a rounding question, it is a mistake — and
      # a silently wrong answer here becomes a wrong stock level.
      assert :error = Kaarobar.Catalog.Unit.convert(d("1"), kg, litre)
    end

    test "seeding is idempotent" do
      %{scope: scope} = owner_scope()

      {:ok, first} = Catalog.seed_units(scope)
      {:ok, second} = Catalog.seed_units(scope)

      assert first > 0
      assert second == 0
      assert length(Catalog.list_units(scope)) == first
    end
  end

  # ===========================================================================
  # Isolation
  # ===========================================================================

  describe "tenant isolation" do
    test "another shop's products are invisible" do
      %{scope: scope} = owner_scope()
      %{scope: other} = owner_scope()

      mine = product_fixture(scope, %{"name" => "Mine"})
      theirs = product_fixture(other, %{"name" => "Theirs"})

      assert Enum.map(Catalog.list_products(scope), & &1.id) == [mine.id]
      assert {:error, :not_found} = Catalog.fetch_product(scope, theirs.id)
    end

    test "a malformed id is a 404, not a crash" do
      %{scope: scope} = owner_scope()

      assert {:error, :not_found} = Catalog.fetch_product(scope, "not-a-uuid")
      assert {:error, :not_found} = Catalog.fetch_variant(scope, "nope")
      assert {:error, :not_found} = Catalog.fetch_category(scope, "'; DROP TABLE products;--")
    end
  end
end
