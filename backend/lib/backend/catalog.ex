defmodule Kaarobar.Catalog do
  @moduledoc """
  Products and everything that describes them.

  ## One invariant above all others

  **Every product has at least one variant.** `create_product/2` creates the
  default variant in the same transaction, and nothing in this module can leave
  a product without one. Stock levels, barcodes, price-list entries and sale
  lines all reference variants, so a product without one is a product that
  cannot be sold, counted or scanned — and the shop finds out at the till.

  It is also what lets a grocer selling one kind of rice and a clothing shop
  selling a size-and-colour matrix share every code path downstream.

  ## The scan path

  `scan/2` is the hottest read in the system: a cashier holding a scanner with
  a customer waiting. It is one indexed lookup on the variant's own `barcode`
  column, with a second lookup against `product_barcodes` only if that misses.
  Nothing about it fans out.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Catalog.Brand
  alias Kaarobar.Catalog.Category
  alias Kaarobar.Catalog.Modifier
  alias Kaarobar.Catalog.ModifierGroup
  alias Kaarobar.Catalog.OptionType
  alias Kaarobar.Catalog.OptionValue
  alias Kaarobar.Catalog.Product
  alias Kaarobar.Catalog.ProductBarcode
  alias Kaarobar.Catalog.ProductComponent
  alias Kaarobar.Catalog.ProductModifierGroup
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Catalog.Unit
  alias Kaarobar.Catalog.VariantOptionValue
  alias Kaarobar.Ecto.UUIDv7
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope

  @product_preloads [:category, :brand, :unit, :variants, tax_group: [tax_group_rates: :tax]]

  # ===========================================================================
  # Products
  # ===========================================================================

  @doc """
  A query for the business's products, filtered.

  Returns a query rather than results so the caller can paginate it — a catalog
  of forty thousand lines is not something to load into memory to count.

  ## Filters

    * `"q"` — substring match on name or SKU, trigram-indexed
    * `"category_id"`, `"brand_id"`, `"kind"`
    * `"active"` — `"true"` / `"false"`
    * `"in_category_tree"` — a category id, matching its whole subtree
  """
  @spec product_query(Scope.t(), map()) :: Ecto.Query.t()
  def product_query(%Scope{} = scope, filters \\ %{}) do
    Product
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> apply_product_filters(scope, filters)
    |> preload(^@product_preloads)
  end

  @doc "Lists products matching the filters, newest first."
  @spec list_products(Scope.t(), map()) :: [Product.t()]
  def list_products(%Scope{} = scope, filters \\ %{}) do
    scope
    |> product_query(filters)
    |> order_by([product], desc: product.id)
    |> Repo.all()
  end

  @doc "Fetches a product with its variants, category, brand and taxes."
  @spec fetch_product(Scope.t(), Ecto.UUID.t()) :: {:ok, Product.t()} | {:error, :not_found}
  def fetch_product(%Scope{} = scope, id) do
    if UUIDv7.valid?(id), do: do_fetch_product(scope, id), else: {:error, :not_found}
  end

  defp do_fetch_product(%Scope{} = scope, id) do
    Product
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([product], product.id == ^id)
    |> preload(^@product_preloads)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      product -> {:ok, product}
    end
  end

  @doc """
  Creates a product together with its default variant.

  One transaction. A product without a variant cannot be sold, so there is no
  moment at which one exists.

  Price, SKU, barcode and cost belong to the variant and may be passed at the
  top level for convenience — creating a simple product should not require the
  client to know that variants exist.
  """
  @spec create_product(Scope.t(), map()) ::
          {:ok, Product.t()} | {:error, Ecto.Changeset.t()}
  def create_product(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)
    business = scope.business

    Repo.transaction(fn ->
      product_changeset =
        %Product{
          organization_id: Scope.organization_id(scope),
          business_id: Scope.business_id(scope)
        }
        |> Product.changeset(attrs, business)

      with {:ok, product} <- Repo.insert(product_changeset),
           {:ok, _variant} <- insert_default_variant(scope, product, attrs) do
        reload_product(product)
      else
        {:error, failed} -> Repo.rollback(failed)
      end
    end)
  end

  defp insert_default_variant(%Scope{} = scope, %Product{} = product, attrs) do
    %ProductVariant{
      organization_id: product.organization_id,
      business_id: product.business_id,
      product_id: product.id
    }
    |> ProductVariant.default_changeset(variant_attrs(attrs))
    |> Repo.insert()
    |> tap_default_barcode(scope)
  end

  # The top-level shorthand a simple product is created with.
  defp variant_attrs(attrs) do
    %{
      "price" => Map.get(attrs, "price", 0),
      "cost" => Map.get(attrs, "cost"),
      "sku" => Map.get(attrs, "sku"),
      "barcode" => Map.get(attrs, "barcode"),
      "compare_at_price" => Map.get(attrs, "compare_at_price"),
      "weight_grams" => Map.get(attrs, "weight_grams")
    }
  end

  # Mirror the variant's barcode into the side table, so every barcode in the
  # business is findable in one place even though the scan path reads the
  # denormalised column.
  defp tap_default_barcode({:ok, %ProductVariant{barcode: nil} = variant}, _scope),
    do: {:ok, variant}

  defp tap_default_barcode({:ok, %ProductVariant{} = variant}, _scope) do
    %ProductBarcode{}
    |> ProductBarcode.changeset(%{
      "business_id" => variant.business_id,
      "variant_id" => variant.id,
      "barcode" => variant.barcode,
      "kind" => "internal"
    })
    |> Repo.insert(on_conflict: :nothing)

    {:ok, variant}
  end

  defp tap_default_barcode(other, _scope), do: other

  @doc "Updates a product. Variants are managed separately."
  @spec update_product(Scope.t(), Product.t(), map()) ::
          {:ok, Product.t()} | {:error, Ecto.Changeset.t()}
  def update_product(%Scope{} = scope, %Product{} = product, attrs) do
    case product |> Product.changeset(attrs, scope.business) |> Repo.update() do
      {:ok, updated} -> {:ok, reload_product(updated)}
      {:error, failed} -> {:error, failed}
    end
  end

  @doc """
  Archives a product and its variants.

  Soft-deleted rather than removed: sales reference variants, and a receipt
  reprinted next year has to still name what was sold.
  """
  @spec archive_product(Scope.t(), Product.t()) ::
          {:ok, Product.t()} | {:error, Ecto.Changeset.t()}
  def archive_product(%Scope{}, %Product{} = product) do
    now = DateTime.utc_now()

    Repo.transaction(fn ->
      Repo.update_all(
        from(v in ProductVariant, where: v.product_id == ^product.id and is_nil(v.deleted_at)),
        set: [deleted_at: now]
      )

      case product |> Product.soft_delete_changeset() |> Repo.update() do
        {:ok, archived} -> archived
        {:error, failed} -> Repo.rollback(failed)
      end
    end)
  end

  defp apply_product_filters(query, scope, filters) do
    Enum.reduce(filters, query, fn
      {"q", term}, acc when is_binary(term) and term != "" ->
        search_term(acc, term)

      {"category_id", value}, acc ->
        maybe_where(acc, value, &dynamic([p], p.category_id == ^&1))

      {"brand_id", value}, acc ->
        maybe_where(acc, value, &dynamic([p], p.brand_id == ^&1))

      {"kind", value}, acc when is_binary(value) ->
        where(acc, [p], p.kind == ^value)

      {"active", "true"}, acc ->
        where(acc, [p], p.is_active)

      {"active", "false"}, acc ->
        where(acc, [p], not p.is_active)

      {"in_category_tree", value}, acc ->
        in_category_tree(acc, scope, value)

      _other, acc ->
        acc
    end)
  end

  # ILIKE against the trigram index, plus an exact SKU match so scanning a code
  # into the search box finds the item rather than nothing.
  defp search_term(query, term) do
    pattern = "%#{String.trim(term)}%"

    from product in query,
      left_join: variant in ProductVariant,
      on: variant.product_id == product.id and is_nil(variant.deleted_at),
      where:
        ilike(product.name, ^pattern) or ilike(variant.sku, ^pattern) or
          variant.barcode == ^String.trim(term),
      distinct: product.id
  end

  # A category filter that includes descendants, using the materialised path.
  defp in_category_tree(query, %Scope{} = scope, category_id) do
    case fetch_category(scope, category_id) do
      {:ok, root} ->
        subtree = Category.child_path(root) <> "%"
        root_id = root.id

        # The join binding is deliberately not named `category`: a binding that
        # shadows the Elixir variable being pinned into the same expression is
        # ambiguous to read and easy to get wrong.
        from product in query,
          join: node in Category,
          on: node.id == product.category_id,
          where: node.id == ^root_id or like(node.path, ^subtree)

      {:error, :not_found} ->
        where(query, [p], false)
    end
  end

  defp maybe_where(query, value, builder) do
    if UUIDv7.valid?(value), do: where(query, ^builder.(value)), else: query
  end

  defp reload_product(%Product{} = product),
    do: Repo.preload(product, @product_preloads, force: true)

  # ===========================================================================
  # Variants
  # ===========================================================================

  @doc "Lists a product's variants."
  @spec list_variants(Scope.t(), Product.t()) :: [ProductVariant.t()]
  def list_variants(%Scope{} = scope, %Product{} = product) do
    ProductVariant
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([variant], variant.product_id == ^product.id)
    |> order_by([variant], asc: variant.position, asc: variant.id)
    |> preload(variant_option_values: :option_value)
    |> Repo.all()
  end

  @doc "Fetches a variant."
  @spec fetch_variant(Scope.t(), Ecto.UUID.t()) ::
          {:ok, ProductVariant.t()} | {:error, :not_found}
  def fetch_variant(%Scope{} = scope, id) do
    if UUIDv7.valid?(id), do: do_fetch_variant(scope, id), else: {:error, :not_found}
  end

  defp do_fetch_variant(%Scope{} = scope, id) do
    ProductVariant
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([variant], variant.id == ^id)
    |> preload([:product, variant_option_values: :option_value])
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      variant -> {:ok, variant}
    end
  end

  @doc """
  Adds a variant to a product, optionally with option values.

  Pass `"option_value_ids"` to place it in the matrix. The variant's name is
  derived from those values — "Blue / L" — so the same combination always reads
  the same way rather than depending on the order the client sent them.
  """
  @spec create_variant(Scope.t(), Product.t(), map()) ::
          {:ok, ProductVariant.t()} | {:error, Ecto.Changeset.t() | :duplicate_combination}
  def create_variant(%Scope{} = scope, %Product{} = product, attrs) do
    Repo.transaction(fn ->
      case insert_variant(scope, product, attrs) do
        {:ok, variant} -> variant
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  # The non-transactional core. `generate_matrix/4` calls this directly:
  # Ecto has no nested transactions, so a `Repo.rollback` from an inner one
  # would take the whole matrix down instead of skipping a single duplicate.
  defp insert_variant(%Scope{} = scope, %Product{} = product, attrs) do
    attrs = stringify(attrs)
    option_value_ids = attrs |> Map.get("option_value_ids", []) |> List.wrap()

    if duplicate_combination?(scope, product, option_value_ids) do
      {:error, :duplicate_combination}
    else
      option_values = load_option_values(scope, option_value_ids)

      changeset =
        %ProductVariant{
          organization_id: product.organization_id,
          business_id: product.business_id,
          product_id: product.id
        }
        |> ProductVariant.changeset(put_derived_name(attrs, option_values))

      case Repo.insert(changeset) do
        {:ok, variant} ->
          attach_option_values(variant, option_value_ids)
          {:ok, Repo.preload(variant, [variant_option_values: :option_value], force: true)}

        {:error, failed} ->
          {:error, failed}
      end
    end
  end

  @doc "Updates a variant."
  @spec update_variant(Scope.t(), ProductVariant.t(), map()) ::
          {:ok, ProductVariant.t()} | {:error, Ecto.Changeset.t()}
  def update_variant(%Scope{}, %ProductVariant{} = variant, attrs) do
    variant |> ProductVariant.changeset(attrs) |> Repo.update()
  end

  @doc """
  Archives a variant.

  The default variant is refused: it is the one a product falls back to, and a
  product with none cannot be sold.
  """
  @spec archive_variant(Scope.t(), ProductVariant.t()) ::
          {:ok, ProductVariant.t()} | {:error, :conflict | Ecto.Changeset.t()}
  def archive_variant(%Scope{}, %ProductVariant{is_default: true}), do: {:error, :conflict}

  def archive_variant(%Scope{}, %ProductVariant{} = variant) do
    variant |> ProductVariant.soft_delete_changeset() |> Repo.update()
  end

  @doc """
  Builds every combination of the given option values as variants.

  A clothing shop entering three sizes and four colours wants twelve variants,
  not twelve forms. Combinations that already exist are skipped, so running it
  again after adding a colour creates only the new column of the matrix.

  Takes `option_value_ids` grouped by option type:

      generate_matrix(scope, product, [[small, medium, large], [blue, red]], %{"price" => 1200})
  """
  @spec generate_matrix(Scope.t(), Product.t(), [[Ecto.UUID.t()]], map()) ::
          {:ok, [ProductVariant.t()]} | {:error, term()}
  def generate_matrix(%Scope{} = scope, %Product{} = product, grouped_value_ids, attrs \\ %{}) do
    combinations = cartesian_product(grouped_value_ids)

    base_attrs = stringify(attrs)

    Repo.transaction(fn ->
      combinations
      |> Enum.reduce([], fn combination, created ->
        variant_attrs = Map.put(base_attrs, "option_value_ids", combination)

        case insert_variant(scope, product, variant_attrs) do
          {:ok, variant} -> [variant | created]
          # An existing combination is skipped rather than failed: re-running
          # this after adding a fourth colour should create that column of the
          # matrix and leave the rest alone.
          {:error, :duplicate_combination} -> created
          {:error, failed} -> Repo.rollback(failed)
        end
      end)
      |> Enum.reverse()
    end)
  end

  defp cartesian_product([]), do: []

  defp cartesian_product(groups) do
    groups
    |> Enum.reject(&(&1 == []))
    |> Enum.reduce([[]], fn group, acc ->
      for combination <- acc, value <- group, do: combination ++ [value]
    end)
  end

  defp duplicate_combination?(_scope, _product, []), do: false

  defp duplicate_combination?(%Scope{} = scope, %Product{} = product, option_value_ids) do
    wanted = MapSet.new(option_value_ids)

    scope
    |> list_variants(product)
    |> Enum.any?(fn variant ->
      variant.variant_option_values
      |> Enum.map(& &1.option_value_id)
      |> MapSet.new()
      |> MapSet.equal?(wanted)
    end)
  end

  defp put_derived_name(attrs, []), do: attrs

  defp put_derived_name(attrs, option_values) do
    Map.put_new(attrs, "name", ProductVariant.build_name(option_values))
  end

  defp load_option_values(%Scope{} = scope, ids) do
    ids = Enum.filter(ids, &UUIDv7.valid?/1)
    business_id = Scope.business_id(scope)

    from(value in OptionValue,
      join: type in OptionType,
      on: type.id == value.option_type_id,
      where: value.id in ^ids and type.business_id == ^business_id,
      order_by: [asc: type.position, asc: value.position],
      select: %{id: value.id, value: value.value, position: type.position}
    )
    |> Repo.all()
  end

  defp attach_option_values(%ProductVariant{} = variant, ids) do
    Enum.each(ids, fn option_value_id ->
      %VariantOptionValue{}
      |> VariantOptionValue.changeset(%{
        variant_id: variant.id,
        option_value_id: option_value_id
      })
      |> Repo.insert(on_conflict: :nothing)
    end)
  end

  # ===========================================================================
  # Barcodes and scanning
  # ===========================================================================

  @doc """
  Finds a variant by barcode.

  The hot path. One indexed lookup on the variant's denormalised `barcode`
  column, falling back to `product_barcodes` only when that misses — which is
  the uncommon case of an alternate supplier code.
  """
  @spec scan(Scope.t(), String.t()) ::
          {:ok, ProductVariant.t()} | {:error, :not_found}
  def scan(%Scope{} = scope, barcode) when is_binary(barcode) do
    code = String.trim(barcode)

    if code == "" do
      {:error, :not_found}
    else
      case scan_primary(scope, code) do
        nil -> scan_alternate(scope, code)
        variant -> {:ok, variant}
      end
    end
  end

  def scan(%Scope{}, _barcode), do: {:error, :not_found}

  defp scan_primary(%Scope{} = scope, code) do
    ProductVariant
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([variant], variant.barcode == ^code and variant.is_active)
    |> preload(:product)
    |> Repo.one()
  end

  defp scan_alternate(%Scope{} = scope, code) do
    business_id = Scope.business_id(scope)

    query =
      from variant in ProductVariant,
        join: barcode in ProductBarcode,
        on: barcode.variant_id == variant.id,
        where: barcode.business_id == ^business_id and barcode.barcode == ^code,
        where: is_nil(variant.deleted_at) and variant.is_active,
        preload: :product,
        limit: 1

    case Repo.one(query) do
      nil -> {:error, :not_found}
      variant -> {:ok, variant}
    end
  end

  @doc "Adds an alternate barcode to a variant."
  @spec add_barcode(Scope.t(), ProductVariant.t(), map()) ::
          {:ok, ProductBarcode.t()} | {:error, Ecto.Changeset.t()}
  def add_barcode(%Scope{} = scope, %ProductVariant{} = variant, attrs) do
    attrs =
      attrs
      |> stringify()
      |> Map.put("business_id", Scope.business_id(scope))
      |> Map.put("variant_id", variant.id)

    %ProductBarcode{} |> ProductBarcode.changeset(attrs) |> Repo.insert()
  end

  @doc "Removes an alternate barcode."
  @spec delete_barcode(Scope.t(), Ecto.UUID.t()) :: :ok
  def delete_barcode(%Scope{} = scope, barcode_id) do
    business_id = Scope.business_id(scope)

    Repo.delete_all(
      from barcode in ProductBarcode,
        where: barcode.id == ^barcode_id and barcode.business_id == ^business_id
    )

    :ok
  end

  # ===========================================================================
  # Categories
  # ===========================================================================

  @doc "Lists the business's categories, ordered for display as a tree."
  @spec list_categories(Scope.t()) :: [Category.t()]
  def list_categories(%Scope{} = scope) do
    Category
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> order_by([category], asc: category.path, asc: category.sort_order, asc: category.name)
    |> Repo.all()
  end

  @doc "Fetches a category."
  @spec fetch_category(Scope.t(), Ecto.UUID.t()) :: {:ok, Category.t()} | {:error, :not_found}
  def fetch_category(%Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      Category
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([category], category.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        category -> {:ok, category}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Creates a category, optionally under a parent.

  The parent is loaded and verified in scope before its path is used, so a
  client cannot graft a category onto another tenant's tree by supplying an id.
  """
  @spec create_category(Scope.t(), map()) ::
          {:ok, Category.t()} | {:error, Ecto.Changeset.t() | :not_found}
  def create_category(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    with {:ok, parent} <- resolve_parent(scope, Map.get(attrs, "parent_id")) do
      %Category{
        organization_id: Scope.organization_id(scope),
        business_id: Scope.business_id(scope)
      }
      |> Category.changeset(attrs, parent)
      |> Repo.insert()
    end
  end

  @doc """
  Updates a category, moving its subtree when the parent changes.

  Moving rewrites the path of every descendant, which is the cost of the
  materialised path — paid on a rare write instead of on every read.
  """
  @spec update_category(Scope.t(), Category.t(), map()) ::
          {:ok, Category.t()} | {:error, Ecto.Changeset.t() | :not_found | :cyclic}
  def update_category(%Scope{} = scope, %Category{} = category, attrs) do
    attrs = stringify(attrs)

    if Map.has_key?(attrs, "parent_id") do
      move_category(scope, category, Map.get(attrs, "parent_id"), attrs)
    else
      category
      |> Category.changeset(attrs, current_parent(scope, category))
      |> Repo.update()
    end
  end

  defp move_category(%Scope{} = scope, %Category{} = category, parent_id, attrs) do
    with {:ok, parent} <- resolve_parent(scope, parent_id),
         :ok <- refute_cycle(category, parent) do
      Repo.transaction(fn ->
        case category |> Category.changeset(attrs, parent) |> Repo.update() do
          {:ok, moved} ->
            rewrite_descendant_paths(scope, category, moved)
            moved

          {:error, failed} ->
            Repo.rollback(failed)
        end
      end)
    end
  end

  # A category cannot be moved beneath its own descendant — that detaches the
  # subtree from the tree entirely and it stops appearing anywhere.
  defp refute_cycle(_category, nil), do: :ok

  defp refute_cycle(%Category{} = category, %Category{} = parent) do
    if parent.id == category.id or category.id in Category.ancestor_ids(parent) do
      {:error, :cyclic}
    else
      :ok
    end
  end

  defp rewrite_descendant_paths(%Scope{} = scope, %Category{} = before, %Category{} = moved) do
    old_prefix = Category.child_path(before)
    new_prefix = Category.child_path(moved)
    depth_shift = moved.depth - before.depth
    business_id = Scope.business_id(scope)

    # `overlay` rewrites only the leading prefix, leaving the rest of each
    # descendant's path — and so the shape of the subtree — intact. Paths are
    # ASCII, so a byte offset is a character offset.
    from(descendant in Category,
      where: descendant.business_id == ^business_id,
      where: like(descendant.path, ^(old_prefix <> "%")),
      update: [
        set: [
          path:
            fragment(
              "overlay(? placing ? from 1 for ?)",
              descendant.path,
              ^new_prefix,
              ^byte_size(old_prefix)
            )
        ],
        inc: [depth: ^depth_shift]
      ]
    )
    |> Repo.update_all([])
  end

  @doc """
  Archives a category.

  Refused while it has children: archiving a parent would orphan a whole
  subtree, which disappears from the catalog without anyone deleting it.
  """
  @spec archive_category(Scope.t(), Category.t()) ::
          {:ok, Category.t()} | {:error, :conflict | Ecto.Changeset.t()}
  def archive_category(%Scope{}, %Category{} = category) do
    has_children? =
      Repo.exists?(
        from child in Category,
          where: child.parent_id == ^category.id and is_nil(child.deleted_at)
      )

    if has_children? do
      {:error, :conflict}
    else
      category |> Category.soft_delete_changeset() |> Repo.update()
    end
  end

  defp resolve_parent(_scope, nil), do: {:ok, nil}
  defp resolve_parent(_scope, ""), do: {:ok, nil}
  defp resolve_parent(%Scope{} = scope, parent_id), do: fetch_category(scope, parent_id)

  defp current_parent(_scope, %Category{parent_id: nil}), do: nil

  defp current_parent(%Scope{} = scope, %Category{parent_id: parent_id}) do
    case fetch_category(scope, parent_id) do
      {:ok, parent} -> parent
      {:error, :not_found} -> nil
    end
  end

  # ===========================================================================
  # Brands, units and option types
  # ===========================================================================

  @doc "Lists the business's brands."
  @spec list_brands(Scope.t()) :: [Brand.t()]
  def list_brands(%Scope{} = scope) do
    Brand
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> order_by([brand], asc: brand.name)
    |> Repo.all()
  end

  @doc "Creates a brand."
  @spec create_brand(Scope.t(), map()) :: {:ok, Brand.t()} | {:error, Ecto.Changeset.t()}
  def create_brand(%Scope{} = scope, attrs) do
    %Brand{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> Brand.changeset(attrs)
    |> Repo.insert()
  end

  @doc "Updates a brand."
  @spec update_brand(Scope.t(), Brand.t(), map()) ::
          {:ok, Brand.t()} | {:error, Ecto.Changeset.t()}
  def update_brand(%Scope{}, %Brand{} = brand, attrs) do
    brand |> Brand.changeset(attrs) |> Repo.update()
  end

  @doc "Archives a brand."
  @spec archive_brand(Scope.t(), Brand.t()) :: {:ok, Brand.t()} | {:error, Ecto.Changeset.t()}
  def archive_brand(%Scope{}, %Brand{} = brand) do
    brand |> Brand.soft_delete_changeset() |> Repo.update()
  end

  @doc "Fetches a brand."
  @spec fetch_brand(Scope.t(), Ecto.UUID.t()) :: {:ok, Brand.t()} | {:error, :not_found}
  def fetch_brand(%Scope{} = scope, id), do: fetch_scoped(Brand, scope, id)

  @doc "Lists the business's units of measure."
  @spec list_units(Scope.t()) :: [Unit.t()]
  def list_units(%Scope{} = scope) do
    Unit
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> order_by([unit], asc: unit.dimension, asc: unit.factor_to_base)
    |> Repo.all()
  end

  @doc "Fetches a unit."
  @spec fetch_unit(Scope.t(), Ecto.UUID.t()) :: {:ok, Unit.t()} | {:error, :not_found}
  def fetch_unit(%Scope{} = scope, id), do: fetch_scoped(Unit, scope, id)

  @doc "Creates a unit."
  @spec create_unit(Scope.t(), map()) :: {:ok, Unit.t()} | {:error, Ecto.Changeset.t()}
  def create_unit(%Scope{} = scope, attrs) do
    %Unit{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> Unit.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Seeds a business with the standard units.

  Idempotent. A shop should be able to sell something the minute it exists, and
  "define a unit called pieces" is not a setup step anyone should face.
  """
  @spec seed_units(Scope.t()) :: {:ok, non_neg_integer()}
  def seed_units(%Scope{} = scope) do
    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    entries =
      Enum.map(Unit.default_units(), fn unit ->
        unit
        |> Map.merge(%{
          id: UUIDv7.generate(),
          organization_id: Scope.organization_id(scope),
          business_id: Scope.business_id(scope),
          factor_to_base: Decimal.new(unit.factor_to_base),
          is_base: Map.get(unit, :is_base, false),
          is_active: true,
          inserted_at: now,
          updated_at: now
        })
      end)

    {count, _returning} =
      Repo.insert_all(Unit, entries,
        on_conflict: :nothing,
        conflict_target: {:unsafe_fragment, "(business_id, code) WHERE deleted_at IS NULL"}
      )

    {:ok, count}
  end

  @doc "Lists the business's option types with their values."
  @spec list_option_types(Scope.t()) :: [OptionType.t()]
  def list_option_types(%Scope{} = scope) do
    OptionType
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> order_by([type], asc: type.position, asc: type.name)
    |> preload(:option_values)
    |> Repo.all()
  end

  @doc "Fetches an option type with its values."
  @spec fetch_option_type(Scope.t(), Ecto.UUID.t()) ::
          {:ok, OptionType.t()} | {:error, :not_found}
  def fetch_option_type(%Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      OptionType
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([type], type.id == ^id)
      |> preload(:option_values)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        type -> {:ok, type}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Creates an option type, optionally with its values in one call.

  An option type with no values cannot produce a variant, so creating both
  together is the normal path rather than a convenience.
  """
  @spec create_option_type(Scope.t(), map()) ::
          {:ok, OptionType.t()} | {:error, Ecto.Changeset.t()}
  def create_option_type(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      changeset =
        %OptionType{
          organization_id: Scope.organization_id(scope),
          business_id: Scope.business_id(scope)
        }
        |> OptionType.changeset(attrs)

      case Repo.insert(changeset) do
        {:ok, type} ->
          insert_option_values(type, Map.get(attrs, "values", []))
          Repo.preload(type, :option_values, force: true)

        {:error, failed} ->
          Repo.rollback(failed)
      end
    end)
  end

  @doc "Adds a value to an option type."
  @spec create_option_value(Scope.t(), OptionType.t(), map()) ::
          {:ok, OptionValue.t()} | {:error, Ecto.Changeset.t()}
  def create_option_value(%Scope{}, %OptionType{} = type, attrs) do
    attrs = attrs |> stringify() |> Map.put("option_type_id", type.id)

    %OptionValue{} |> OptionValue.changeset(attrs) |> Repo.insert()
  end

  defp insert_option_values(%OptionType{} = type, values) do
    values
    |> List.wrap()
    |> Enum.with_index()
    |> Enum.each(fn {value, position} ->
      attrs =
        value
        |> normalize_option_value()
        |> Map.put("option_type_id", type.id)
        |> Map.put_new("position", position)

      %OptionValue{} |> OptionValue.changeset(attrs) |> Repo.insert()
    end)
  end

  defp normalize_option_value(value) when is_binary(value), do: %{"value" => value}
  defp normalize_option_value(value) when is_map(value), do: stringify(value)

  # ===========================================================================
  # Modifiers
  # ===========================================================================

  @doc "Lists the business's modifier groups with their options."
  @spec list_modifier_groups(Scope.t()) :: [ModifierGroup.t()]
  def list_modifier_groups(%Scope{} = scope) do
    ModifierGroup
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> order_by([group], asc: group.position, asc: group.name)
    |> preload(:modifiers)
    |> Repo.all()
  end

  @doc "Fetches a modifier group with its options."
  @spec fetch_modifier_group(Scope.t(), Ecto.UUID.t()) ::
          {:ok, ModifierGroup.t()} | {:error, :not_found}
  def fetch_modifier_group(%Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      ModifierGroup
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([group], group.id == ^id)
      |> preload(:modifiers)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        group -> {:ok, group}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Creates a modifier group, optionally with its options."
  @spec create_modifier_group(Scope.t(), map()) ::
          {:ok, ModifierGroup.t()} | {:error, Ecto.Changeset.t()}
  def create_modifier_group(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      changeset =
        %ModifierGroup{
          organization_id: Scope.organization_id(scope),
          business_id: Scope.business_id(scope)
        }
        |> ModifierGroup.changeset(attrs)

      case Repo.insert(changeset) do
        {:ok, group} ->
          insert_modifiers(group, Map.get(attrs, "modifiers", []))
          Repo.preload(group, :modifiers, force: true)

        {:error, failed} ->
          Repo.rollback(failed)
      end
    end)
  end

  @doc "Updates a modifier group."
  @spec update_modifier_group(Scope.t(), ModifierGroup.t(), map()) ::
          {:ok, ModifierGroup.t()} | {:error, Ecto.Changeset.t()}
  def update_modifier_group(%Scope{}, %ModifierGroup{} = group, attrs) do
    group |> ModifierGroup.changeset(attrs) |> Repo.update()
  end

  @doc "Archives a modifier group."
  @spec archive_modifier_group(Scope.t(), ModifierGroup.t()) ::
          {:ok, ModifierGroup.t()} | {:error, Ecto.Changeset.t()}
  def archive_modifier_group(%Scope{}, %ModifierGroup{} = group) do
    group |> ModifierGroup.soft_delete_changeset() |> Repo.update()
  end

  @doc "Adds an option to a modifier group."
  @spec create_modifier(Scope.t(), ModifierGroup.t(), map()) ::
          {:ok, Modifier.t()} | {:error, Ecto.Changeset.t()}
  def create_modifier(%Scope{} = scope, %ModifierGroup{} = group, attrs) do
    attrs =
      attrs
      |> stringify()
      |> Map.put("modifier_group_id", group.id)

    %Modifier{business_id: Scope.business_id(scope)}
    |> Modifier.changeset(attrs)
    |> Repo.insert()
  end

  defp insert_modifiers(%ModifierGroup{} = group, modifiers) do
    modifiers
    |> List.wrap()
    |> Enum.with_index()
    |> Enum.each(fn {modifier, position} ->
      attrs =
        modifier
        |> stringify()
        |> Map.put("modifier_group_id", group.id)
        |> Map.put_new("position", position)

      %Modifier{business_id: group.business_id}
      |> Modifier.changeset(attrs)
      |> Repo.insert()
    end)
  end

  @doc "Attaches a modifier group to a product."
  @spec attach_modifier_group(Scope.t(), Product.t(), ModifierGroup.t(), map()) ::
          {:ok, ProductModifierGroup.t()} | {:error, Ecto.Changeset.t()}
  def attach_modifier_group(%Scope{}, %Product{} = product, %ModifierGroup{} = group, attrs \\ %{}) do
    attrs =
      attrs
      |> stringify()
      |> Map.merge(%{"product_id" => product.id, "modifier_group_id" => group.id})

    %ProductModifierGroup{} |> ProductModifierGroup.changeset(attrs) |> Repo.insert()
  end

  @doc "Detaches a modifier group from a product."
  @spec detach_modifier_group(Scope.t(), Product.t(), Ecto.UUID.t()) :: :ok
  def detach_modifier_group(%Scope{}, %Product{} = product, group_id) do
    Repo.delete_all(
      from attachment in ProductModifierGroup,
        where: attachment.product_id == ^product.id,
        where: attachment.modifier_group_id == ^group_id
    )

    :ok
  end

  # ===========================================================================
  # Bundles and recipes
  # ===========================================================================

  @doc "The components of a variant — its bundle contents or its recipe."
  @spec list_components(Scope.t(), ProductVariant.t()) :: [ProductComponent.t()]
  def list_components(%Scope{} = scope, %ProductVariant{} = variant) do
    ProductComponent
    |> Scoped.for_business(scope)
    |> where([component], component.parent_variant_id == ^variant.id)
    |> order_by([component], asc: component.position)
    |> preload(component_variant: :product)
    |> Repo.all()
  end

  @doc """
  Adds a component to a bundle or a recipe.

  Refuses a cycle. A bundle that contains itself — directly, or through three
  intermediates — makes checkout recurse until it runs out of stack, so the
  whole graph is walked before the row is written.
  """
  @spec add_component(Scope.t(), ProductVariant.t(), map()) ::
          {:ok, ProductComponent.t()} | {:error, Ecto.Changeset.t() | :cyclic}
  def add_component(%Scope{} = scope, %ProductVariant{} = parent, attrs) do
    attrs =
      attrs
      |> stringify()
      |> Map.put("parent_variant_id", parent.id)

    component_id = Map.get(attrs, "component_variant_id")

    if creates_cycle?(scope, parent.id, component_id) do
      {:error, :cyclic}
    else
      %ProductComponent{
        organization_id: parent.organization_id,
        business_id: parent.business_id
      }
      |> ProductComponent.changeset(attrs)
      |> Repo.insert()
    end
  end

  @doc "Removes a component."
  @spec remove_component(Scope.t(), Ecto.UUID.t()) :: :ok
  def remove_component(%Scope{} = scope, component_id) do
    business_id = Scope.business_id(scope)

    Repo.delete_all(
      from component in ProductComponent,
        where: component.id == ^component_id and component.business_id == ^business_id
    )

    :ok
  end

  @doc """
  Expands a variant into everything selling one of it consumes.

  Walks bundles and recipes to the leaves, multiplying quantities and applying
  wastage on the way down, so checkout gets a flat list of real stock movements
  rather than a tree to interpret.
  """
  @spec explode(Scope.t(), ProductVariant.t(), Decimal.t()) ::
          [%{variant_id: Ecto.UUID.t(), quantity: Decimal.t()}]
  def explode(%Scope{} = scope, %ProductVariant{} = variant, quantity) do
    scope
    |> do_explode(variant.id, quantity, MapSet.new([variant.id]))
    |> Enum.group_by(& &1.variant_id, & &1.quantity)
    |> Enum.map(fn {variant_id, quantities} ->
      %{variant_id: variant_id, quantity: Kaarobar.Money.sum(quantities)}
    end)
  end

  defp do_explode(%Scope{} = scope, variant_id, quantity, seen) do
    components = components_of(scope, variant_id)

    if components == [] do
      [%{variant_id: variant_id, quantity: quantity}]
    else
      Enum.flat_map(components, fn component ->
        child_quantity =
          component
          |> ProductComponent.consumed_quantity()
          |> Decimal.mult(quantity)

        # A cycle should have been refused at write time; if one exists anyway,
        # stop rather than recurse forever.
        if MapSet.member?(seen, component.component_variant_id) do
          [%{variant_id: component.component_variant_id, quantity: child_quantity}]
        else
          do_explode(
            scope,
            component.component_variant_id,
            child_quantity,
            MapSet.put(seen, component.component_variant_id)
          )
        end
      end)
    end
  end

  defp components_of(%Scope{} = scope, variant_id) do
    ProductComponent
    |> Scoped.for_business(scope)
    |> where([component], component.parent_variant_id == ^variant_id)
    |> Repo.all()
  end

  # Walks upward from the prospective child: if the parent is reachable from
  # it, adding the edge closes a loop.
  defp creates_cycle?(_scope, parent_id, parent_id), do: true

  defp creates_cycle?(%Scope{} = scope, parent_id, component_id) do
    if UUIDv7.valid?(component_id) do
      reachable_from(scope, component_id, MapSet.new()) |> MapSet.member?(parent_id)
    else
      false
    end
  end

  defp reachable_from(%Scope{} = scope, variant_id, seen) do
    if MapSet.member?(seen, variant_id) do
      seen
    else
      seen = MapSet.put(seen, variant_id)

      scope
      |> components_of(variant_id)
      |> Enum.reduce(seen, fn component, acc ->
        reachable_from(scope, component.component_variant_id, acc)
      end)
    end
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp fetch_scoped(schema, %Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      schema
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([record], record.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        record -> {:ok, record}
      end
    else
      {:error, :not_found}
    end
  end

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
  end

  defp stringify(_attrs), do: %{}
end
