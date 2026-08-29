defmodule KaarobarWeb.PurchasingJSON do
  @moduledoc false

  alias KaarobarWeb.InventorySerializers

  def suppliers(%{suppliers: suppliers}) do
    %{data: Enum.map(suppliers, &InventorySerializers.supplier/1)}
  end

  def supplier(%{supplier: supplier}), do: %{data: InventorySerializers.supplier(supplier)}

  def supplier_products(%{supplier_products: records}) do
    %{data: Enum.map(records, &InventorySerializers.supplier_product/1)}
  end

  def supplier_product(%{supplier_product: record}) do
    %{data: InventorySerializers.supplier_product(record)}
  end

  def ledger(%{supplier: supplier, entries: entries}) do
    %{
      data: %{
        supplier: InventorySerializers.supplier(supplier),
        balance: KaarobarWeb.JSONHelpers.money(supplier.balance),
        entries: Enum.map(entries, &InventorySerializers.ledger_entry/1)
      }
    }
  end

  def orders(%{orders: orders, meta: meta}) do
    %{data: Enum.map(orders, &InventorySerializers.purchase_order/1), meta: meta}
  end

  def order(%{order: order}), do: %{data: InventorySerializers.purchase_order(order)}

  def receipts(%{receipts: receipts}) do
    %{data: Enum.map(receipts, &InventorySerializers.goods_receipt/1)}
  end

  def receipt(%{receipt: receipt}), do: %{data: InventorySerializers.goods_receipt(receipt)}

  def bills(%{bills: bills}) do
    %{data: Enum.map(bills, &InventorySerializers.supplier_bill/1)}
  end

  def bill(%{bill: bill}), do: %{data: InventorySerializers.supplier_bill(bill)}

  def payment(%{payment: payment}), do: %{data: InventorySerializers.supplier_payment(payment)}

  def ageing(%{ageing: ageing}), do: %{data: InventorySerializers.ageing(ageing)}

  def returns(%{returns: returns}) do
    %{data: Enum.map(returns, &InventorySerializers.purchase_return/1)}
  end

  def purchase_return(%{purchase_return: record}) do
    %{data: InventorySerializers.purchase_return(record)}
  end
end
