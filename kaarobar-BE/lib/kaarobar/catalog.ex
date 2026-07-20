defmodule Kaarobar.Catalog do
  @moduledoc "Multi-industry product catalog: categories, variants, modifiers, images, batches."

  import Ecto.Query
  alias Kaarobar.Repo
  alias Kaarobar.Storage
  alias Kaarobar.Catalog.IndustryPresets

  alias Kaarobar.Schemas.{
    Product,
    ProductCategory,
    ProductVariant,
    ProductImage,
    ProductBatch,
    ModifierGroup,
    Modifier,
    ProductModifierGroup,
    ProductBranchPrice
  }

  ## —— Categories ————————————————————————————————————————————————

  def seed_default_categories(business_id, owner_id, industry) do
    IndustryPresets.categories_for(industry)
    |> Enum.with_index()
    |> Enum.map(fn {name, idx} ->
      attrs = %{
        name: name,
        slug: IndustryPresets.slugify(name),
        sort_order: idx,
        business_id: business_id,
        owner_id: owner_id
      }

      case Repo.get_by(ProductCategory, business_id: business_id, slug: attrs.slug) do
        nil ->
          %ProductCategory{}
          |> ProductCategory.changeset(attrs)
          |> Repo.insert()

        existing ->
          {:ok, existing}
      end
    end)
  end

  def list_categories(business_id, owner_id) do
    ProductCategory
    |> where([c], c.business_id == ^business_id and c.owner_id == ^owner_id and c.is_active == true)
    |> order_by([c], asc: c.sort_order, asc: c.name)
    |> Repo.all()
  end

  def create_category(business_id, owner_id, attrs) do
    name = attrs[:name] || attrs["name"]
    slug = attrs[:slug] || attrs["slug"] || IndustryPresets.slugify(name || "")

    %ProductCategory{}
    |> ProductCategory.changeset(%{
      name: name,
      slug: slug,
      sort_order: attrs[:sort_order] || attrs["sort_order"] || 0,
      business_id: business_id,
      owner_id: owner_id
    })
    |> Repo.insert()
  end

  ## —— Products ——————————————————————————————————————————————————

  def create_product(business_id, owner_id, attrs) do
    attrs =
      attrs
      |> stringify_keys()
      |> Map.merge(%{"business_id" => business_id, "owner_id" => owner_id})
      |> normalize_product_attrs()

    %Product{}
    |> Product.changeset(attrs)
    |> Repo.insert()
  end

  def update_product(%Product{} = product, attrs) do
    product
    |> Product.changeset(normalize_product_attrs(stringify_keys(attrs)))
    |> Repo.update()
  end

  def list_products(business_id, owner_id) do
    Product
    |> where([p], p.business_id == ^business_id and p.owner_id == ^owner_id)
    |> preload([:images, :variants, :product_category, product_modifier_groups: [modifier_group: :modifiers]])
    |> order_by([p], asc: p.name)
    |> Repo.all()
  end

  def get_product(product_id, business_id, owner_id) do
    Product
    |> where([p], p.id == ^product_id and p.business_id == ^business_id and p.owner_id == ^owner_id)
    |> preload([:images, :variants, :product_category, product_modifier_groups: [modifier_group: :modifiers]])
    |> Repo.one()
  end

  def find_by_barcode(business_id, owner_id, code) when is_binary(code) do
    code = String.trim(code)

    product =
      Product
      |> where(
        [p],
        p.business_id == ^business_id and p.owner_id == ^owner_id and p.barcode == ^code and
          p.is_active == true
      )
      |> preload([:images, :variants, :product_category, product_modifier_groups: [modifier_group: :modifiers]])
      |> Repo.one()

    case product do
      %Product{} = p ->
        {:ok, %{product: p, variant: nil}}

      nil ->
        variant =
          ProductVariant
          |> where(
            [v],
            v.business_id == ^business_id and v.owner_id == ^owner_id and v.barcode == ^code and
              v.is_active == true
          )
          |> preload(product: [:images, :variants, :product_category, product_modifier_groups: [modifier_group: :modifiers]])
          |> Repo.one()

        case variant do
          %ProductVariant{product: %Product{} = p} = v ->
            {:ok, %{product: p, variant: v}}

          _ ->
            {:error, :not_found}
        end
    end
  end

  def find_by_barcode(_, _, _), do: {:error, :not_found}

  ## —— Variants ——————————————————————————————————————————————————

  def create_variant(product, attrs) do
    attrs =
      stringify_keys(attrs)
      |> Map.merge(%{
        "product_id" => product.id,
        "business_id" => product.business_id,
        "owner_id" => product.owner_id
      })

    %ProductVariant{}
    |> ProductVariant.changeset(attrs)
    |> Repo.insert()
  end

  def list_variants(product_id) do
    ProductVariant
    |> where([v], v.product_id == ^product_id and v.is_active == true)
    |> order_by([v], asc: v.sort_order, asc: v.name)
    |> Repo.all()
  end

  ## —— Modifiers —————————————————————————————————————————————————

  def create_modifier_group(business_id, owner_id, attrs) do
    attrs =
      stringify_keys(attrs)
      |> Map.merge(%{"business_id" => business_id, "owner_id" => owner_id})

    Repo.transaction(fn ->
      {:ok, group} =
        %ModifierGroup{}
        |> ModifierGroup.changeset(attrs)
        |> Repo.insert()

      modifiers = attrs["modifiers"] || []

      Enum.each(modifiers, fn m ->
        %Modifier{}
        |> Modifier.changeset(
          Map.merge(stringify_keys(m), %{"modifier_group_id" => group.id})
        )
        |> Repo.insert!()
      end)

      Repo.preload(group, :modifiers)
    end)
  end

  def list_modifier_groups(business_id, owner_id) do
    ModifierGroup
    |> where([g], g.business_id == ^business_id and g.owner_id == ^owner_id and g.is_active == true)
    |> preload(:modifiers)
    |> order_by([g], asc: g.name)
    |> Repo.all()
  end

  def attach_modifier_group(product_id, modifier_group_id) do
    %ProductModifierGroup{}
    |> ProductModifierGroup.changeset(%{
      product_id: product_id,
      modifier_group_id: modifier_group_id
    })
    |> Repo.insert()
  end

  ## —— Images ————————————————————————————————————————————————————

  def upload_product_image(product, %Plug.Upload{} = upload, owner_id, opts \\ []) do
    binary = File.read!(upload.path)
    key = Storage.build_key("products/#{product.business_id}", upload.filename)

    with {:ok, ^key} <-
           Storage.put(key, binary, content_type: upload.content_type || "image/jpeg"),
         :ok <- maybe_clear_primary(product.id, opts[:primary]) do
      %ProductImage{}
      |> ProductImage.changeset(%{
        product_id: product.id,
        business_id: product.business_id,
        owner_id: owner_id,
        storage_key: key,
        content_type: upload.content_type,
        byte_size: byte_size(binary),
        is_primary: opts[:primary] != false,
        sort_order: opts[:sort_order] || 0
      })
      |> Repo.insert()
    end
  end

  def delete_product_image(image_id, business_id, owner_id) do
    case Repo.get_by(ProductImage,
           id: image_id,
           business_id: business_id,
           owner_id: owner_id
         ) do
      nil ->
        {:error, :not_found}

      image ->
        _ = Storage.delete(image.storage_key)
        Repo.delete(image)
    end
  end

  def primary_image_url(%Product{images: images}) when is_list(images) do
    case Enum.find(images, & &1.is_primary) || List.first(images) do
      nil -> nil
      img -> Storage.url(img.storage_key)
    end
  end

  def primary_image_url(_), do: nil

  ## —— Batches (pharmacy) ————————————————————————————————————————

  def create_batch(product, branch_id, attrs) do
    attrs =
      stringify_keys(attrs)
      |> Map.merge(%{
        "product_id" => product.id,
        "branch_id" => branch_id,
        "business_id" => product.business_id,
        "owner_id" => product.owner_id
      })

    %ProductBatch{}
    |> ProductBatch.changeset(attrs)
    |> Repo.insert()
  end

  def list_batches(product_id, branch_id) do
    ProductBatch
    |> where(
      [b],
      b.product_id == ^product_id and b.branch_id == ^branch_id and
        b.quantity_on_hand > 0
    )
    |> order_by([b], asc_nulls_last: b.expires_on, asc: b.inserted_at)
    |> Repo.all()
  end

  def decrement_batches_fefo(product_id, branch_id, qty) do
    qty = to_dec(qty)
    batches = list_batches(product_id, branch_id)

    Enum.reduce_while(batches, {:ok, qty}, fn batch, {:ok, remaining} ->
      if Decimal.compare(remaining, 0) != :gt do
        {:halt, {:ok, Decimal.new(0)}}
      else
        take =
          if Decimal.compare(batch.quantity_on_hand, remaining) == :lt do
            batch.quantity_on_hand
          else
            remaining
          end

        new_qty = Decimal.sub(batch.quantity_on_hand, take)

        case batch
             |> ProductBatch.changeset(%{quantity_on_hand: new_qty})
             |> Repo.update() do
          {:ok, _} -> {:cont, {:ok, Decimal.sub(remaining, take)}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end
    end)
    |> case do
      {:ok, rem} ->
        if Decimal.compare(rem, 0) == :gt do
          {:error, :insufficient_batch_stock}
        else
          {:ok, :decremented}
        end

      err ->
        err
    end
  end

  def has_batches?(product_id, branch_id) do
    from(b in ProductBatch,
      where:
        b.product_id == ^product_id and b.branch_id == ^branch_id and b.quantity_on_hand > 0,
      select: count(b.id)
    )
    |> Repo.one()
    |> Kernel.>(0)
  end

  ## —— Serialization helpers ————————————————————————————————————

  def serialize_product(product, branch_id \\ nil) do
    price =
      if branch_id do
        case Repo.get_by(ProductBranchPrice, product_id: product.id, branch_id: branch_id) do
          nil -> nil
          row -> to_string(row.price)
        end
      end

    variants =
      case Map.get(product, :variants) do
        list when is_list(list) ->
          Enum.map(list, fn v ->
            %{
              id: v.id,
              name: v.name,
              sku: v.sku,
              barcode: v.barcode,
              price_override: decimal_str(v.price_override),
              is_active: v.is_active
            }
          end)

        _ ->
          []
      end

    modifier_groups =
      case Map.get(product, :product_modifier_groups) do
        list when is_list(list) ->
          list
          |> Enum.map(& &1.modifier_group)
          |> Enum.reject(&is_nil/1)
          |> Enum.map(fn g ->
            %{
              id: g.id,
              name: g.name,
              min_select: g.min_select,
              max_select: g.max_select,
              required: g.required,
              modifiers:
                Enum.map(g.modifiers || [], fn m ->
                  %{
                    id: m.id,
                    name: m.name,
                    price_delta: decimal_str(m.price_delta),
                    is_active: m.is_active
                  }
                end)
            }
          end)

        _ ->
          []
      end

    images =
      case Map.get(product, :images) do
        list when is_list(list) ->
          Enum.map(list, fn img ->
            %{
              id: img.id,
              url: Storage.url(img.storage_key),
              is_primary: img.is_primary,
              content_type: img.content_type
            }
          end)

        _ ->
          []
      end

    category =
      case Map.get(product, :product_category) do
        %{id: id, name: name, slug: slug} -> %{id: id, name: name, slug: slug}
        _ -> nil
      end

    %{
      id: product.id,
      business_id: product.business_id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      category_id: product.category_id,
      category_ref: category,
      barcode: product.barcode,
      brand: product.brand,
      unit: product.unit,
      description: product.description,
      product_kind: product.product_kind,
      track_inventory: product.track_inventory,
      duration_minutes: product.duration_minutes,
      attributes: product.attributes || %{},
      tax_rate: decimal_str(product.tax_rate || Decimal.new("0.18")),
      is_active: product.is_active,
      price: price,
      image_url: primary_image_url(product),
      images: images,
      variants: variants,
      modifier_groups: modifier_groups
    }
  end

  ## —— private ———————————————————————————————————————————————————

  defp maybe_clear_primary(_product_id, false), do: :ok

  defp maybe_clear_primary(product_id, _) do
    from(i in ProductImage, where: i.product_id == ^product_id and i.is_primary == true)
    |> Repo.update_all(set: [is_primary: false])

    :ok
  end

  defp normalize_product_attrs(attrs) do
    attrs
    |> Map.take([
      "sku",
      "name",
      "category",
      "barcode",
      "brand",
      "unit",
      "description",
      "product_kind",
      "track_inventory",
      "duration_minutes",
      "attributes",
      "tax_rate",
      "is_active",
      "business_id",
      "owner_id",
      "category_id"
    ])
    |> Enum.reject(fn {_k, v} -> is_nil(v) or v == "" end)
    |> Map.new()
  end

  defp stringify_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} -> {k, v}
    end)
  end

  defp decimal_str(nil), do: nil
  defp decimal_str(%Decimal{} = d), do: to_string(d)
  defp decimal_str(other), do: to_string(other)

  defp to_dec(%Decimal{} = d), do: d
  defp to_dec(nil), do: Decimal.new(0)
  defp to_dec(v) when is_binary(v), do: Decimal.new(v)
  defp to_dec(v) when is_integer(v), do: Decimal.new(v)
  defp to_dec(v) when is_float(v), do: Decimal.from_float(v)
end
