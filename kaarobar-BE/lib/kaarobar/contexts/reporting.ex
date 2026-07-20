defmodule Kaarobar.Reporting do
  import Ecto.Query
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{Sale, InventoryRecord, SaleReturn, Business, Branch}

  def owner_dashboard(owner_id) do
    today = Date.utc_today()

    sales_today =
      from(s in Sale,
        where:
          s.owner_id == ^owner_id and s.status == "Completed" and
            fragment("(? AT TIME ZONE 'UTC')::date", s.inserted_at) == ^today,
        select: coalesce(sum(s.total_amount), 0)
      )
      |> Repo.one()

    cash_position =
      from(s in Sale,
        where: s.owner_id == ^owner_id and s.status == "Completed",
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
end
