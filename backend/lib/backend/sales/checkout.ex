defmodule Kaarobar.Sales.Checkout do
  @moduledoc """
  Turning a basket into a sale. The most important module in the codebase.

  Everything a till does at the moment the customer pays happens here, in one
  transaction: validate, price, tax, lock and decrement stock, write the sale
  and its lines, take the tenders, post any credit to the customer's ledger,
  move the shift's totals, and record it all in the audit trail. Either every
  one of those lands or none of them do.

  ## Why one transaction and not several

  Because the failure modes of doing it in pieces are the ones that destroy
  trust in a POS. Stock decremented but the sale not written is inventory that
  evaporated. A sale written but the tender lost is a drawer that will not
  balance. A credit sale recorded but the ledger entry missing is a debt nobody
  will ever collect. These are not hypothetical — they are what every shop that
  has been burned by a POS will describe if asked.

  ## What the client may and may not decide

  The client sends what was scanned and what was tendered. It does not send
  prices, tax or totals: those are computed here from the catalog, the price
  lists, the promotions in force and the business's tax setup. A till that
  could send its own totals could send any total, and the first person to
  notice would be an auditor.

  The exceptions are deliberate and permission-gated: `sale:price_override`
  allows a manually entered price, `discount:apply` a discount within the
  counter's limit, `discount:override` one beyond it, and `sale:backdate` a
  sale dated in the past. Each is recorded on the sale with who allowed it.

  ## Ordering, and the last unit

  Stock moves are posted in `{branch_id, variant_id}` order. Two checkouts
  touching the same two products in opposite orders would otherwise deadlock,
  and a deadlock at the till looks like the system hanging. Within a product,
  `Kaarobar.Inventory.Ledger` takes a row lock — which is what makes it
  impossible for two cashiers to both sell the last unit.

  ## Idempotency

  Handled at the edge by `KaarobarWeb.Plugs.Idempotency`, which persists the
  response against the client's `Idempotency-Key`. A shop's connection drops
  mid-request more often than anyone would like, and the retry must not charge
  the customer twice.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Catalog
  alias Kaarobar.Catalog.Modifier
  alias Kaarobar.Catalog.Product
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Customers
  alias Kaarobar.Inventory.Ledger
  alias Kaarobar.Money
  alias Kaarobar.Pricing
  alias Kaarobar.Registers
  alias Kaarobar.Registers.Register
  alias Kaarobar.Registers.Shift
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Sales.Order
  alias Kaarobar.Sales.OrderItem
  alias Kaarobar.Sales.Payment
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Sales.SaleItem
  alias Kaarobar.Sales.SaleItemModifier
  alias Kaarobar.Sales.SaleItemTax
  alias Kaarobar.Scope
  alias Kaarobar.Sequences
  alias Kaarobar.Taxes
  alias Kaarobar.Verticals

  @type error ::
          :no_lines
          | :no_payment
          | :branch_required
          | :service_mode_required
          | :served_by_required
          | :shift_not_open
          | :order_closed
          | :not_found
          | :credit_not_allowed
          | :credit_customer_required
          | {:insufficient_stock, Ecto.UUID.t()}
          | {:underpaid, Decimal.t()}
          | {:overpaid, Decimal.t()}
          | {:credit_limit_exceeded, Decimal.t()}
          | {:variant_not_found, Ecto.UUID.t() | nil}
          | {:forbidden, String.t()}
          | Ecto.Changeset.t()

  # ===========================================================================
  # Public API
  # ===========================================================================

  @doc """
  Prices a basket without committing anything.

  What the till shows as the customer adds items: the running total, itemised,
  with every discount named. Performs no writes and takes no stock, so it is
  safe to call on every keystroke.
  """
  @spec preview(Scope.t(), map()) :: {:ok, map()} | {:error, error()}
  def preview(%Scope{} = scope, params) do
    with {:ok, request} <- build_request(scope, params) do
      {:ok, summarise(price(scope, request))}
    end
  end

  @doc """
  Completes a sale.

  ## Parameters

    * `"lines"` — `[%{"variant_id", "quantity", "modifier_ids", "note",
      "seat_number", "unit_price"}]`. `unit_price` requires
      `sale:price_override`.
    * `"payments"` — `[%{"method", "amount", "tendered_amount", "reference"}]`.
      Must sum to the total; cash may exceed it, and the difference is change.
    * `"register_id"` — the till. Its open shift is used unless `"shift_id"`
      says otherwise.
    * `"customer_id"` — required when any tender is `credit`.
    * `"order_id"` — bills an open ticket, marking its lines paid for.
    * `"order_discount"` — an amount off the whole sale, prorated across lines
      before tax. Requires `discount:apply`.
    * `"service_mode"`, `"served_by_user_id"` — required by some verticals.
    * `"sold_at"` — requires `sale:backdate`.

  ## Example

      Checkout.run(scope, %{
        "register_id" => register.id,
        "lines" => [%{"variant_id" => shampoo.id, "quantity" => "2"}],
        "payments" => [%{"method" => "cash", "amount" => "700",
                         "tendered_amount" => "1000"}]
      })
  """
  @spec run(Scope.t(), map()) :: {:ok, Sale.t()} | {:error, error()}
  def run(%Scope{} = scope, params) do
    with {:ok, request} <- build_request(scope, params),
         priced = price(scope, request),
         {:ok, tenders} <- resolve_tenders(request, priced) do
      case commit(scope, request, priced, tenders) do
        {:ok, sale} ->
          broadcast(scope, sale)
          {:ok, sale}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  # ===========================================================================
  # Building the request
  # ===========================================================================

  # Everything the checkout needs, resolved and validated, before a single row
  # is written. Failing here costs nothing; failing halfway through the
  # transaction costs a rollback the customer is standing through.
  defp build_request(%Scope{} = scope, params) do
    params = stringify(params)

    with {:ok, branch_id} <- resolve_branch(scope, params),
         {:ok, register} <- resolve_register(scope, params),
         {:ok, shift} <- resolve_shift(scope, params, register),
         {:ok, order} <- resolve_order(scope, params),
         {:ok, lines} <- resolve_lines(scope, params, order),
         :ok <- validate_vertical(scope, params, order),
         {:ok, sold_at} <- resolve_sold_at(scope, params),
         {:ok, order_discount} <- resolve_order_discount(scope, params) do
      {:ok,
       %{
         params: params,
         branch_id: branch_id,
         register: register,
         shift: shift,
         order: order,
         lines: lines,
         sold_at: sold_at,
         order_discount: order_discount,
         customer_id: Map.get(params, "customer_id") || (order && order.customer_id),
         channel: Map.get(params, "channel") || (order && order.channel) || "pos",
         service_mode: Map.get(params, "service_mode") || (order && order.service_mode),
         served_by_user_id:
           Map.get(params, "served_by_user_id") || (order && order.served_by_user_id),
         currency: scope.business.currency,
         prices_include_tax: scope.business.prices_include_tax,
         rounding_increment: scope.business.cash_rounding_increment
       }}
    end
  end

  defp resolve_branch(%Scope{} = scope, params) do
    case Map.get(params, "branch_id") || Scope.branch_id(scope) do
      nil -> {:error, :branch_required}
      branch_id -> {:ok, branch_id}
    end
  end

  defp resolve_register(_scope, %{"register_id" => nil}), do: {:ok, nil}

  defp resolve_register(%Scope{} = scope, %{"register_id" => id}) when is_binary(id),
    do: Registers.fetch_register(scope, id)

  defp resolve_register(_scope, _params), do: {:ok, nil}

  # An explicit shift wins; otherwise the till's open one. A sale rung with no
  # shift at all is allowed — an online order has no drawer — but a sale rung
  # on a register whose shift has been closed is not, because the money would
  # belong to a count that has already been signed off.
  defp resolve_shift(_scope, _params, nil), do: {:ok, nil}

  defp resolve_shift(%Scope{} = scope, params, %Register{} = register) do
    case Map.get(params, "shift_id") do
      nil ->
        case Registers.current_shift(scope, register.id) do
          nil -> {:error, :shift_not_open}
          shift -> {:ok, shift}
        end

      shift_id ->
        with {:ok, shift} <- Registers.fetch_shift(scope, shift_id) do
          if Shift.open?(shift), do: {:ok, shift}, else: {:error, :shift_not_open}
        end
    end
  end

  defp resolve_order(_scope, %{"order_id" => nil}), do: {:ok, nil}

  defp resolve_order(%Scope{} = scope, %{"order_id" => id}) when is_binary(id) do
    Order
    |> Scoped.for_business(scope)
    |> where([order], order.id == ^id)
    |> preload(items: :modifiers)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      %Order{} = order -> if Order.live?(order), do: {:ok, order}, else: {:error, :order_closed}
    end
  end

  defp resolve_order(_scope, _params), do: {:ok, nil}

  # ===========================================================================
  # Lines
  # ===========================================================================

  # Billing a ticket takes its unbilled lines when the client sends none of its
  # own; sending lines explicitly is how a table splits a bill.
  defp resolve_lines(%Scope{} = scope, params, order) do
    inputs =
      case Map.get(params, "lines") do
        list when is_list(list) and list != [] -> Enum.map(list, &stringify/1)
        _empty -> lines_from_order(order)
      end

    if inputs == [] do
      {:error, :no_lines}
    else
      variants = load_variants(scope, inputs)
      modifiers = load_modifiers(scope, inputs)

      resolved =
        inputs
        |> Enum.with_index()
        |> Enum.reduce_while({:ok, []}, fn {input, index}, {:ok, acc} ->
          case resolve_line(scope, input, index, variants, modifiers) do
            {:ok, line} -> {:cont, {:ok, [line | acc]}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end)

      case resolved do
        {:ok, lines} -> {:ok, Enum.reverse(lines)}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp lines_from_order(nil), do: []

  defp lines_from_order(%Order{items: items}) when is_list(items) do
    items
    |> Enum.reject(&OrderItem.fully_billed?/1)
    |> Enum.map(fn item ->
      %{
        "variant_id" => item.variant_id,
        "quantity" => OrderItem.unbilled_quantity(item),
        "seat_number" => item.seat_number,
        "note" => item.note,
        "order_item_id" => item.id,
        "modifier_ids" => Enum.map(item.modifiers || [], & &1.modifier_id)
      }
    end)
  end

  defp lines_from_order(%Order{}), do: []

  defp resolve_line(%Scope{} = scope, input, index, variants, modifiers) do
    variant_id = Map.get(input, "variant_id")

    case Map.get(variants, variant_id) do
      nil ->
        {:error, {:variant_not_found, variant_id}}

      %ProductVariant{} = variant ->
        chosen =
          input
          |> Map.get("modifier_ids", [])
          |> List.wrap()
          |> Enum.map(&Map.get(modifiers, &1))
          |> Enum.reject(&is_nil/1)

        {:ok,
         %{
           index: index,
           input: input,
           variant: variant,
           product: variant.product,
           modifiers: chosen,
           taxes: Taxes.rates_for(scope, variant.product),
           quantity: quantity_of(input),
           order_item_id: uuid_or_nil(Map.get(input, "order_item_id")),
           seat_number: Map.get(input, "seat_number"),
           note: Map.get(input, "note")
         }}
    end
  end

  # One query for every variant in the basket, and one for every modifier. A
  # basket of thirty items should not cost sixty round trips with a customer
  # standing at the counter.
  defp load_variants(%Scope{} = scope, inputs) do
    ids = inputs |> Enum.map(&Map.get(&1, "variant_id")) |> Enum.filter(&uuid?/1)

    ProductVariant
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([variant], variant.id in ^ids)
    |> preload(product: [:unit, tax_group: [tax_group_rates: :tax]])
    |> Repo.all()
    |> Map.new(&{&1.id, &1})
  end

  defp load_modifiers(%Scope{} = scope, inputs) do
    ids =
      inputs
      |> Enum.flat_map(&List.wrap(Map.get(&1, "modifier_ids", [])))
      |> Enum.filter(&uuid?/1)
      |> Enum.uniq()

    if ids == [] do
      %{}
    else
      Modifier
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([modifier], modifier.id in ^ids)
      |> Repo.all()
      |> Map.new(&{&1.id, &1})
    end
  end

  defp quantity_of(input) do
    case Money.cast(Map.get(input, "quantity", 1)) do
      {:ok, quantity} -> quantity
      :error -> Decimal.new(1)
    end
  end

  # ===========================================================================
  # Vertical requirements
  # ===========================================================================

  # A restaurant sale with no service mode cannot be routed to a kitchen or a
  # rider; a salon sale with nobody named cannot pay a commission. The registry
  # decides which verticals care, so adding one is a config change.
  defp validate_vertical(%Scope{business: business}, params, order) do
    type = business.business_type
    service_mode = Map.get(params, "service_mode") || (order && order.service_mode)
    served_by = Map.get(params, "served_by_user_id") || (order && order.served_by_user_id)

    cond do
      Verticals.requires_service_mode?(type) and is_nil(service_mode) ->
        {:error, :service_mode_required}

      Verticals.requires_served_by?(type) and is_nil(served_by) ->
        {:error, :served_by_required}

      true ->
        :ok
    end
  end

  defp resolve_sold_at(%Scope{} = scope, params) do
    case Map.get(params, "sold_at") do
      nil ->
        {:ok, DateTime.utc_now()}

      value ->
        with :ok <- require_permission(scope, "sale:backdate"),
             {:ok, at, _offset} <- parse_datetime(value) do
          {:ok, at}
        end
    end
  end

  defp parse_datetime(%DateTime{} = value), do: {:ok, value, 0}
  defp parse_datetime(value) when is_binary(value), do: DateTime.from_iso8601(value)
  defp parse_datetime(_value), do: {:error, :invalid_sold_at}

  defp resolve_order_discount(%Scope{} = scope, params) do
    case Map.get(params, "order_discount") do
      nil ->
        {:ok, Money.zero()}

      value ->
        with {:ok, amount} <- cast_amount(value),
             :ok <- require_permission(scope, "discount:apply") do
          {:ok, amount}
        end
    end
  end

  defp cast_amount(value) do
    case Money.cast(value) do
      {:ok, amount} -> {:ok, amount}
      :error -> {:error, :invalid_amount}
    end
  end

  # Names the permission in the error. "Forbidden" alone leaves a supervisor
  # guessing which switch to flip.
  defp require_permission(%Scope{} = scope, permission) do
    case Scope.authorize(scope, permission) do
      :ok -> :ok
      {:error, :forbidden} -> {:error, {:forbidden, permission}}
    end
  end

  # ===========================================================================
  # Pricing
  # ===========================================================================

  # Priced once, against a context fixed at a single instant, so a time-limited
  # promotion cannot expire between the first line and the last.
  defp price(%Scope{} = scope, request) do
    ctx =
      Pricing.context(scope,
        at: request.sold_at,
        branch_id: request.branch_id,
        channel: request.channel,
        coupon_codes: Map.get(request.params, "coupon_codes", [])
      )

    quotes =
      Enum.map(request.lines, fn line ->
        Pricing.quote_line(ctx, %{
          variant: line.variant,
          product: line.product,
          quantity: line.quantity,
          modifiers: line.modifiers,
          taxes: line.taxes
        })
      end)

    priced_lines =
      request.lines
      |> Enum.zip(quotes)
      |> apply_order_discount(request)

    totals = totals_for(priced_lines, request)

    %{lines: priced_lines, totals: totals}
  end

  # The order discount is prorated across lines *before* tax, by each line's
  # share of the subtotal, and the tax is then recomputed on what is left. Tax
  # is owed on the consideration actually paid, so discounting after tax would
  # overcharge the customer and overstate what the shop owes.
  defp apply_order_discount(pairs, %{order_discount: discount} = request) do
    subtotal = pairs |> Enum.map(fn {_line, quote} -> quote.subtotal end) |> Money.sum()

    if Money.zero?(discount) or not Money.positive?(subtotal) do
      Enum.map(pairs, &priced_line(&1, Money.zero(), request))
    else
      capped = Money.min(discount, subtotal)

      pairs
      |> Enum.map(fn {_line, quote} = pair ->
        share =
          quote.subtotal
          |> Money.div(subtotal)
          |> Money.mult(capped)
          |> Money.round(request.currency)

        {pair, share}
      end)
      |> settle_rounding(capped, request)
    end
  end

  # Prorating three ways rarely divides evenly. The remainder goes to the
  # largest line, so the shares always sum to exactly the discount given rather
  # than to a penny either side of it.
  defp settle_rounding(shares, capped, request) do
    allocated = shares |> Enum.map(&elem(&1, 1)) |> Money.sum()
    remainder = Money.sub(capped, allocated)

    largest_index =
      shares
      |> Enum.with_index()
      |> Enum.max_by(fn {{{_line, quote}, _share}, _index} -> Decimal.to_float(quote.subtotal) end)
      |> elem(1)

    shares
    |> Enum.with_index()
    |> Enum.map(fn {{pair, share}, index} ->
      adjusted = if index == largest_index, do: Money.add(share, remainder), else: share
      priced_line(pair, adjusted, request)
    end)
  end

  defp priced_line({line, quote}, order_discount_share, request) do
    net = quote.subtotal |> Money.sub(order_discount_share) |> Money.clamp_non_negative()

    tax =
      Taxes.compute(net, line.taxes,
        inclusive: request.prices_include_tax,
        currency: request.currency
      )

    %{
      line: line,
      quote: quote,
      order_discount_share: order_discount_share,
      net: tax.net,
      tax_total: tax.tax_total,
      tax_lines: tax.lines,
      gross: tax.gross
    }
  end

  # `subtotal` is the net of tax, after every discount. Storing it that way is
  # what makes `Sale.margin/1` — subtotal less cost — mean the same thing
  # whether the business prices tax-inclusive or not.
  defp totals_for(priced_lines, request) do
    subtotal = priced_lines |> Enum.map(& &1.net) |> Money.sum()
    discount_total = priced_lines |> Enum.map(& &1.quote.discount_total) |> Money.sum()
    order_discount = priced_lines |> Enum.map(& &1.order_discount_share) |> Money.sum()
    tax_total = priced_lines |> Enum.map(& &1.tax_total) |> Money.sum()
    gross = priced_lines |> Enum.map(& &1.gross) |> Money.sum()

    {total, rounding} = round_to_cash(gross, request.rounding_increment, request.currency)

    %{
      subtotal: subtotal,
      discount_total: discount_total,
      order_discount: order_discount,
      tax_total: tax_total,
      rounding: rounding,
      total: total
    }
  end

  # Where the smallest coin is larger than the smallest unit of account, a
  # total has to be rounded to something the customer can actually hand over.
  # The adjustment is kept rather than absorbed: on a thousand sales a day it
  # is not a rounding error, it is a line in the accounts.
  defp round_to_cash(gross, nil, _currency), do: {gross, Money.zero()}

  defp round_to_cash(gross, increment, currency) do
    if Money.positive?(increment) do
      rounded =
        gross
        |> Money.div(increment)
        |> Decimal.round(0, :half_up)
        |> Money.mult(increment)
        |> Money.round(currency)

      {rounded, Money.sub(rounded, gross)}
    else
      {gross, Money.zero()}
    end
  end

  defp summarise(%{lines: lines, totals: totals}) do
    %{
      totals: totals,
      lines:
        Enum.map(lines, fn priced ->
          %{
            variant_id: priced.line.variant.id,
            name: line_name(priced.line),
            quantity: priced.line.quantity,
            unit_price: priced.quote.unit_price,
            discounts: priced.quote.discounts,
            order_discount: priced.order_discount_share,
            net: priced.net,
            tax_total: priced.tax_total,
            tax_lines: priced.tax_lines,
            total: priced.gross
          }
        end)
    }
  end

  # ===========================================================================
  # Tenders
  # ===========================================================================

  # Tenders must sum to the total. Cash may exceed it, and the difference is
  # change; anything else exceeding it is money the shop cannot give back
  # through that channel, and accepting it silently would leave the sale and
  # the card settlement disagreeing.
  defp resolve_tenders(request, %{totals: totals}) do
    tenders =
      request.params
      |> Map.get("payments", [])
      |> Enum.map(&stringify/1)
      |> Enum.map(&normalize_tender(&1, request.currency))

    paid = tenders |> Enum.map(& &1.amount) |> Money.sum()
    change = tenders |> Enum.map(& &1.change) |> Money.sum()

    cond do
      tenders == [] ->
        {:error, :no_payment}

      Decimal.compare(paid, totals.total) == :lt ->
        {:error, {:underpaid, Money.sub(totals.total, paid)}}

      Decimal.compare(paid, totals.total) == :gt ->
        {:error, {:overpaid, Money.sub(paid, totals.total)}}

      credit_tender?(tenders) and is_nil(request.customer_id) ->
        {:error, :credit_customer_required}

      true ->
        {:ok, %{tenders: tenders, paid: paid, change: change}}
    end
  end

  defp normalize_tender(input, currency) do
    method = Map.get(input, "method", "cash")
    amount = input |> Map.get("amount") |> to_amount()
    # Absent means "handed over exactly the amount", which is not the same as
    # zero — recording zero would make every payment look short of itself.
    tendered = optional_amount(Map.get(input, "tendered_amount"))

    change =
      if method in Payment.cash_methods() and tendered do
        tendered |> Money.sub(amount) |> Money.clamp_non_negative()
      else
        Money.zero()
      end

    %{
      method: method,
      amount: Money.round(amount, currency),
      tendered_amount: tendered,
      change: change,
      reference: Map.get(input, "reference"),
      card_last_four: Map.get(input, "card_last_four"),
      card_scheme: Map.get(input, "card_scheme"),
      gateway_transaction_id: Map.get(input, "gateway_transaction_id")
    }
  end

  defp to_amount(nil), do: Money.zero()

  defp to_amount(value) do
    case Money.cast(value) do
      {:ok, amount} -> amount
      :error -> Money.zero()
    end
  end

  defp optional_amount(nil), do: nil

  defp optional_amount(value) do
    case Money.cast(value) do
      {:ok, amount} -> amount
      :error -> nil
    end
  end

  defp credit_tender?(tenders),
    do: Enum.any?(tenders, &(&1.method in Payment.deferred_methods()))

  defp credit_total(tenders) do
    tenders
    |> Enum.filter(&(&1.method in Payment.deferred_methods()))
    |> Enum.map(& &1.amount)
    |> Money.sum()
  end

  # ===========================================================================
  # The transaction
  # ===========================================================================

  defp commit(%Scope{} = scope, request, priced, tenders) do
    Repo.transaction(fn ->
      with {:ok, number} <- next_number(scope, request),
           {:ok, sale} <- insert_sale(scope, request, priced, tenders, number),
           {:ok, items} <- insert_items(scope, sale, priced),
           {:ok, costs} <- post_stock(scope, request, sale, priced),
           {:ok, sale, items} <- apply_costs(sale, items, costs),
           {:ok, payments} <- insert_payments(sale, tenders),
           :ok <- post_credit(scope, request, sale, tenders),
           :ok <- bill_order(request, priced),
           {:ok, _shift} <- Registers.apply_sale(sale, payments) do
        log(scope, sale, priced, tenders)
        %{sale | items: items, payments: payments}
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  # A register with its own prefix issues into its own series, which many
  # fiscal regimes require per terminal — and which stops three counters
  # queueing on one lock through the evening rush. The prefix is part of what
  # identifies a series, so each till's run of numbers is unbroken.
  #
  # Tills without a prefix share the business's series. Numbering per branch
  # instead would let two branches issue the same invoice number, which the
  # unique index on `(business_id, number)` would then reject at the worst
  # possible moment — mid-checkout, with a customer waiting.
  defp next_number(%Scope{} = scope, request) do
    opts = [at: DateTime.to_date(request.sold_at)]

    opts =
      case request.register do
        %Register{invoice_prefix: prefix} when is_binary(prefix) and prefix != "" ->
          Keyword.put(opts, :prefix, prefix)

        _no_prefix ->
          opts
      end

    Sequences.next(scope, "sale", opts)
  end

  defp insert_sale(%Scope{} = scope, request, %{totals: totals}, tenders, number) do
    attrs = %{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      branch_id: request.branch_id,
      register_id: request.register && request.register.id,
      shift_id: request.shift && request.shift.id,
      order_id: request.order && request.order.id,
      customer_id: request.customer_id,
      number: number,
      status: "completed",
      channel: request.channel,
      currency: request.currency,
      subtotal: totals.subtotal,
      discount_total: totals.discount_total,
      order_discount: totals.order_discount,
      tax_total: totals.tax_total,
      rounding: totals.rounding,
      total: totals.total,
      paid_total: tenders.paid,
      change_due: tenders.change,
      prices_include_tax: request.prices_include_tax,
      service_mode: request.service_mode,
      served_by_user_id: request.served_by_user_id,
      cashier_id: Scope.user_id(scope),
      cashier_label: scope.user && scope.user.name,
      notes: Map.get(request.params, "notes"),
      discount_reason: Map.get(request.params, "discount_reason"),
      discount_approved_by_id: Map.get(request.params, "discount_approved_by_id"),
      sold_at: request.sold_at
    }

    %Sale{} |> Sale.create_changeset(attrs) |> Repo.insert()
  end

  defp insert_items(%Scope{} = scope, %Sale{} = sale, %{lines: lines}) do
    lines
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {priced, position}, {:ok, acc} ->
      case insert_item(scope, sale, priced, position) do
        {:ok, item} -> {:cont, {:ok, [item | acc]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, Enum.reverse(items)}
      {:error, reason} -> {:error, reason}
    end
  end

  defp insert_item(%Scope{} = scope, %Sale{} = sale, priced, position) do
    line = priced.line
    quote = priced.quote

    attrs = %{
      business_id: Scope.business_id(scope),
      sale_id: sale.id,
      variant_id: line.variant.id,
      product_id: line.product && line.product.id,
      name_snapshot: line_name(line),
      sku_snapshot: line.variant.sku,
      unit_snapshot: unit_label(line.product),
      quantity: line.quantity,
      list_price: quote.list_price,
      unit_price: quote.unit_price,
      discount_total: Money.add(quote.discount_total, priced.order_discount_share),
      modifier_total: Money.mult(quote.modifier_total, line.quantity),
      net_total: priced.net,
      tax_total: priced.tax_total,
      line_total: priced.gross,
      applied_rule_ids: applied_rule_ids(quote),
      batch_id: uuid_or_nil(Map.get(line.input, "batch_id")),
      serial_id: uuid_or_nil(Map.get(line.input, "serial_id")),
      seat_number: line.seat_number,
      position: position,
      note: line.note
    }

    with {:ok, item} <- %SaleItem{} |> SaleItem.changeset(attrs) |> Repo.insert(),
         :ok <- insert_tax_lines(item, priced.tax_lines),
         :ok <- insert_modifier_lines(item, line.modifiers) do
      {:ok, item}
    end
  end

  defp applied_rule_ids(quote) do
    quote.discounts
    |> Enum.map(& &1.rule_id)
    |> Enum.reject(&is_nil/1)
  end

  defp insert_tax_lines(%SaleItem{} = item, tax_lines) do
    tax_lines
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {tax, position}, :ok ->
      attrs = %{
        sale_item_id: item.id,
        tax_id: tax.tax_id,
        name_snapshot: tax.name,
        label_snapshot: tax.label,
        rate_snapshot: tax.rate,
        is_compound: tax.compound,
        amount: tax.amount,
        position: position
      }

      case %SaleItemTax{} |> SaleItemTax.changeset(attrs) |> Repo.insert() do
        {:ok, _line} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp insert_modifier_lines(%SaleItem{} = item, modifiers) do
    Enum.reduce_while(modifiers, :ok, fn modifier, :ok ->
      attrs = %{
        sale_item_id: item.id,
        modifier_id: modifier.id,
        name_snapshot: modifier.name,
        price_delta: modifier.price_delta
      }

      case %SaleItemModifier{} |> SaleItemModifier.changeset(attrs) |> Repo.insert() do
        {:ok, _line} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  # ===========================================================================
  # Stock
  # ===========================================================================

  # Every line is exploded to the real things it consumes — a burger becomes a
  # bun and a patty, a haircut with colour becomes the dye — then all the
  # resulting moves are posted in `{branch_id, variant_id}` order so two
  # checkouts cannot deadlock against each other.
  #
  # Costs come back attributed to the line that caused them, which is what
  # makes `cost_snapshot` honest: the margin on this sale is what this sale
  # actually cost, not what the same goods would cost today.
  defp post_stock(%Scope{} = scope, request, %Sale{} = sale, %{lines: lines}) do
    lines
    |> Enum.flat_map(&moves_for_line(scope, request, sale, &1))
    |> Enum.sort_by(fn {_index, move} -> {move.branch_id, move.variant_id} end)
    |> Enum.reduce_while({:ok, %{}}, fn {index, move}, {:ok, costs} ->
      case Ledger.post_within(scope, move) do
        {:ok, posted} ->
          cost = Decimal.abs(posted.total_cost || Money.zero())
          {:cont, {:ok, Map.update(costs, index, cost, &Money.add(&1, cost))}}

        {:error, reason} ->
          {:halt, {:error, stock_error(reason, move)}}
      end
    end)
  end

  # The product's own stock and its modifiers' are decided separately. A salon
  # haircut tracks no stock of its own, but the colour added to it is real dye
  # off a real shelf, and a service that consumed nothing would leave the dye
  # count drifting until nobody trusted it.
  defp moves_for_line(%Scope{} = scope, request, %Sale{} = sale, priced) do
    line = priced.line

    components =
      if stockable?(line.product) do
        Catalog.explode(scope, line.variant, line.quantity)
      else
        []
      end

    # A batch or serial chosen at the till belongs to the thing that was
    # scanned, and only to it. Drawing a burger's bun from the patty's lot
    # number would be nonsense on a recall notice, and so would drawing the
    # dye a modifier consumes from the shampoo's.
    scanned_id = line.variant.id

    (components ++ modifier_consumption(line))
    |> Enum.map(fn component ->
      own? = component.variant_id == scanned_id

      {line.index,
       %{
         variant_id: component.variant_id,
         branch_id: request.branch_id,
         kind: "sale",
         quantity: component.quantity,
         batch_id: if(own?, do: uuid_or_nil(Map.get(line.input, "batch_id"))),
         serial_id: if(own?, do: uuid_or_nil(Map.get(line.input, "serial_id"))),
         reference_type: "sale",
         reference_id: sale.id,
         reason: "Sale #{sale.number}",
         occurred_at: request.sold_at
       }}
    end)
  end

  # A kitchen that adds a fried egg to every second order is using eggs. If
  # that is not recorded the egg count drifts until nobody trusts it.
  defp modifier_consumption(line) do
    line.modifiers
    |> Enum.filter(& &1.consumes_variant_id)
    |> Enum.map(fn modifier ->
      quantity = modifier.consumes_quantity || Decimal.new(1)

      %{
        variant_id: modifier.consumes_variant_id,
        quantity: Money.mult(quantity, line.quantity)
      }
    end)
  end

  defp stockable?(nil), do: false
  defp stockable?(%Product{tracks_stock: tracks}), do: tracks

  # `:insufficient_stock` on its own tells a cashier nothing. Naming the item
  # is the difference between a message they can act on and one they will call
  # someone about.
  defp stock_error(:insufficient_stock, move),
    do: {:insufficient_stock, move.variant_id}

  defp stock_error(reason, _move), do: reason

  # The cost of goods is known only after the ledger has consumed the layers,
  # so it is written back once the moves have been posted.
  #
  # `costs` is keyed by the line's index, and the sale items were inserted in
  # that same order, so zipping is what attributes each cost to the line that
  # caused it. Two lines of the same product keep separate costs, which matters
  # when the second one drew from an older and cheaper FIFO layer.
  defp apply_costs(%Sale{} = sale, items, costs) do
    written =
      items
      |> Enum.with_index()
      |> Enum.reduce_while({:ok, Money.zero(), []}, fn {item, index}, {:ok, running, acc} ->
        cost = Map.get(costs, index, Money.zero())

        case item |> Ecto.Changeset.change(cost_snapshot: cost) |> Repo.update() do
          {:ok, updated} -> {:cont, {:ok, Money.add(running, cost), [updated | acc]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)

    case written do
      {:ok, total, updated_items} ->
        with {:ok, costed} <- sale |> Ecto.Changeset.change(cost_total: total) |> Repo.update() do
          {:ok, costed, Enum.reverse(updated_items)}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  # ===========================================================================
  # Tenders, credit, ticket, audit
  # ===========================================================================

  defp insert_payments(%Sale{} = sale, %{tenders: tenders}) do
    inserted =
      Enum.reduce_while(tenders, {:ok, []}, fn tender, {:ok, acc} ->
        attrs = %{
          organization_id: sale.organization_id,
          business_id: sale.business_id,
          sale_id: sale.id,
          shift_id: sale.shift_id,
          method: tender.method,
          amount: tender.amount,
          tendered_amount: tender.tendered_amount,
          currency: sale.currency,
          reference: tender.reference,
          card_last_four: tender.card_last_four,
          card_scheme: tender.card_scheme,
          gateway_transaction_id: tender.gateway_transaction_id,
          status: "captured",
          occurred_at: sale.sold_at
        }

        case %Payment{} |> Payment.changeset(attrs) |> Repo.insert() do
          {:ok, payment} -> {:cont, {:ok, [payment | acc]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)

    case inserted do
      {:ok, payments} -> {:ok, Enum.reverse(payments)}
      {:error, reason} -> {:error, reason}
    end
  end

  # Paying on account moves no money. It settles the sale from the shop's point
  # of view and moves the debt to the ledger, under the customer's row lock so
  # two tills cannot both squeeze under the same credit limit.
  defp post_credit(%Scope{} = scope, request, %Sale{} = sale, %{tenders: tenders}) do
    amount = credit_total(tenders)

    if Money.zero?(amount) do
      :ok
    else
      case Customers.charge_credit(scope, request.customer_id, amount, %{
             kind: "sale",
             branch_id: sale.branch_id,
             reference_type: "sale",
             reference_id: sale.id,
             note: "Sale #{sale.number}",
             occurred_at: sale.sold_at
           }) do
        {:ok, _entry} -> :ok
        {:error, reason} -> {:error, reason}
      end
    end
  end

  # A ticket is finished when nothing is left unbilled. A table paying by cover
  # bills the same ticket several times, so the lines are marked off rather
  # than deleted — otherwise the record of what the table actually ate is lost.
  defp bill_order(%{order: nil}, _priced), do: :ok

  defp bill_order(%{order: %Order{} = order}, %{lines: lines}) do
    with :ok <- mark_order_lines(order, lines) do
      reloaded = Repo.preload(order, :items, force: true)

      if Order.fully_billed?(reloaded) do
        case reloaded |> Order.bill_changeset() |> Repo.update() do
          {:ok, _billed} -> :ok
          {:error, reason} -> {:error, reason}
        end
      else
        :ok
      end
    end
  end

  defp mark_order_lines(%Order{} = order, lines) do
    Enum.reduce_while(lines, :ok, fn priced, :ok ->
      case find_order_item(order, priced.line) do
        nil ->
          {:cont, :ok}

        item ->
          case item |> OrderItem.bill_changeset(priced.line.quantity) |> Repo.update() do
            {:ok, _updated} -> {:cont, :ok}
            {:error, reason} -> {:halt, {:error, reason}}
          end
      end
    end)
  end

  defp find_order_item(%Order{items: items}, line) when is_list(items) do
    Enum.find(items, fn item ->
      item.id == line.order_item_id or
        (is_nil(line.order_item_id) and item.variant_id == line.variant.id and
           not OrderItem.fully_billed?(item))
    end)
  end

  defp find_order_item(%Order{}, _line), do: nil

  defp log(%Scope{} = scope, %Sale{} = sale, %{lines: lines}, %{tenders: tenders}) do
    Audit.log(scope, "sale.completed", sale,
      entity_type: "sale",
      label: sale.number,
      summary:
        "#{length(lines)} line(s), #{Decimal.to_string(sale.total, :normal)} #{sale.currency}",
      metadata: %{
        "tenders" => Enum.map(tenders, &%{"method" => &1.method, "amount" => to_string(&1.amount)}),
        "customer_id" => sale.customer_id,
        "register_id" => sale.register_id
      }
    )
  end

  # Fired after the transaction commits, never inside it: a subscriber told
  # about a sale that then rolls back would be showing a sale that never
  # happened.
  defp broadcast(%Scope{} = scope, %Sale{} = sale) do
    Phoenix.PubSub.broadcast(
      Kaarobar.PubSub,
      "business:#{Scope.business_id(scope)}",
      {:sale_completed, %{sale_id: sale.id, branch_id: sale.branch_id, total: sale.total}}
    )

    :ok
  end

  # ===========================================================================
  # Small helpers
  # ===========================================================================

  defp line_name(%{variant: %ProductVariant{} = variant, product: product}) do
    cond do
      is_nil(product) -> variant.name || variant.sku || "Item"
      variant.is_default or is_nil(variant.name) -> product.name
      true -> "#{product.name} — #{variant.name}"
    end
  end

  defp unit_label(%Product{unit: %{code: code}}), do: code
  defp unit_label(_product), do: nil

  # `KaarobarWeb.Plugs.ValidateIdParams` catches malformed ids in the top level
  # of a request, but a basket carries its ids one level down, inside each
  # line. A non-uuid reaching `where id in ^ids` raises `Ecto.Query.CastError`
  # and the till gets a 500 for what is really "no such product".
  defp uuid?(value), do: is_binary(value) and Kaarobar.Ecto.UUIDv7.valid?(value)

  defp uuid_or_nil(value), do: if(uuid?(value), do: value)

  defp stringify(map) when is_map(map) and not is_struct(map) do
    Map.new(map, fn
      {key, value} when is_atom(key) -> {Atom.to_string(key), value}
      {key, value} -> {key, value}
    end)
  end

  defp stringify(other), do: other
end
