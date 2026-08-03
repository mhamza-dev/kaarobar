defmodule Kaarobar.Marketplace do
  @moduledoc """
  Public marketplace discovery and portal online checkout.
  """

  import Ecto.Query

  alias Kaarobar.{Catalog, CustomerPortal, Pos, Repo}
  alias Kaarobar.Schemas.{Branch, Business, Employee, Product, ProductBranchPrice}

  @default_product_limit 24
  @max_product_limit 100

  def list_businesses(opts \\ []) do
    q = opts[:q]

    query =
      from(b in Business,
        where: b.marketplace_enabled == true and b.is_active == true,
        order_by: [asc: b.name]
      )

    query =
      if is_binary(q) and String.trim(q) != "" do
        like = "%#{String.trim(q)}%"
        from(b in query, where: ilike(b.name, ^like) or ilike(b.industry, ^like))
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Cross-business product feed for the public marketplace (CUS-FR-012).

  Only active products from active, `marketplace_enabled` businesses.
  Supports `q`, `category`, `industry`, `min_price`, `max_price`, `limit`, and offset-style `cursor`.

  `category` / `industry` accept a single string, comma-separated string, or list
  of strings. Matching is case-insensitive (same as before); multiple values are
  OR'd. Empty list = no filter.

  `min_price` / `max_price` filter on the online-branch `product_branch_prices.price`.
  Products with nil price are excluded when either bound is set.
  """
  def list_products(opts \\ []) do
    q = blank_to_nil(opts[:q])
    categories = normalize_filter_values(opts[:category])
    industries = normalize_filter_values(opts[:industry])
    min_price = parse_decimal(opts[:min_price])
    max_price = parse_decimal(opts[:max_price])
    limit = parse_limit(opts[:limit])
    offset = parse_cursor(opts[:cursor])

    query =
      from(p in Product,
        join: b in Business,
        on: b.id == p.business_id and b.owner_id == p.owner_id,
        left_join: pbp in ProductBranchPrice,
        on: pbp.product_id == p.id and pbp.branch_id == b.online_branch_id,
        where: b.marketplace_enabled == true and b.is_active == true and p.is_active == true,
        order_by: [asc: p.name, asc: p.id],
        limit: ^(limit + 1),
        offset: ^offset,
        select: {p, b, pbp.price}
      )

    query =
      if is_binary(q) do
        like = "%#{escape_like(q)}%"

        from([p, b, _pbp] in query,
          where:
            ilike(p.name, ^like) or ilike(p.sku, ^like) or
              ilike(coalesce(p.category, ""), ^like) or ilike(b.name, ^like)
        )
      else
        query
      end

    query = apply_or_ilike_filter(query, categories, :category)
    query = apply_or_ilike_filter(query, industries, :industry)

    query =
      if min_price do
        from([_p, _b, pbp] in query,
          where: not is_nil(pbp.price) and pbp.price >= ^min_price
        )
      else
        query
      end

    query =
      if max_price do
        from([_p, _b, pbp] in query,
          where: not is_nil(pbp.price) and pbp.price <= ^max_price
        )
      else
        query
      end

    rows = Repo.all(query)
    products = rows |> Enum.map(fn {p, _b, _price} -> p end) |> Repo.preload(:images)

    enriched =
      Enum.zip(rows, products)
      |> Enum.map(fn {{_p, business, price}, product} ->
        %{product: product, business: business, price: price}
      end)

    {page, rest} = Enum.split(enriched, limit)

    data = Enum.map(page, &serialize_marketplace_product/1)

    next_cursor =
      if rest == [] do
        nil
      else
        Integer.to_string(offset + limit)
      end

    %{data: data, meta: %{limit: limit, next_cursor: next_cursor}}
  end

  def serialize_marketplace_product(%{
        product: %Product{} = p,
        business: %Business{} = b,
        price: price
      }) do
    %{
      id: p.id,
      name: p.name,
      price: if(price, do: to_string(price), else: nil),
      image_url: Catalog.primary_image_url(p),
      category: p.category,
      product_kind: p.product_kind,
      business_id: b.id,
      business_name: b.name,
      business_slug: b.marketplace_slug,
      industry: b.industry,
      primary_color: b.primary_color,
      logo_url: Kaarobar.Profiles.logo_url(b),
      tagline: b.tagline
    }
  end

  def get_business(id_or_slug) when is_binary(id_or_slug) do
    business =
      case Ecto.UUID.cast(id_or_slug) do
        {:ok, id} ->
          Repo.get_by(Business, id: id, marketplace_enabled: true, is_active: true)

        :error ->
          slug = String.downcase(String.trim(id_or_slug))
          Repo.get_by(Business, marketplace_slug: slug, marketplace_enabled: true, is_active: true)
      end

    case business do
      nil -> {:error, :not_found}
      b -> {:ok, Repo.preload(b, [:online_branch, :branches])}
    end
  end

  def catalog(business_id) do
    with {:ok, business} <- get_business(business_id),
         {:ok, branch_id} <- online_branch_id(business) do
      products =
        from(p in Product,
          where:
            p.business_id == ^business.id and p.owner_id == ^business.owner_id and
              p.is_active == true,
          preload: [
            :images,
            :variants,
            :product_category,
            product_modifier_groups: [modifier_group: :modifiers]
          ],
          order_by: [asc: p.name]
        )
        |> Repo.all()
        |> Enum.map(&Catalog.serialize_product(&1, branch_id))

      staff =
        if Kaarobar.Appointments.appointments_enabled?(business) do
          from(e in Employee,
            where:
              e.business_id == ^business.id and e.owner_id == ^business.owner_id and
                e.status == "active",
            order_by: [asc: e.name],
            select: %{id: e.id, name: e.name}
          )
          |> Repo.all()
        else
          []
        end

      {:ok, %{business: business, branch_id: branch_id, products: products, staff: staff}}
    end
  end

  def place_order(%Kaarobar.Schemas.CustomerAccount{} = account, attrs) do
    attrs = stringify_keys(attrs)
    business_id = attrs["business_id"]
    payment_method = attrs["payment_method"] || "card"
    notes = attrs["notes"] || attrs["delivery_note"]
    items = attrs["items"] || []

    with true <- payment_method in ~w(card wallet) || {:error, :invalid_payment},
         {:ok, business} <- get_business(business_id),
         {:ok, branch_id} <- online_branch_id(business),
         {:ok, membership} <- CustomerPortal.ensure_membership(account, business.id) do
      client_txn_id = attrs["client_txn_id"] || Ecto.UUID.generate()

      sale_attrs = %{
        "client_txn_id" => client_txn_id,
        "customer_id" => membership.id,
        "items" => items,
        "payments" => [
          %{
            "method" => payment_method,
            "amount" => attrs["amount"]
          }
        ],
        "notes" => notes,
        "source" => "online",
        "discount_amount" => attrs["discount_amount"] || "0"
      }

      sale_attrs =
        if attrs["tax_amount"] do
          Map.put(sale_attrs, "tax_amount", attrs["tax_amount"])
        else
          sale_attrs
        end

      case Pos.create_sale(branch_id, business.owner_id, business.id, nil, sale_attrs) do
        {:ok, sale} ->
          sale = Repo.preload(sale, [:items, :payments, :business, :customer])
          _ = notify_order_placed(account, business, sale)
          {:ok, sale}

        error ->
          error
      end
    end
  end

  defp notify_order_placed(account, business, sale) do
    total = to_string(sale.total_amount)

    _ =
      Kaarobar.Notifications.notify_customer_account(
        account.id,
        business.owner_id,
        "order.placed",
        %{
          sale_id: sale.id,
          business_id: business.id,
          business_name: business.name,
          status: sale.status,
          total_amount: total
        },
        title: "Order placed at #{business.name}",
        body: "Your order ##{sale.invoice_number} for #{total} was placed successfully."
      )

    _ =
      Kaarobar.Notifications.notify(
        business.owner_id,
        business.owner_id,
        "order.online_placed",
        %{
          sale_id: sale.id,
          business_id: business.id,
          invoice_number: sale.invoice_number,
          total_amount: total
        },
        title: "New online order",
        body: "Order ##{sale.invoice_number} for #{total} was placed online."
      )

    :ok
  end

  defp online_branch_id(%Business{online_branch_id: id}) when is_binary(id) and id != "",
    do: {:ok, id}

  defp online_branch_id(%Business{} = business) do
    case Repo.one(
           from(b in Branch,
             where: b.business_id == ^business.id and b.is_active == true,
             order_by: [asc: b.inserted_at],
             limit: 1,
             select: b.id
           )
         ) do
      nil -> {:error, :online_branch_required}
      id -> {:ok, id}
    end
  end

  def serialize_business(%Business{} = b) do
    %{
      id: b.id,
      name: b.name,
      industry: b.industry,
      marketplace_slug: b.marketplace_slug,
      online_branch_id: b.online_branch_id,
      tagline: b.tagline,
      logo_url: Kaarobar.Profiles.logo_url(b),
      primary_color: b.primary_color,
      marketplace_description: b.marketplace_description,
      loyalty_earn_per_amount: to_string(b.loyalty_earn_per_amount || 100),
      loyalty_points_per_earn: b.loyalty_points_per_earn || 1,
      loyalty_redeem_value: to_string(b.loyalty_redeem_value || 1),
      appointments_enabled: Kaarobar.Appointments.appointments_enabled?(b),
      commerce_mode:
        if(Kaarobar.Appointments.appointments_enabled?(b), do: "appointments", else: "orders")
    }
  end

  defp stringify_keys(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} -> {k, v}
    end)
  end

  defp blank_to_nil(nil), do: nil
  defp blank_to_nil(""), do: nil

  defp blank_to_nil(v) when is_binary(v) do
    case String.trim(v) do
      "" -> nil
      trimmed -> trimmed
    end
  end

  defp blank_to_nil(v), do: v

  defp normalize_filter_values(nil), do: []
  defp normalize_filter_values(""), do: []

  defp normalize_filter_values(v) when is_binary(v) do
    v
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp normalize_filter_values(v) when is_list(v) do
    v
    |> Enum.flat_map(&normalize_filter_values/1)
  end

  defp normalize_filter_values(_), do: []

  defp apply_or_ilike_filter(query, [], _field), do: query

  defp apply_or_ilike_filter(query, values, :category) do
    condition =
      Enum.reduce(values, nil, fn cat, acc ->
        clause = dynamic([p, _b, _pbp], ilike(coalesce(p.category, ""), ^cat))
        if is_nil(acc), do: clause, else: dynamic(^acc or ^clause)
      end)

    from(q in query, where: ^condition)
  end

  defp apply_or_ilike_filter(query, values, :industry) do
    condition =
      Enum.reduce(values, nil, fn ind, acc ->
        clause = dynamic([_p, b, _pbp], ilike(b.industry, ^ind))
        if is_nil(acc), do: clause, else: dynamic(^acc or ^clause)
      end)

    from(q in query, where: ^condition)
  end

  defp escape_like(term) when is_binary(term) do
    term
    |> String.replace("\\", "\\\\")
    |> String.replace("%", "\\%")
    |> String.replace("_", "\\_")
  end

  defp parse_limit(nil), do: @default_product_limit
  defp parse_limit(v) when is_integer(v) and v > 0, do: min(v, @max_product_limit)

  defp parse_limit(v) when is_binary(v) do
    case Integer.parse(String.trim(v)) do
      {n, _} when n > 0 -> min(n, @max_product_limit)
      _ -> @default_product_limit
    end
  end

  defp parse_limit(_), do: @default_product_limit

  defp parse_decimal(nil), do: nil
  defp parse_decimal(%Decimal{} = d), do: d

  defp parse_decimal(v) when is_binary(v) do
    case Decimal.parse(String.trim(v)) do
      {dec, _} -> dec
      :error -> nil
    end
  end

  defp parse_decimal(v) when is_integer(v), do: Decimal.new(v)
  defp parse_decimal(v) when is_float(v), do: Decimal.from_float(v)
  defp parse_decimal(_), do: nil

  defp parse_cursor(nil), do: 0
  defp parse_cursor(""), do: 0

  defp parse_cursor(v) when is_integer(v) and v >= 0, do: v

  defp parse_cursor(v) when is_binary(v) do
    case Integer.parse(String.trim(v)) do
      {n, _} when n >= 0 -> n
      _ -> 0
    end
  end

  defp parse_cursor(_), do: 0
end
