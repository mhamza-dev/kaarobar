defmodule Kaarobar.Marketplace do
  @moduledoc """
  Public marketplace discovery and portal online checkout.
  """

  import Ecto.Query

  alias Kaarobar.{Catalog, CustomerPortal, Pos, Repo}
  alias Kaarobar.Schemas.{Branch, Business, Product}

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

      {:ok, %{business: business, branch_id: branch_id, products: products}}
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
        {:ok, sale} -> {:ok, Repo.preload(sale, [:items, :payments, :business, :customer])}
        error -> error
      end
    end
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
      loyalty_earn_per_amount: to_string(b.loyalty_earn_per_amount || 100),
      loyalty_points_per_earn: b.loyalty_points_per_earn || 1,
      loyalty_redeem_value: to_string(b.loyalty_redeem_value || 1)
    }
  end

  defp stringify_keys(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} -> {k, v}
    end)
  end
end
