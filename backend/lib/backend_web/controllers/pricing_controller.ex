defmodule KaarobarWeb.PricingController do
  @moduledoc """
  Price lists, promotions, and the quote endpoint the POS calls before it shows
  a total.

  `quote/2` is the one that matters. The till sends a cart and gets back every
  line fully derived — base price, list override, modifiers, each promotion by
  name, tax broken out — so the screen can show a total and the cashier can
  answer "why is this 340?" without a second request.

  Quoting is a `POST` because the cart goes in the body and can be large, not
  because it changes anything. It does not: nothing here writes.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Audit
  alias Kaarobar.Catalog
  alias Kaarobar.Money
  alias Kaarobar.Pricing
  alias Kaarobar.Taxes

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "product:view"] when action in [:index_lists, :show_list, :index_rules, :quote]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "price_list:manage"]
       when action in [:create_list, :update_list, :delete_list, :put_price, :delete_price]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "price_rule:manage"]
       when action in [:create_rule, :update_rule, :delete_rule]

  # --- Price lists -----------------------------------------------------------

  def index_lists(conn, _params) do
    render(conn, :lists, price_lists: Pricing.list_price_lists(conn.assigns.scope))
  end

  def show_list(conn, %{"id" => id}) do
    with {:ok, list} <- Pricing.fetch_price_list(conn.assigns.scope, id) do
      render(conn, :list, price_list: list)
    end
  end

  def create_list(conn, params) do
    scope = conn.assigns.scope

    with {:ok, list} <- Pricing.create_price_list(scope, params) do
      Audit.log(scope, "price_list.created", list)

      conn
      |> put_status(:created)
      |> render(:list, price_list: list)
    end
  end

  def update_list(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, list} <- Pricing.fetch_price_list(scope, id),
         {:ok, updated} <- Pricing.update_price_list(scope, list, params) do
      Audit.log(scope, "price_list.updated", updated)
      render(conn, :list, price_list: updated)
    end
  end

  def delete_list(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, list} <- Pricing.fetch_price_list(scope, id),
         {:ok, deleted} <- Pricing.delete_price_list(scope, list) do
      Audit.log(scope, "price_list.deleted", deleted)
      send_resp(conn, :no_content, "")
    end
  end

  @doc "Sets a variant's price on a list, replacing any entry at the same break."
  def put_price(conn, %{"price_list_id" => list_id} = params) do
    scope = conn.assigns.scope

    with {:ok, list} <- Pricing.fetch_price_list(scope, list_id),
         {:ok, item} <- Pricing.put_price(scope, list, params) do
      conn
      |> put_status(:created)
      |> render(:list_item, item: item)
    end
  end

  @doc "Removes a variant's price from a list."
  def delete_price(conn, %{"price_list_id" => list_id, "variant_id" => variant_id}) do
    scope = conn.assigns.scope

    with {:ok, list} <- Pricing.fetch_price_list(scope, list_id) do
      :ok = Pricing.delete_price(scope, list, variant_id)
      send_resp(conn, :no_content, "")
    end
  end

  # --- Promotions ------------------------------------------------------------

  def index_rules(conn, _params) do
    render(conn, :rules, price_rules: Pricing.list_rules(conn.assigns.scope))
  end

  def create_rule(conn, params) do
    scope = conn.assigns.scope

    with {:ok, rule} <- Pricing.create_rule(scope, params) do
      Audit.log(scope, "price_rule.created", rule,
        summary: "Created promotion #{rule.name}",
        metadata: %{kind: rule.kind, scope: rule.scope}
      )

      conn
      |> put_status(:created)
      |> render(:rule, price_rule: rule)
    end
  end

  def update_rule(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, rule} <- Pricing.fetch_rule(scope, id),
         {:ok, updated} <- Pricing.update_rule(scope, rule, params) do
      Audit.log(scope, "price_rule.updated", updated)
      render(conn, :rule, price_rule: updated)
    end
  end

  def delete_rule(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, rule} <- Pricing.fetch_rule(scope, id),
         {:ok, deleted} <- Pricing.delete_rule(scope, rule) do
      Audit.log(scope, "price_rule.deleted", deleted)
      send_resp(conn, :no_content, "")
    end
  end

  # --- Quoting ---------------------------------------------------------------

  @doc """
  Prices a cart.

  Body:

      {
        "channel": "pos",
        "coupon_codes": ["SUMMER"],
        "lines": [{"variant_id": "...", "quantity": "2", "modifier_ids": ["..."]}]
      }

  Returns each line fully derived, plus the cart totals. Reads only.
  """
  def quote(conn, %{"lines" => lines} = params) when is_list(lines) do
    scope = conn.assigns.scope

    ctx =
      Pricing.context(scope,
        channel: Map.get(params, "channel", "pos"),
        coupon_codes: Map.get(params, "coupon_codes", [])
      )

    case build_lines(scope, lines) do
      {:ok, built} -> render(conn, :quote, result: Pricing.quote_cart(ctx, built))
      {:error, reason} -> {:error, reason}
    end
  end

  def quote(_conn, _params), do: {:error, :unprocessable_entity}

  # Each line names a variant; everything else it needs — the product, its tax
  # rates, the chosen modifiers — is resolved here so the pricing engine itself
  # performs no queries.
  defp build_lines(scope, lines) do
    Enum.reduce_while(lines, {:ok, []}, fn line, {:ok, acc} ->
      case build_line(scope, line) do
        {:ok, built} -> {:cont, {:ok, acc ++ [built]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp build_line(scope, line) do
    with {:ok, variant} <- Catalog.fetch_variant(scope, Map.get(line, "variant_id")) do
      product = variant.product

      {:ok,
       %{
         variant: variant,
         product: product,
         quantity: Money.to_decimal(Map.get(line, "quantity", 1)),
         modifiers: resolve_modifiers(scope, Map.get(line, "modifier_ids", [])),
         taxes: Taxes.rates_for(scope, product)
       }}
    end
  end

  defp resolve_modifiers(_scope, []), do: []

  defp resolve_modifiers(scope, modifier_ids) do
    scope
    |> Catalog.list_modifier_groups()
    |> Enum.flat_map(& &1.modifiers)
    |> Enum.filter(&(&1.id in List.wrap(modifier_ids)))
  end
end
