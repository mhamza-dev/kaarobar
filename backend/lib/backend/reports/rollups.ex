defmodule Kaarobar.Reports.Rollups do
  @moduledoc """
  Folding a finished trading day into one row, so a dashboard never reads a
  year of sale lines to answer "how did last month go?".

  ## A rollup is a cache, not a record

  Every figure here is derived, and `rebuild/3` recomputes any day from the raw
  tables. That is what makes it safe to be wrong: a sale voided a week late, a
  refund processed against last Tuesday, a migration that changes how cost is
  snapshotted — all of them are fixed by rebuilding the affected days rather
  than by patching a total in place.

  ## Only finished days

  A day is rolled up once it is over in the **business's own timezone**. Rolling
  up the current day would cache a figure that goes stale while the shop keeps
  trading, and a dashboard reporting this morning's takings as final is worse
  than one that takes a moment to add them up live.

  That is also why the reader in `Kaarobar.Reports` reads rollups for closed
  days and the raw tables for today, and stitches the two.

  ## Timezones are the whole difficulty

  A shop in Karachi closes at midnight Karachi time, not midnight UTC. Rolling
  up on UTC boundaries would split the evening's takings across two days for
  every shop east or west of Greenwich, and no shopkeeper would recognise the
  numbers. Every boundary here is computed in the business's timezone and then
  converted, once, to the instants the query needs.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Reports.DailySalesRollup
  alias Kaarobar.Reports.ProductDailyRollup
  alias Kaarobar.Repo
  alias Kaarobar.Sales.Payment
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Sales.SaleItem
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business

  require Logger

  @doc """
  Rebuilds every rollup for one business over a range of days.

  Idempotent: run it twice and the second run writes the same numbers. That is
  the property that makes it safe to schedule *and* safe to trigger by hand
  when somebody suspects a total is wrong.
  """
  @spec rebuild(Business.t(), Date.t(), Date.t()) :: {:ok, non_neg_integer()} | {:error, term()}
  def rebuild(%Business{} = business, from, to) do
    if Date.compare(from, to) == :gt do
      {:error, :invalid_range}
    else
      branches = branch_ids(business.id)
      days = Date.range(from, to)

      count =
        for branch_id <- branches, day <- days, reduce: 0 do
          acc ->
            rebuild_day(business, branch_id, day)
            acc + 1
        end

      {:ok, count}
    end
  end

  @doc """
  Rolls up every day that has closed and has not been rolled up yet.

  What the scheduled job calls. Looks back a few days rather than only at
  yesterday, so a void or a late refund against an earlier day is picked up
  without anybody noticing it needed to be.
  """
  @spec catch_up(Business.t(), non_neg_integer()) :: {:ok, non_neg_integer()}
  def catch_up(%Business{} = business, lookback_days \\ 3) do
    case last_closed_day(business) do
      nil ->
        {:ok, 0}

      last_day ->
        from = Date.add(last_day, -lookback_days)
        rebuild(business, from, last_day)
    end
  end

  @doc """
  The most recent day that is fully over where the shop is.

  `nil` when the business's clock has not yet reached the end of any day, which
  only happens for a business created today in a timezone ahead of UTC.
  """
  @spec last_closed_day(Business.t()) :: Date.t() | nil
  def last_closed_day(%Business{} = business) do
    today = business_today(business)
    yesterday = Date.add(today, -1)

    if Date.compare(yesterday, ~D[2000-01-01]) == :gt, do: yesterday
  end

  @doc "Today's date where the shop is, not where the server is."
  @spec business_today(Business.t()) :: Date.t()
  def business_today(%Business{} = business) do
    DateTime.utc_now()
    |> shift_zone(timezone(business))
    |> DateTime.to_date()
  end

  @doc """
  The half-open instant range covering one local day.

  Half-open — `[start, next_start)` — because a sale at exactly midnight
  belongs to the day that is starting, and a closed range would put it in both.
  """
  @spec day_bounds(Business.t(), Date.t()) :: {DateTime.t(), DateTime.t()}
  def day_bounds(%Business{} = business, %Date{} = day) do
    zone = timezone(business)
    {to_utc(day, zone), to_utc(Date.add(day, 1), zone)}
  end

  # ===========================================================================
  # Building one day
  # ===========================================================================

  defp rebuild_day(%Business{} = business, branch_id, day) do
    {starts_at, ends_at} = day_bounds(business, day)

    Repo.transaction(fn ->
      totals = sale_totals(business.id, branch_id, starts_at, ends_at)
      tenders = tender_totals(business.id, branch_id, starts_at, ends_at)

      upsert_daily(business, branch_id, day, Map.put(totals, :tender_totals, tenders))
      upsert_products(business, branch_id, day, starts_at, ends_at)
    end)
  end

  # A voided sale is counted separately rather than excluded silently: "eleven
  # sales, two of them voided" is a fact a shopkeeper wants, and a day whose
  # count quietly drops by two looks like data loss.
  defp sale_totals(business_id, branch_id, starts_at, ends_at) do
    row =
      Sale
      |> where([s], s.business_id == ^business_id and s.branch_id == ^branch_id)
      |> where([s], s.sold_at >= ^starts_at and s.sold_at < ^ends_at)
      |> select([s], %{
        sale_count: count(fragment("CASE WHEN ? <> 'voided' THEN 1 END", s.status)),
        voided_count: count(fragment("CASE WHEN ? = 'voided' THEN 1 END", s.status)),
        customer_count:
          count(
            fragment("DISTINCT CASE WHEN ? <> 'voided' THEN ? END", s.status, s.customer_id)
          ),
        gross_sales: sum(fragment("CASE WHEN ? <> 'voided' THEN ? ELSE 0 END", s.status, s.subtotal)),
        discount_total:
          sum(
            fragment(
              "CASE WHEN ? <> 'voided' THEN ? + ? ELSE 0 END",
              s.status,
              s.discount_total,
              s.order_discount
            )
          ),
        tax_total: sum(fragment("CASE WHEN ? <> 'voided' THEN ? ELSE 0 END", s.status, s.tax_total)),
        net_sales: sum(fragment("CASE WHEN ? <> 'voided' THEN ? ELSE 0 END", s.status, s.total)),
        refund_total:
          sum(fragment("CASE WHEN ? <> 'voided' THEN ? ELSE 0 END", s.status, s.refunded_total)),
        cost_total:
          sum(fragment("CASE WHEN ? <> 'voided' THEN ? ELSE 0 END", s.status, s.cost_total))
      })
      |> Repo.one()

    items =
      SaleItem
      |> join(:inner, [i], s in Sale, on: s.id == i.sale_id)
      |> where([i, s], s.business_id == ^business_id and s.branch_id == ^branch_id)
      |> where([i, s], s.sold_at >= ^starts_at and s.sold_at < ^ends_at and s.status != "voided")
      |> select([i], sum(i.quantity))
      |> Repo.one()

    row
    |> Map.new(fn {key, value} -> {key, value || zero_for(key)} end)
    |> Map.put(:item_count, items || Decimal.new(0))
  end

  # A map rather than a column per method: a business can start taking a wallet
  # next year, and a schema change per payment method is a schema change per
  # business decision.
  defp tender_totals(business_id, branch_id, starts_at, ends_at) do
    Payment
    |> join(:inner, [p], s in Sale, on: s.id == p.sale_id)
    |> where([p, s], s.business_id == ^business_id and s.branch_id == ^branch_id)
    |> where([p, s], s.sold_at >= ^starts_at and s.sold_at < ^ends_at and s.status != "voided")
    |> group_by([p], p.method)
    |> select([p], {p.method, sum(p.amount)})
    |> Repo.all()
    |> Map.new(fn {method, total} -> {method, Decimal.to_string(total || Decimal.new(0), :normal)} end)
  end

  defp upsert_daily(%Business{} = business, branch_id, day, totals) do
    attrs =
      totals
      |> Map.merge(%{
        organization_id: business.organization_id,
        business_id: business.id,
        branch_id: branch_id,
        day: day
      })

    existing =
      Repo.get_by(DailySalesRollup, branch_id: branch_id, day: day) || %DailySalesRollup{}

    existing
    |> DailySalesRollup.changeset(attrs)
    |> Repo.insert_or_update!()
  end

  # Every variant sold that day, written in one pass. The previous day's rows
  # are deleted first rather than merged: a line removed by a void has to
  # disappear, and an upsert-only rebuild would leave it behind forever.
  defp upsert_products(%Business{} = business, branch_id, day, starts_at, ends_at) do
    ProductDailyRollup
    |> where([r], r.branch_id == ^branch_id and r.day == ^day)
    |> Repo.delete_all()

    rows =
      SaleItem
      |> join(:inner, [i], s in Sale, on: s.id == i.sale_id)
      |> where([i, s], s.business_id == ^business_id and s.branch_id == ^branch_id)
      |> where([i, s], s.sold_at >= ^starts_at and s.sold_at < ^ends_at and s.status != "voided")
      |> group_by([i], [i.variant_id, i.product_id])
      |> select([i], %{
        variant_id: i.variant_id,
        product_id: i.product_id,
        quantity: sum(i.quantity),
        refunded_quantity: sum(i.refunded_quantity),
        net_sales: sum(i.line_total),
        discount_total: sum(i.discount_total),
        cost_total: sum(fragment("? * ?", i.cost_snapshot, i.quantity))
      })
      |> Repo.all()

    categories = category_ids(Enum.map(rows, & &1.product_id))

    Enum.each(rows, fn row ->
      %ProductDailyRollup{}
      |> ProductDailyRollup.changeset(
        Map.merge(row, %{
          organization_id: business.organization_id,
          business_id: business.id,
          branch_id: branch_id,
          day: day,
          category_id: Map.get(categories, row.product_id)
        })
      )
      |> Repo.insert!()
    end)
  end

  # ===========================================================================
  # Internals
  # ===========================================================================

  defp category_ids([]), do: %{}

  defp category_ids(product_ids) do
    ids = product_ids |> Enum.reject(&is_nil/1) |> Enum.uniq()

    if ids == [] do
      %{}
    else
      from(p in Kaarobar.Catalog.Product,
        where: p.id in ^ids,
        select: {p.id, p.category_id}
      )
      |> Repo.all()
      |> Map.new()
    end
  end

  defp branch_ids(business_id) do
    Branch
    |> where([b], b.business_id == ^business_id and is_nil(b.deleted_at))
    |> select([b], b.id)
    |> Repo.all()
  end

  # "UTC" is what a business is created with, but Elixir's built-in database
  # only answers to "Etc/UTC" — left alone, every shop on the default would take
  # the fallback path below and log a warning on every nightly run.
  defp timezone(%Business{timezone: zone}) when zone in [nil, "", "UTC"], do: "Etc/UTC"
  defp timezone(%Business{timezone: zone}) when is_binary(zone), do: zone
  defp timezone(%Business{}), do: "Etc/UTC"

  # Elixir ships without a timezone database unless one is configured. Falling
  # back to UTC keeps every shop reporting *something* correct-shaped rather
  # than crashing the nightly job, and the log line says which shop is affected
  # so it can be fixed rather than silently tolerated.
  defp shift_zone(%DateTime{} = at, zone) do
    case DateTime.shift_zone(at, zone) do
      {:ok, shifted} ->
        shifted

      {:error, _reason} ->
        warn_zone(zone)
        at
    end
  end

  defp to_utc(%Date{} = day, zone) do
    naive = NaiveDateTime.new!(day, ~T[00:00:00.000000])

    case DateTime.from_naive(naive, zone) do
      {:ok, at} ->
        DateTime.shift_zone!(at, "Etc/UTC")

      {:ambiguous, first, _second} ->
        # The hour a clock goes back happens twice. The earlier instant is the
        # one a shop would call the start of the day.
        DateTime.shift_zone!(first, "Etc/UTC")

      {:gap, _before, after_gap} ->
        # The hour a clock goes forward does not exist. The day starts when it
        # resumes.
        DateTime.shift_zone!(after_gap, "Etc/UTC")

      {:error, _reason} ->
        warn_zone(zone)
        DateTime.from_naive!(naive, "Etc/UTC")
    end
  end

  defp warn_zone(zone) do
    Logger.warning(
      "no timezone data for #{inspect(zone)}; rolling up on UTC boundaries instead. " <>
        "Configure a timezone database (see Elixir's Calendar.TimeZoneDatabase)."
    )
  end

  defp zero_for(:sale_count), do: 0
  defp zero_for(:voided_count), do: 0
  defp zero_for(:customer_count), do: 0
  defp zero_for(_money), do: Decimal.new(0)
end
