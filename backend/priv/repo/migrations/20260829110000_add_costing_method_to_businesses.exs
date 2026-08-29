defmodule Kaarobar.Repo.Migrations.AddCostingMethodToBusinesses do
  use Ecto.Migration

  @moduledoc """
  How a business values the stock it holds, and whether it may go negative.

  ## Costing

  Weighted average is the default because it is what most small shops already
  do in their heads: everything of a kind is worth what it cost on average.
  FIFO is offered because it is what an accountant asks for, and because in a
  business with real batches — pesticides, medicine — the oldest stock is
  genuinely the stock leaving first.

  The choice is not meant to change once stock has moved. Recosting history is
  a migration, not a setting: a shop that flipped this in June would find its
  year-to-date margin change underneath it.

  ## Negative stock

  Off by default. Selling what you do not have is almost always a counting
  error, and the moment to catch it is at the till rather than at a stock take.
  Some shops genuinely need it — a kitchen that sells a dish before the
  delivery is booked in — so it is a switch rather than a rule.
  """

  def change do
    alter table(:businesses) do
      add :costing_method, :string, null: false, default: "weighted_average"
      add :allow_negative_stock, :boolean, null: false, default: false
      # Stock is counted here, sold from everywhere. A shop with a stockroom
      # sets this so per-branch sales averages are not divided by a location
      # that never sells anything.
      add :default_stock_branch_id, :binary_id
    end

    create constraint(:businesses, :businesses_costing_method_check,
             check: "costing_method IN ('weighted_average','fifo')"
           )
  end
end
