defmodule KaarobarWeb.StockOperationsJSON do
  @moduledoc false

  alias KaarobarWeb.InventorySerializers

  def transfers(%{transfers: transfers}) do
    %{data: Enum.map(transfers, &InventorySerializers.transfer/1)}
  end

  def transfer(%{transfer: transfer}), do: %{data: InventorySerializers.transfer(transfer)}

  def counts(%{counts: counts}) do
    %{data: Enum.map(counts, &InventorySerializers.stock_count/1)}
  end

  def count(%{count: count}), do: %{data: InventorySerializers.stock_count(count)}
end
