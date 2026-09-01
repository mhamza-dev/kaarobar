defmodule Kaarobar.Reports do
  @moduledoc """
  What the shop wants to know, answered fast enough to be worth asking.

  ## Closed days come from rollups, today comes from the tables

  `Kaarobar.Reports.Rollups` folds each finished day into one row per branch.
  Everything here that spans days reads those, and stitches today's figures on
  from the raw tables — because today is still moving, and a cached figure for
  a day the shop is still trading through is a wrong figure with a timestamp on
  it.

  That split is the whole performance story. A year of sales is 365 rollup rows
  per branch instead of every line the shop has ever sold, and the query plan
  does not change as the business grows.

  ## Every figure is derived, none is stored

  A profit number that could drift from the sales it summarises is a profit
  number nobody can defend to an accountant. Margin comes from the per-line
  cost snapshots taken at checkout, so last year's profit uses last year's
  costs however many times a supplier has repriced since.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Finance
  alias Kaarobar.Money
  alias Kaarobar.Reports.DailySalesRollup
  alias Kaarobar.Reports.ProductDailyRollup
  alias Kaarobar.Reports.Rollups
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Sales.Payment
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Sales.SaleItem
  alias Kaarobar.Scope

  @typedoc "A closed date range, inclusive at both ends."
  @type period :: {Date.t(), Date.t()}

  # ===========================================================================
  # The dashboard
  # ===========================================================================

  @doc """
  The headline figures for a period.

  One call, because a dashboard that fires eleven requests renders in eleven
  stages and the shopkeeper watches numbers appear one at a time.
  """
  @spec summary(Scope.t(), period(), keyword()) :: map()
  def summary(%Scope{} = scope, {from, to}, opts \\ []) do
    days = daily_series(scope, {from, to}, opts)

    totals =
      Enum.reduce(days, blank_totals(), fn day, acc ->
        %{
          sale_count: acc.sale_count + day.sale_count,
          voided_count: acc.voided_count + day.voided_count,
          gross_sales: Money.add(acc.gross_sales, day.gross_sales),
          discount_total: Money.add(acc.discount_total, day.discount_total),
          tax_total: Money.add(acc.tax_total, day.tax_total),
          net_sales: Money.add(acc.net_sales, day.net_sales),
          refund_total: Money.add(acc.refund_total, day.refund_total),
          cost_total: Money.add(acc.cost_total, day.cost_total)
        }
      end)

    gross_profit =
      totals.net_sales
      |> Money.sub(totals.refund_total)
      |> Money.sub(totals.cost_total)

    Map.merge(totals, %{
      from: from,
      to: to,
      gross_profit: gross_profit,
      average_sale: average(totals.net_sales, totals.sale_count),
      days: days
    })
  end

  @doc """
  One row per day: what was sold, discounted, taxed and refunded.

  Days with no trade are included as zeroes. A chart that silently skips a
  closed Sunday draws a line straight through it, which reads as a slow day
  rather than a shut one.
  """
  @spec daily_series(Scope.t(), period(), keyword()) :: [map()]
  def daily_series(%Scope{} = scope, {from, to}, opts \\ []) do
    branch_id = Keyword.get(opts, :branch_id)
    today = Rollups.business_today(scope.business)

    closed_to = earlier(to, Date.add(today, -1))

    rolled =
      if Date.compare(from, closed_to) == :gt,
        do: %{},
        else: rolled_days(scope, from, closed_to, branch_id)

    live =
      if Date.compare(today, from) != :lt and Date.compare(today, to) != :gt,
        do: live_day(scope, today, branch_id),
        else: nil

    from
    |> Date.range(to)
    |> Enum.map(fn day ->
      cond do
        live && Date.compare(day, today) == :eq -> live
        true -> Map.get(rolled, day, blank_day(day))
      end
    end)
  end

  @doc """
  What sold, best first.

  Reads the product rollups for closed days. Today is deliberately excluded:
  "the top ten this month" does not change meaningfully for the few hours
  between opening and now, and joining today's raw lines onto a year of rollups
  costs more than the accuracy is worth.
  """
  @spec top_products(Scope.t(), period(), keyword()) :: [map()]
  def top_products(%Scope{} = scope, {from, to}, opts \\ []) do
    ProductDailyRollup
    |> Scoped.for_business(scope)
    |> where([r], r.day >= ^from and r.day <= ^to)
    |> filter_branch(Keyword.get(opts, :branch_id))
    |> group_by([r], [r.variant_id, r.product_id])
    |> select([r], %{
      variant_id: r.variant_id,
      product_id: r.product_id,
      quantity: sum(r.quantity),
      refunded_quantity: sum(r.refunded_quantity),
      net_sales: sum(r.net_sales),
      cost_total: sum(r.cost_total)
    })
    |> order_by([r], desc: sum(r.net_sales))
    |> limit(^Keyword.get(opts, :limit, 10))
    |> Repo.all()
    |> Enum.map(&with_margin/1)
  end

  @doc "What sold, grouped by category rather than by product."
  @spec sales_by_category(Scope.t(), period(), keyword()) :: [map()]
  def sales_by_category(%Scope{} = scope, {from, to}, opts \\ []) do
    ProductDailyRollup
    |> Scoped.for_business(scope)
    |> where([r], r.day >= ^from and r.day <= ^to)
    |> filter_branch(Keyword.get(opts, :branch_id))
    |> group_by([r], r.category_id)
    |> select([r], %{
      category_id: r.category_id,
      quantity: sum(r.quantity),
      net_sales: sum(r.net_sales),
      cost_total: sum(r.cost_total)
    })
    |> order_by([r], desc: sum(r.net_sales))
    |> Repo.all()
    |> Enum.map(&with_margin/1)
  end

  @doc "Takings split by branch, so an owner can compare their shops."
  @spec sales_by_branch(Scope.t(), period()) :: [map()]
  def sales_by_branch(%Scope{} = scope, {from, to}) do
    DailySalesRollup
    |> Scoped.for_business(scope)
    |> where([r], r.day >= ^from and r.day <= ^to)
    |> group_by([r], r.branch_id)
    |> select([r], %{
      branch_id: r.branch_id,
      sale_count: sum(r.sale_count),
      net_sales: sum(r.net_sales),
      refund_total: sum(r.refund_total),
      cost_total: sum(r.cost_total)
    })
    |> order_by([r], desc: sum(r.net_sales))
    |> Repo.all()
  end

  @doc """
  How the money came in.

  Read from the payments themselves rather than from the rollup's tender map,
  because this is the report somebody opens when the drawer does not balance
  and they need the underlying rows to be the source.
  """
  @spec sales_by_tender(Scope.t(), period(), keyword()) :: [map()]
  def sales_by_tender(%Scope{} = scope, {from, to}, opts \\ []) do
    {starts_at, ends_at} = instant_bounds(scope, from, to)

    Payment
    |> join(:inner, [p], s in Sale, on: s.id == p.sale_id)
    |> where([p, s], s.business_id == ^Scope.business_id(scope))
    |> where([p, s], s.sold_at >= ^starts_at and s.sold_at < ^ends_at)
    |> where([p, s], s.status != "voided")
    |> filter_branch_join(Keyword.get(opts, :branch_id))
    |> group_by([p], p.method)
    |> select([p], %{method: p.method, total: sum(p.amount), count: count(p.id)})
    |> order_by([p], desc: sum(p.amount))
    |> Repo.all()
  end

  @doc """
  Who sold what.

  From the raw sales rather than a rollup: staff performance is asked for over
  weeks, not years, and a per-cashier rollup would be a third cache to keep
  honest for a report nobody runs over a decade.
  """
  @spec sales_by_cashier(Scope.t(), period(), keyword()) :: [map()]
  def sales_by_cashier(%Scope{} = scope, {from, to}, opts \\ []) do
    {starts_at, ends_at} = instant_bounds(scope, from, to)

    Sale
    |> Scoped.for_business(scope)
    |> where([s], s.sold_at >= ^starts_at and s.sold_at < ^ends_at and s.status != "voided")
    |> filter_branch(Keyword.get(opts, :branch_id))
    |> group_by([s], s.cashier_id)
    |> select([s], %{
      cashier_id: s.cashier_id,
      sale_count: count(s.id),
      net_sales: sum(s.total),
      discount_total: sum(s.discount_total)
    })
    |> order_by([s], desc: sum(s.total))
    |> Repo.all()
  end

  @doc """
  Takings by hour of the day, across the period.

  What staffing decisions are made from: a shop that is dead until four and
  three deep at seven should not have the same people on all day.
  """
  @spec sales_by_hour(Scope.t(), period(), keyword()) :: [map()]
  def sales_by_hour(%Scope{} = scope, {from, to}, opts \\ []) do
    {starts_at, ends_at} = instant_bounds(scope, from, to)
    zone = business_zone(scope)

    Sale
    |> Scoped.for_business(scope)
    |> where([s], s.sold_at >= ^starts_at and s.sold_at < ^ends_at and s.status != "voided")
    |> filter_branch(Keyword.get(opts, :branch_id))
    |> group_by([s], fragment("EXTRACT(HOUR FROM ? AT TIME ZONE ?)", s.sold_at, ^zone))
    |> select([s], %{
      hour: fragment("EXTRACT(HOUR FROM ? AT TIME ZONE ?)::int", s.sold_at, ^zone),
      sale_count: count(s.id),
      net_sales: sum(s.total)
    })
    |> order_by([s], asc: fragment("EXTRACT(HOUR FROM ? AT TIME ZONE ?)", s.sold_at, ^zone))
    |> Repo.all()
  end

  # ===========================================================================
  # Money in and out
  # ===========================================================================

  @doc """
  A profit and loss for the period.

  Gross profit is revenue less what the goods cost, from the per-line cost
  snapshots. Operating spend is subtracted after that, and cost-of-sales
  expenses are excluded from it — that money already arrived through the cost
  snapshots, and counting it again would take it off twice.
  """
  @spec profit_and_loss(Scope.t(), period()) :: map()
  def profit_and_loss(%Scope{} = scope, {from, to} = period) do
    sales = summary(scope, period)
    spend = Finance.spend_by_category(scope, from, to)
    operating = Finance.operating_spend(scope, from, to)

    %{
      from: from,
      to: to,
      revenue: Money.sub(sales.net_sales, sales.refund_total),
      cost_of_sales: sales.cost_total,
      gross_profit: sales.gross_profit,
      operating_expenses: operating,
      net_profit: Money.sub(sales.gross_profit, operating),
      tax_collected: sales.tax_total,
      expenses_by_category: spend
    }
  end

  @doc """
  Tax charged over the period, by rate.

  From the per-line tax snapshots, which is what was actually charged — not
  what today's tax table would produce for the same basket.
  """
  @spec tax_report(Scope.t(), period(), keyword()) :: [map()]
  def tax_report(%Scope{} = scope, {from, to}, opts \\ []) do
    {starts_at, ends_at} = instant_bounds(scope, from, to)

    Kaarobar.Sales.SaleItemTax
    |> join(:inner, [t], i in SaleItem, on: i.id == t.sale_item_id)
    |> join(:inner, [t, i], s in Sale, on: s.id == i.sale_id)
    |> where([t, i, s], s.business_id == ^Scope.business_id(scope))
    |> where([t, i, s], s.sold_at >= ^starts_at and s.sold_at < ^ends_at)
    |> where([t, i, s], s.status != "voided")
    |> filter_branch_join(Keyword.get(opts, :branch_id), 2)
    |> group_by([t], [t.name_snapshot, t.label_snapshot, t.rate_snapshot])
    |> select([t], %{
      name: t.name_snapshot,
      label: t.label_snapshot,
      rate: t.rate_snapshot,
      # Derived from the tax and its own rate rather than summed off the line.
      # A line carrying two taxes has one net total between them, and adding
      # that whole figure to both rates would report a taxable base larger than
      # the shop's turnover. `NULLIF` leaves a zero-rated group's base null,
      # which is honest: there is no base to divide by.
      taxable_total: sum(fragment("? / NULLIF(?, 0)", t.amount, t.rate_snapshot)),
      tax_total: sum(t.amount)
    })
    |> order_by([t], desc: sum(t.amount))
    |> Repo.all()
  end

  # ===========================================================================
  # Internals
  # ===========================================================================

  defp rolled_days(%Scope{} = scope, from, to, branch_id) do
    DailySalesRollup
    |> Scoped.for_business(scope)
    |> where([r], r.day >= ^from and r.day <= ^to)
    |> filter_branch(branch_id)
    |> group_by([r], r.day)
    |> select([r], %{
      day: r.day,
      sale_count: sum(r.sale_count),
      voided_count: sum(r.voided_count),
      gross_sales: sum(r.gross_sales),
      discount_total: sum(r.discount_total),
      tax_total: sum(r.tax_total),
      net_sales: sum(r.net_sales),
      refund_total: sum(r.refund_total),
      cost_total: sum(r.cost_total)
    })
    |> Repo.all()
    |> Map.new(fn row -> {row.day, normalise_day(row)} end)
  end

  # Today, added up live. The same shape as a rollup row so the caller cannot
  # tell which of the two it is looking at.
  defp live_day(%Scope{} = scope, day, branch_id) do
    {starts_at, ends_at} = Rollups.day_bounds(scope.business, day)

    row =
      Sale
      |> Scoped.for_business(scope)
      |> where([s], s.sold_at >= ^starts_at and s.sold_at < ^ends_at)
      |> filter_branch(branch_id)
      |> select([s], %{
        sale_count: count(fragment("CASE WHEN ? <> 'voided' THEN 1 END", s.status)),
        voided_count: count(fragment("CASE WHEN ? = 'voided' THEN 1 END", s.status)),
        gross_sales:
          sum(fragment("CASE WHEN ? <> 'voided' THEN ? ELSE 0 END", s.status, s.subtotal)),
        discount_total:
          sum(
            fragment(
              "CASE WHEN ? <> 'voided' THEN ? + ? ELSE 0 END",
              s.status,
              s.discount_total,
              s.order_discount
            )
          ),
        tax_total:
          sum(fragment("CASE WHEN ? <> 'voided' THEN ? ELSE 0 END", s.status, s.tax_total)),
        net_sales: sum(fragment("CASE WHEN ? <> 'voided' THEN ? ELSE 0 END", s.status, s.total)),
        refund_total:
          sum(fragment("CASE WHEN ? <> 'voided' THEN ? ELSE 0 END", s.status, s.refunded_total)),
        cost_total:
          sum(fragment("CASE WHEN ? <> 'voided' THEN ? ELSE 0 END", s.status, s.cost_total))
      })
      |> Repo.one()

    normalise_day(Map.put(row || %{}, :day, day))
  end

  defp normalise_day(row) do
    %{
      day: row.day,
      sale_count: row[:sale_count] || 0,
      voided_count: row[:voided_count] || 0,
      gross_sales: money(row[:gross_sales]),
      discount_total: money(row[:discount_total]),
      tax_total: money(row[:tax_total]),
      net_sales: money(row[:net_sales]),
      refund_total: money(row[:refund_total]),
      cost_total: money(row[:cost_total])
    }
  end

  defp blank_day(day), do: normalise_day(%{day: day})

  defp blank_totals do
    %{
      sale_count: 0,
      voided_count: 0,
      gross_sales: Money.zero(),
      discount_total: Money.zero(),
      tax_total: Money.zero(),
      net_sales: Money.zero(),
      refund_total: Money.zero(),
      cost_total: Money.zero()
    }
  end

  defp with_margin(row) do
    Map.put(row, :margin, Money.sub(money(row[:net_sales]), money(row[:cost_total])))
  end

  defp instant_bounds(%Scope{} = scope, from, to) do
    {starts_at, _} = Rollups.day_bounds(scope.business, from)
    {_, ends_at} = Rollups.day_bounds(scope.business, to)
    {starts_at, ends_at}
  end

  defp business_zone(%Scope{business: %{timezone: zone}})
       when is_binary(zone) and zone not in ["", "UTC"],
       do: zone

  defp business_zone(%Scope{}), do: "Etc/UTC"

  defp filter_branch(query, nil), do: query
  defp filter_branch(query, branch_id), do: where(query, [row], row.branch_id == ^branch_id)

  defp filter_branch_join(query, branch_id, position \\ 1)
  defp filter_branch_join(query, nil, _position), do: query

  defp filter_branch_join(query, branch_id, 1),
    do: where(query, [_first, s], s.branch_id == ^branch_id)

  defp filter_branch_join(query, branch_id, 2),
    do: where(query, [_first, _second, s], s.branch_id == ^branch_id)

  defp earlier(a, b), do: if(Date.compare(a, b) == :lt, do: a, else: b)

  defp average(_total, 0), do: Money.zero()
  defp average(total, count), do: total |> Money.div(count) |> Money.round()

  defp money(nil), do: Money.zero()
  defp money(%Decimal{} = value), do: value
  defp money(value), do: Money.to_decimal(value)
end
