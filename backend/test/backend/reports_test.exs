defmodule Kaarobar.ReportsTest do
  @moduledoc """
  The phase gate: dashboards that stay fast, an X/Z report that matches the
  shift, and a P&L that reconciles against the ledgers.

  The figures worth protecting hardest are the ones that could double-count.
  A rollup that disagrees with the sales it summarises, or a profit that
  subtracts the same money twice, is a number the shopkeeper takes to their
  accountant and cannot defend.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Finance
  alias Kaarobar.Reports
  alias Kaarobar.Reports.DailySalesRollup
  alias Kaarobar.Reports.Rollups
  alias Kaarobar.Repo

  setup do
    %{scope: scope, branch: branch} = owner_scope()
    variant = variant_fixture(scope, %{"name" => "Widget", "price" => "100.00"})
    stock_fixture(scope, variant, "500", unit_cost: "60.00")
    %{register: register} = open_till(scope)

    %{scope: scope, branch: branch, variant: variant, register: register}
  end

  defp yesterday(scope), do: Date.add(Rollups.business_today(scope.business), -1)

  # Moves a sale into a day that has closed, so it can be rolled up. Rolling up
  # today is deliberately impossible — that is the behaviour under test
  # elsewhere — so a test about rollups has to backdate.
  defp backdate(sale, %Date{} = day) do
    {starts_at, _ends} = Rollups.day_bounds(sale.business_id |> business(), day)

    sale
    |> Ecto.Changeset.change(sold_at: DateTime.add(starts_at, 3600 * 10, :second))
    |> Repo.update!()
  end

  defp business(id), do: Repo.get!(Kaarobar.Tenancy.Business, id)

  # ===========================================================================
  # Rollups
  # ===========================================================================

  describe "rollups" do
    test "fold a closed day into one row per branch", ctx do
      day = yesterday(ctx.scope)
      sale_fixture(ctx.scope, ctx.variant, amount: "100.00") |> backdate(day)
      sale_fixture(ctx.scope, ctx.variant, amount: "100.00") |> backdate(day)

      {:ok, _count} = Rollups.rebuild(ctx.scope.business, day, day)

      rollup = Repo.get_by!(DailySalesRollup, branch_id: ctx.branch.id, day: day)

      assert rollup.sale_count == 2
      assert Decimal.equal?(rollup.net_sales, Decimal.new("200.00"))
      assert Decimal.equal?(rollup.cost_total, Decimal.new("120.0000"))
    end

    test "are idempotent — rebuilding writes the same numbers", ctx do
      day = yesterday(ctx.scope)
      sale_fixture(ctx.scope, ctx.variant, amount: "100.00") |> backdate(day)

      {:ok, _} = Rollups.rebuild(ctx.scope.business, day, day)
      first = Repo.get_by!(DailySalesRollup, branch_id: ctx.branch.id, day: day)

      {:ok, _} = Rollups.rebuild(ctx.scope.business, day, day)
      second = Repo.get_by!(DailySalesRollup, branch_id: ctx.branch.id, day: day)

      # The property that makes it safe to schedule *and* safe to run by hand
      # when somebody suspects a total is wrong.
      assert first.id == second.id
      assert Decimal.equal?(first.net_sales, second.net_sales)
      assert first.sale_count == second.sale_count
    end

    test "count a voided sale separately rather than dropping it", ctx do
      day = yesterday(ctx.scope)
      sale = sale_fixture(ctx.scope, ctx.variant, amount: "100.00") |> backdate(day)
      {:ok, _voided} = Kaarobar.Sales.void_sale(ctx.scope, sale, "wrong item")

      {:ok, _} = Rollups.rebuild(ctx.scope.business, day, day)
      rollup = Repo.get_by!(DailySalesRollup, branch_id: ctx.branch.id, day: day)

      # "Eleven sales, two of them voided" is a fact a shopkeeper wants. A day
      # whose count quietly drops looks like data loss.
      assert rollup.sale_count == 0
      assert rollup.voided_count == 1
      assert Decimal.equal?(rollup.net_sales, Decimal.new(0))
    end

    test "a rebuild picks up a sale voided after the fact", ctx do
      day = yesterday(ctx.scope)
      sale = sale_fixture(ctx.scope, ctx.variant, amount: "100.00") |> backdate(day)

      {:ok, _} = Rollups.rebuild(ctx.scope.business, day, day)
      assert Repo.get_by!(DailySalesRollup, branch_id: ctx.branch.id, day: day).sale_count == 1

      {:ok, _voided} = Kaarobar.Sales.void_sale(ctx.scope, sale, "returned")
      {:ok, _} = Rollups.rebuild(ctx.scope.business, day, day)

      # This is why a rollup is a cache with a rebuild button rather than a
      # record: nothing told it the void happened, and it does not need to be
      # told.
      assert Repo.get_by!(DailySalesRollup, branch_id: ctx.branch.id, day: day).sale_count == 0
    end

    test "the tender split is recorded", ctx do
      day = yesterday(ctx.scope)
      sale_fixture(ctx.scope, ctx.variant, amount: "100.00", method: "cash") |> backdate(day)

      {:ok, _} = Rollups.rebuild(ctx.scope.business, day, day)
      rollup = Repo.get_by!(DailySalesRollup, branch_id: ctx.branch.id, day: day)

      assert Map.has_key?(rollup.tender_totals, "cash")
    end

    test "an inverted range is refused rather than silently reversed", ctx do
      today = Rollups.business_today(ctx.scope.business)

      assert {:error, :invalid_range} =
               Rollups.rebuild(ctx.scope.business, today, Date.add(today, -5))
    end

    test "a day's bounds are half-open", ctx do
      day = ~D[2026-03-15]
      {starts_at, ends_at} = Rollups.day_bounds(ctx.scope.business, day)

      # A sale at exactly midnight belongs to the day that is starting. A
      # closed range would put it in both.
      assert DateTime.compare(starts_at, ends_at) == :lt
      assert DateTime.diff(ends_at, starts_at, :hour) == 24
    end
  end

  # ===========================================================================
  # Reading
  # ===========================================================================

  describe "the daily series" do
    test "includes days with no trade as zeroes", ctx do
      today = Rollups.business_today(ctx.scope.business)
      from = Date.add(today, -6)

      days = Reports.daily_series(ctx.scope, {from, today})

      # A chart that skips a closed Sunday draws a line straight through it,
      # which reads as a slow day rather than a shut one.
      assert length(days) == 7
      assert Enum.all?(days, &Map.has_key?(&1, :net_sales))
    end

    test "reads today live rather than from a rollup", ctx do
      today = Rollups.business_today(ctx.scope.business)
      sale_fixture(ctx.scope, ctx.variant, amount: "100.00")

      [day] = Reports.daily_series(ctx.scope, {today, today})

      # Nothing has rolled up today — it is not over — so this figure can only
      # have come from the sales themselves.
      assert day.sale_count == 1
      assert Decimal.equal?(day.net_sales, Decimal.new("100.00"))
    end

    test "stitches closed days onto today", ctx do
      today = Rollups.business_today(ctx.scope.business)
      day = Date.add(today, -1)

      sale_fixture(ctx.scope, ctx.variant, amount: "100.00") |> backdate(day)
      {:ok, _} = Rollups.rebuild(ctx.scope.business, day, day)
      sale_fixture(ctx.scope, ctx.variant, amount: "250.00")

      summary = Reports.summary(ctx.scope, {day, today})

      assert summary.sale_count == 2
      assert Decimal.equal?(summary.net_sales, Decimal.new("350.00"))
    end
  end

  describe "the summary" do
    test "gross profit is revenue less what the goods cost", ctx do
      sale_fixture(ctx.scope, ctx.variant, quantity: "2", amount: "200.00")
      today = Rollups.business_today(ctx.scope.business)

      summary = Reports.summary(ctx.scope, {today, today})

      # Two units at 100, costing 60 each.
      assert Decimal.equal?(summary.cost_total, Decimal.new("120.0000"))
      assert Decimal.equal?(summary.gross_profit, Decimal.new("80.0000"))
    end

    test "the average is zero on a day with no sales, not a division error", ctx do
      today = Rollups.business_today(ctx.scope.business)

      assert Decimal.equal?(Reports.summary(ctx.scope, {today, today}).average_sale, Decimal.new(0))
    end
  end

  # ===========================================================================
  # Profit and loss
  # ===========================================================================

  describe "profit and loss" do
    setup ctx do
      {:ok, operating} =
        Finance.create_category(ctx.scope, %{"name" => "Rent", "kind" => "operating"})

      {:ok, stock} =
        Finance.create_category(ctx.scope, %{"name" => "Stock", "kind" => "cost_of_sales"})

      %{operating: operating, stock: stock}
    end

    test "subtracts operating spend from gross profit", ctx do
      sale_fixture(ctx.scope, ctx.variant, quantity: "2", amount: "200.00")

      {:ok, _expense} =
        Finance.create_expense(ctx.scope, %{
          "expense_category_id" => ctx.operating.id,
          "description" => "March rent",
          "amount" => "30.00"
        })

      today = Rollups.business_today(ctx.scope.business)
      pl = Reports.profit_and_loss(ctx.scope, {today, today})

      assert Decimal.equal?(pl.gross_profit, Decimal.new("80.0000"))
      assert Decimal.equal?(pl.operating_expenses, Decimal.new("30.00"))
      assert Decimal.equal?(pl.net_profit, Decimal.new("50.0000"))
    end

    test "does not subtract cost-of-sales twice", ctx do
      sale_fixture(ctx.scope, ctx.variant, quantity: "2", amount: "200.00")

      # The stock this sale consumed already reached the profit line through
      # each line's cost snapshot. Counting the purchase as an expense too
      # would take the same money off twice and report a loss on a sale that
      # made money.
      {:ok, _expense} =
        Finance.create_expense(ctx.scope, %{
          "expense_category_id" => ctx.stock.id,
          "description" => "Widget purchase",
          "amount" => "120.00"
        })

      today = Rollups.business_today(ctx.scope.business)
      pl = Reports.profit_and_loss(ctx.scope, {today, today})

      assert Decimal.equal?(pl.operating_expenses, Decimal.new(0))
      assert Decimal.equal?(pl.net_profit, Decimal.new("80.0000"))
    end

    test "lists every category, including the ones it does not subtract", ctx do
      {:ok, _expense} =
        Finance.create_expense(ctx.scope, %{
          "expense_category_id" => ctx.stock.id,
          "description" => "Widget purchase",
          "amount" => "120.00"
        })

      today = Rollups.business_today(ctx.scope.business)
      pl = Reports.profit_and_loss(ctx.scope, {today, today})

      # Excluded from the total, still shown. A figure that vanishes entirely
      # is one the shopkeeper thinks was lost.
      assert [row] = pl.expenses_by_category
      assert row.kind == "cost_of_sales"
    end
  end

  # ===========================================================================
  # Isolation
  # ===========================================================================

  describe "tenancy" do
    test "one business's figures are not another's", ctx do
      sale_fixture(ctx.scope, ctx.variant, amount: "100.00")
      %{scope: other} = owner_scope()

      today = Rollups.business_today(other.business)
      summary = Reports.summary(other, {today, today})

      assert summary.sale_count == 0
      assert Decimal.equal?(summary.net_sales, Decimal.new(0))
    end
  end
end
