defmodule Kaarobar.Repo.Migrations.AddCashRoundingToBusinesses do
  use Ecto.Migration

  @moduledoc """
  The smallest coin the shop can actually hand over.

  In much of the world the smallest unit of account is smaller than the
  smallest coin in circulation: prices are quoted to the rupee but nobody has
  had a one-rupee coin for years, and a total of 447 is settled at 450. Shops
  do this whether or not their software supports it, and when it does not, the
  difference lands in the drawer as an unexplained variance every single day
  until the cashier stops looking at the variance at all.

  Recording it as `sales.rounding` makes the money add up and keeps the
  adjustment visible — it is a real, if tiny, cost of doing business, and on
  a thousand transactions a day it is not tiny.

  Null means no rounding, which is right for a card-heavy business or a
  currency whose smallest coin is its smallest unit.
  """

  def change do
    alter table(:businesses) do
      add :cash_rounding_increment, :decimal, precision: 16, scale: 4
    end

    create constraint(:businesses, :businesses_cash_rounding_check,
             check: "cash_rounding_increment IS NULL OR cash_rounding_increment > 0"
           )
  end
end
