defmodule KaarobarWeb.InventoryJSON do
  @moduledoc false

  alias KaarobarWeb.InventorySerializers

  def index(%{stock_items: items, meta: meta}) do
    %{data: Enum.map(items, &InventorySerializers.stock_item/1), meta: meta}
  end

  def show(%{stock_item: item}), do: %{data: InventorySerializers.stock_item(item)}

  def moves(%{moves: moves, meta: meta}) do
    %{data: Enum.map(moves, &InventorySerializers.stock_move/1), meta: meta}
  end

  def ledger(%{moves: moves}) do
    %{data: Enum.map(moves, &InventorySerializers.stock_move/1)}
  end

  def move(%{move: move}), do: %{data: InventorySerializers.stock_move(move)}

  def batches(%{batches: batches}) do
    %{data: Enum.map(batches, &InventorySerializers.batch/1)}
  end

  def batch(%{batch: batch}), do: %{data: InventorySerializers.batch(batch)}

  def serials(%{serials: serials}) do
    %{data: Enum.map(serials, &InventorySerializers.serial_number/1)}
  end

  def valuation(%{valuation: valuation}) do
    %{data: InventorySerializers.valuation(valuation)}
  end

  def reconcile(%{reconciliation: reconciliation}) do
    %{data: InventorySerializers.reconciliation(reconciliation)}
  end

  def reorder(%{suggestions: suggestions}) do
    %{data: Enum.map(suggestions, &InventorySerializers.reorder_suggestion/1)}
  end
end
