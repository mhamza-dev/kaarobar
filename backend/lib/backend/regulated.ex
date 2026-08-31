defmodule Kaarobar.Regulated do
  @moduledoc """
  The register a pesticide dealer or pharmacy is required to keep.

  ## Enforcement, not paperwork

  `check_sale/2` runs during checkout and refuses a restricted line that has no
  buyer named, no licence where one is required, or no batch where the product
  is batch-tracked. A shop cannot forget to fill the register in, because the
  sale does not go through without it.

  That is deliberately stricter than the rest of the system. Everywhere else a
  missing field is a warning the shopkeeper can work around; here it is the
  difference between a legal sale and one that costs them their licence.

  ## The register is written, not derived

  It is filled at the point of sale and is append-only, enforced by a trigger
  on both UPDATE and DELETE. An inspector shown a register the shop could have
  edited last night has been shown nothing.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Catalog.Product
  alias Kaarobar.Money
  alias Kaarobar.Regulated.RegisterEntry
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Scope

  @doc """
  Checks a basket before it is rung up.

  Returns `:ok`, or the first thing wrong with it. Called from checkout, so a
  restricted line without its register details never becomes a sale.

  `details` maps variant ids to the buyer information the counter collected.
  """
  @spec check_sale(Scope.t(), [map()]) :: :ok | {:error, term()}
  def check_sale(%Scope{} = scope, lines) do
    restricted = Enum.filter(lines, &restricted?/1)

    if restricted == [] do
      :ok
    else
      Enum.reduce_while(restricted, :ok, fn line, _acc ->
        case check_line(scope, line) do
          :ok -> {:cont, :ok}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
    end
  end

  @doc """
  Writes the register entries for a sale.

  Call inside the checkout transaction: a sale that commits without its
  register entry is a sale the shop cannot account for to an inspector, and it
  cannot be added afterwards because the table refuses updates.
  """
  @spec record_sale(Scope.t(), Sale.t(), [map()]) ::
          {:ok, [RegisterEntry.t()]} | {:error, term()}
  def record_sale(%Scope{} = scope, %Sale{} = sale, lines) do
    lines
    |> Enum.filter(&restricted?/1)
    |> Enum.reduce_while({:ok, []}, fn line, {:ok, acc} ->
      case insert_entry(scope, sale, line) do
        {:ok, entry} -> {:cont, {:ok, [entry | acc]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, entries} -> {:ok, Enum.reverse(entries)}
      other -> other
    end
  end

  @doc """
  The register, for an inspection or a return.

  Ordered oldest first, which is how a paper register reads and therefore how
  the two get checked against each other.
  """
  @spec register(Scope.t(), keyword()) :: [RegisterEntry.t()]
  def register(%Scope{} = scope, opts \\ []) do
    RegisterEntry
    |> Scoped.for_business(scope)
    |> filter_between(Keyword.get(opts, :from), Keyword.get(opts, :to))
    |> filter_eq(:product_id, Keyword.get(opts, :product_id))
    |> filter_eq(:batch_id, Keyword.get(opts, :batch_id))
    |> filter_eq(:customer_id, Keyword.get(opts, :customer_id))
    |> order_by([entry], asc: entry.occurred_at, asc: entry.id)
    |> preload([:product, :customer, :batch])
    |> Repo.all()
  end

  @doc """
  Everyone who bought from a batch.

  The only question a recall asks, and the reason a batch is required on a
  register entry for batch-tracked stock.
  """
  @spec buyers_of_batch(Scope.t(), Ecto.UUID.t()) :: [RegisterEntry.t()]
  def buyers_of_batch(%Scope{} = scope, batch_id),
    do: register(scope, batch_id: batch_id)

  @doc "Restricted products the business sells."
  @spec restricted_products(Scope.t()) :: [Product.t()]
  def restricted_products(%Scope{} = scope) do
    Product
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([product], product.is_restricted)
    |> order_by([product], asc: product.name)
    |> Repo.all()
  end

  @doc """
  Whether the shop's own licence is still valid.

  Checked before a restricted sale, because selling a controlled product on a
  lapsed licence is worse than not selling it.
  """
  @spec licence_valid?(Scope.t(), Date.t()) :: boolean()
  def licence_valid?(%Scope{business: nil}, _today), do: false

  def licence_valid?(%Scope{business: business}, today) do
    present?(business.license_number) and
      (is_nil(business.license_expires_on) or
         Date.compare(business.license_expires_on, today) != :lt)
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp restricted?(%{product: %Product{is_restricted: true}}), do: true
  defp restricted?(_line), do: false

  defp check_line(%Scope{} = scope, line) do
    product = line.product
    details = Map.get(line, :regulatory, %{})

    cond do
      not licence_valid?(scope, Date.utc_today()) ->
        {:error, :business_licence_invalid}

      blank?(Map.get(details, "buyer_name")) ->
        {:error, {:buyer_required, product.name}}

      product.requires_licence and blank?(Map.get(details, "buyer_licence_number")) ->
        {:error, {:buyer_licence_required, product.name}}

      product.tracks_batch and is_nil(Map.get(line, :batch_id)) ->
        {:error, {:batch_required, product.name}}

      over_limit?(product, line) ->
        {:error, {:quantity_over_limit, product.name, product.max_quantity_per_sale}}

      true ->
        :ok
    end
  end

  # Some substances may only be sold in a limited quantity at a time. The limit
  # belongs to the product because it is a property of the substance.
  defp over_limit?(%Product{max_quantity_per_sale: nil}, _line), do: false

  defp over_limit?(%Product{max_quantity_per_sale: limit}, line),
    do: Decimal.compare(Money.to_decimal(line.quantity), limit) == :gt

  defp insert_entry(%Scope{} = scope, %Sale{} = sale, line) do
    details = Map.get(line, :regulatory, %{})
    product = line.product

    %RegisterEntry{}
    |> RegisterEntry.changeset(%{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      branch_id: sale.branch_id,
      sale_id: sale.id,
      sale_item_id: Map.get(line, :sale_item_id),
      product_id: product.id,
      batch_id: Map.get(line, :batch_id),
      product_name_snapshot: product.name,
      regulatory_class: product.regulatory_class,
      active_ingredient: product.active_ingredient,
      batch_number_snapshot: Map.get(line, :batch_number),
      quantity: line.quantity,
      unit_snapshot: Map.get(line, :unit),
      customer_id: sale.customer_id,
      buyer_name: Map.get(details, "buyer_name"),
      buyer_id_type: Map.get(details, "buyer_id_type"),
      buyer_id_number: Map.get(details, "buyer_id_number"),
      buyer_licence_number: Map.get(details, "buyer_licence_number"),
      buyer_address: Map.get(details, "buyer_address"),
      sold_by_id: Scope.user_id(scope),
      sold_by_label: scope.user && scope.user.name,
      business_licence_snapshot: scope.business && scope.business.license_number,
      prescriber_name: Map.get(details, "prescriber_name"),
      prescription_reference: Map.get(details, "prescription_reference"),
      purpose: Map.get(details, "purpose"),
      occurred_at: sale.sold_at
    })
    |> Repo.insert()
  end

  defp filter_between(query, nil, nil), do: query

  defp filter_between(query, from, nil),
    do: where(query, [e], fragment("?::date", e.occurred_at) >= ^from)

  defp filter_between(query, nil, to),
    do: where(query, [e], fragment("?::date", e.occurred_at) <= ^to)

  defp filter_between(query, from, to) do
    where(
      query,
      [e],
      fragment("?::date", e.occurred_at) >= ^from and fragment("?::date", e.occurred_at) <= ^to
    )
  end

  defp filter_eq(query, _field, nil), do: query
  defp filter_eq(query, :product_id, value), do: where(query, [e], e.product_id == ^value)
  defp filter_eq(query, :batch_id, value), do: where(query, [e], e.batch_id == ^value)
  defp filter_eq(query, :customer_id, value), do: where(query, [e], e.customer_id == ^value)

  defp blank?(nil), do: true
  defp blank?(value) when is_binary(value), do: String.trim(value) == ""
  defp blank?(_value), do: false

  defp present?(value), do: not blank?(value)
end
