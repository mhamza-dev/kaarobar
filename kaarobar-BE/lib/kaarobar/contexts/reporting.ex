defmodule Kaarobar.Reporting do
  @moduledoc """
  Owner and branch operational reports (RPT-FR-001/002).
  Financial statements live in `Kaarobar.Accounting`.
  """

  import Ecto.Query
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{Sale, InventoryRecord, SaleReturn, Business, Branch, Product}

  defp day_range(%Date{} = day) do
    start_at = DateTime.new!(day, ~T[00:00:00], "Etc/UTC")
    end_at = DateTime.new!(Date.add(day, 1), ~T[00:00:00], "Etc/UTC")
    {start_at, end_at}
  end

  defp period_range(%Date{} = from_date, %Date{} = to_date) do
    start_at = DateTime.new!(from_date, ~T[00:00:00], "Etc/UTC")
    end_at = DateTime.new!(Date.add(to_date, 1), ~T[00:00:00], "Etc/UTC")
    {start_at, end_at}
  end

  def owner_dashboard(owner_id) do
    today = Date.utc_today()
    {day_start, day_end} = day_range(today)

    sales_today =
      from(s in Sale,
        where:
          s.owner_id == ^owner_id and s.status == "Completed" and
            s.inserted_at >= ^day_start and s.inserted_at < ^day_end,
        select: coalesce(sum(s.total_amount), 0)
      )
      |> Repo.one()

    cash_position =
      from(s in Sale,
        where:
          s.owner_id == ^owner_id and s.status == "Completed" and
            s.inserted_at >= ^day_start and s.inserted_at < ^day_end,
        select: coalesce(sum(s.total_amount), 0)
      )
      |> Repo.one()

    low_stock_count =
      from(i in InventoryRecord,
        where: i.owner_id == ^owner_id and i.quantity_on_hand <= 5,
        select: count(i.id)
      )
      |> Repo.one()

    pending_approvals =
      from(r in SaleReturn,
        where: r.owner_id == ^owner_id and r.status == "PendingApproval",
        select: count(r.id)
      )
      |> Repo.one()

    businesses =
      from(b in Business, where: b.owner_id == ^owner_id, select: count(b.id)) |> Repo.one()

    branches =
      from(b in Branch, where: b.owner_id == ^owner_id, select: count(b.id)) |> Repo.one()

    %{
      sales_today: to_string(sales_today || 0),
      cash_position: to_string(cash_position || 0),
      low_stock_count: low_stock_count || 0,
      pending_approvals: pending_approvals || 0,
      businesses: businesses || 0,
      branches: branches || 0
    }
  end

  def branch_dashboard(owner_id, business_id, branch_id) do
    today = Date.utc_today()
    {day_start, day_end} = day_range(today)

    sales_today =
      from(s in Sale,
        where:
          s.owner_id == ^owner_id and s.business_id == ^business_id and s.branch_id == ^branch_id and
            s.status == "Completed" and s.inserted_at >= ^day_start and s.inserted_at < ^day_end,
        select: coalesce(sum(s.total_amount), 0)
      )
      |> Repo.one()

    sales_count_today =
      from(s in Sale,
        where:
          s.owner_id == ^owner_id and s.business_id == ^business_id and s.branch_id == ^branch_id and
            s.status == "Completed" and s.inserted_at >= ^day_start and s.inserted_at < ^day_end,
        select: count(s.id)
      )
      |> Repo.one()

    low_stock =
      from(i in InventoryRecord,
        where:
          i.owner_id == ^owner_id and i.business_id == ^business_id and i.branch_id == ^branch_id and
            i.quantity_on_hand <= 5,
        select: count(i.id)
      )
      |> Repo.one()

    pending_returns =
      from(r in SaleReturn,
        where:
          r.owner_id == ^owner_id and r.business_id == ^business_id and r.branch_id == ^branch_id and
            r.status == "PendingApproval",
        select: count(r.id)
      )
      |> Repo.one()

    %{
      branch_id: branch_id,
      sales_today: to_string(sales_today || 0),
      sales_count_today: sales_count_today || 0,
      low_stock_count: low_stock || 0,
      pending_returns: pending_returns || 0
    }
  end

  def sales_by_day(owner_id, business_id, from_date, to_date, opts \\ []) do
    branch_id = Keyword.get(opts, :branch_id)
    {start_at, end_at} = period_range(from_date, to_date)

    q =
      from(s in Sale,
        where:
          s.owner_id == ^owner_id and s.business_id == ^business_id and s.status == "Completed" and
            s.inserted_at >= ^start_at and s.inserted_at < ^end_at,
        group_by: fragment("((? AT TIME ZONE 'UTC')::date)", s.inserted_at),
        order_by: fragment("((? AT TIME ZONE 'UTC')::date)", s.inserted_at),
        select: %{
          date: fragment("((? AT TIME ZONE 'UTC')::date)", s.inserted_at),
          total: coalesce(sum(s.total_amount), 0),
          count: count(s.id)
        }
      )

    q = if branch_id, do: where(q, [s], s.branch_id == ^branch_id), else: q

    Repo.all(q)
    |> Enum.map(fn row ->
      %{
        date: row.date,
        total: to_string(row.total || 0),
        count: row.count || 0
      }
    end)
  end

  def low_stock(owner_id, business_id, opts \\ []) do
    branch_id = Keyword.get(opts, :branch_id)
    threshold = Keyword.get(opts, :threshold, 5)

    q =
      from(i in InventoryRecord,
        join: p in Product,
        on: p.id == i.product_id,
        where:
          i.owner_id == ^owner_id and i.business_id == ^business_id and
            i.quantity_on_hand <= ^threshold,
        order_by: [asc: i.quantity_on_hand],
        select: %{
          product_id: p.id,
          sku: p.sku,
          name: p.name,
          branch_id: i.branch_id,
          quantity_on_hand: i.quantity_on_hand
        }
      )

    q = if branch_id, do: where(q, [i], i.branch_id == ^branch_id), else: q

    Repo.all(q)
    |> Enum.map(fn row ->
      %{
        product_id: row.product_id,
        sku: row.sku,
        name: row.name,
        branch_id: row.branch_id,
        quantity_on_hand: to_string(row.quantity_on_hand || 0)
      }
    end)
  end
end
