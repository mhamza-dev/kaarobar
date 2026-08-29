defmodule KaarobarWeb.InventorySerializers do
  @moduledoc """
  Wire shapes for stock, purchasing and the documents between them.

  Quantities are strings for the same reason money is: a shop selling 1.250 kg
  of mince should not have that arrive in a browser as a float.
  """

  import KaarobarWeb.JSONHelpers

  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Inventory.CostLayer
  alias Kaarobar.Inventory.SerialNumber
  alias Kaarobar.Inventory.StockCount
  alias Kaarobar.Inventory.StockCountItem
  alias Kaarobar.Inventory.StockItem
  alias Kaarobar.Inventory.StockMove
  alias Kaarobar.Inventory.StockTransfer
  alias Kaarobar.Inventory.StockTransferItem
  alias Kaarobar.Purchasing.GoodsReceipt
  alias Kaarobar.Purchasing.GoodsReceiptItem
  alias Kaarobar.Purchasing.PurchaseOrder
  alias Kaarobar.Purchasing.PurchaseOrderItem
  alias Kaarobar.Purchasing.PurchaseReturn
  alias Kaarobar.Purchasing.PurchaseReturnItem
  alias Kaarobar.Purchasing.Supplier
  alias Kaarobar.Purchasing.SupplierBill
  alias Kaarobar.Purchasing.SupplierBillItem
  alias Kaarobar.Purchasing.SupplierLedgerEntry
  alias Kaarobar.Purchasing.SupplierPayment
  alias Kaarobar.Purchasing.SupplierProduct
  alias KaarobarWeb.CatalogSerializers
  alias KaarobarWeb.Serializers

  # --- Stock ------------------------------------------------------------------

  def stock_item(%StockItem{} = item) do
    %{
      id: item.id,
      branch_id: item.branch_id,
      variant_id: item.variant_id,
      on_hand: quantity(item.on_hand),
      reserved: quantity(item.reserved),
      # What a cashier should actually be stopped by.
      available: quantity(StockItem.available(item)),
      incoming: quantity(item.incoming),
      average_cost: money(item.average_cost),
      value: money(StockItem.value(item)),
      reorder_point: quantity(item.reorder_point),
      reorder_quantity: quantity(item.reorder_quantity),
      max_stock: quantity(item.max_stock),
      below_reorder_point: StockItem.below_reorder_point?(item),
      bin_location: item.bin_location,
      last_counted_at: timestamp(item.last_counted_at),
      last_movement_at: timestamp(item.last_movement_at),
      branch: preloaded(item.branch, &Serializers.branch/1),
      variant: preloaded(item.variant, &CatalogSerializers.variant/1)
    }
  end

  def stock_move(%StockMove{} = move) do
    %{
      id: move.id,
      branch_id: move.branch_id,
      variant_id: move.variant_id,
      kind: move.kind,
      quantity: quantity(move.quantity),
      unit_cost: money(move.unit_cost),
      total_cost: money(move.total_cost),
      # The running total, so a client can render the ledger as an account.
      balance_after: quantity(move.balance_after),
      batch_id: move.batch_id,
      serial_id: move.serial_id,
      reference_type: move.reference_type,
      reference_id: move.reference_id,
      reason: move.reason,
      note: move.note,
      actor: %{id: move.actor_user_id, label: move.actor_label},
      occurred_at: timestamp(move.occurred_at),
      batch: preloaded(move.batch, &batch/1),
      variant: preloaded(move.variant, &CatalogSerializers.variant/1)
    }
  end

  def batch(%Batch{} = batch) do
    today = Date.utc_today()

    %{
      id: batch.id,
      variant_id: batch.variant_id,
      batch_number: batch.batch_number,
      manufactured_on: date(batch.manufactured_on),
      expires_on: date(batch.expires_on),
      days_until_expiry: Batch.days_until_expiry(batch, today),
      expired: Batch.expired?(batch, today),
      sellable: Batch.sellable?(batch, today),
      supplier_id: batch.supplier_id,
      received_quantity: quantity(batch.received_quantity),
      remaining_quantity: quantity(batch.remaining_quantity),
      unit_cost: money(batch.unit_cost),
      status: batch.status,
      note: batch.note,
      variant: preloaded(batch.variant, &CatalogSerializers.variant/1)
    }
  end

  def batch(_other), do: nil

  def serial_number(%SerialNumber{} = record) do
    %{
      id: record.id,
      variant_id: record.variant_id,
      branch_id: record.branch_id,
      batch_id: record.batch_id,
      serial: record.serial,
      status: record.status,
      received_at: timestamp(record.received_at),
      sold_at: timestamp(record.sold_at),
      sale_reference_id: record.sale_reference_id,
      variant: preloaded(record.variant, &CatalogSerializers.variant/1)
    }
  end

  def cost_layer(%CostLayer{} = layer) do
    %{
      id: layer.id,
      variant_id: layer.variant_id,
      branch_id: layer.branch_id,
      batch_id: layer.batch_id,
      quantity: quantity(layer.quantity),
      remaining_quantity: quantity(layer.remaining_quantity),
      unit_cost: money(layer.unit_cost),
      value: money(CostLayer.value(layer)),
      received_at: timestamp(layer.received_at)
    }
  end

  def valuation(%{quantity: quantity_value, value: value}) do
    %{quantity: quantity(quantity_value), value: money(value)}
  end

  @doc """
  The three valuations side by side.

  `balanced` is the one that matters: the projection is the sum of the moves,
  so any quantity difference at all means one of them is wrong.
  """
  def reconciliation(result) do
    %{
      projected: valuation(result.projected),
      ledger: valuation(result.ledger),
      layers: valuation(result.layers),
      quantity_difference: quantity(result.quantity_difference),
      value_difference: money(result.value_difference),
      balanced: result.balanced
    }
  end

  def reorder_suggestion(suggestion) do
    %{
      variant_id: suggestion.stock_item.variant_id,
      branch_id: suggestion.stock_item.branch_id,
      available: quantity(suggestion.available),
      reorder_point: quantity(suggestion.reorder_point),
      incoming: quantity(suggestion.incoming),
      suggested_quantity: quantity(suggestion.suggested_quantity),
      variant: preloaded(suggestion.variant, &CatalogSerializers.variant/1)
    }
  end

  # --- Transfers and counts ---------------------------------------------------

  def transfer(%StockTransfer{} = transfer) do
    %{
      id: transfer.id,
      number: transfer.number,
      status: transfer.status,
      source_branch_id: transfer.source_branch_id,
      destination_branch_id: transfer.destination_branch_id,
      dispatched_at: timestamp(transfer.dispatched_at),
      received_at: timestamp(transfer.received_at),
      in_transit: StockTransfer.in_transit?(transfer),
      notes: transfer.notes,
      source_branch: preloaded(transfer.source_branch, &Serializers.branch/1),
      destination_branch: preloaded(transfer.destination_branch, &Serializers.branch/1),
      items: preloaded(transfer.items, &transfer_item/1),
      inserted_at: timestamp(transfer.inserted_at)
    }
  end

  def transfer_item(%StockTransferItem{} = item) do
    %{
      id: item.id,
      variant_id: item.variant_id,
      batch_id: item.batch_id,
      quantity: quantity(item.quantity),
      received_quantity: quantity(item.received_quantity),
      shortfall: quantity(StockTransferItem.shortfall(item)),
      short: StockTransferItem.short?(item),
      unit_cost: money(item.unit_cost),
      note: item.note,
      variant: preloaded(item.variant, &CatalogSerializers.variant/1)
    }
  end

  def stock_count(%StockCount{} = count) do
    %{
      id: count.id,
      number: count.number,
      status: count.status,
      kind: count.kind,
      branch_id: count.branch_id,
      category_id: count.category_id,
      started_at: timestamp(count.started_at),
      counted_at: timestamp(count.counted_at),
      approved_at: timestamp(count.approved_at),
      # The size of what an approver is being asked to accept.
      variance_quantity: quantity(count.variance_quantity),
      variance_value: money(count.variance_value),
      line_count: count.line_count,
      notes: count.notes,
      branch: preloaded(count.branch, &Serializers.branch/1),
      items: preloaded(count.items, &stock_count_item/1),
      inserted_at: timestamp(count.inserted_at)
    }
  end

  def stock_count_item(%StockCountItem{} = item) do
    %{
      id: item.id,
      variant_id: item.variant_id,
      batch_id: item.batch_id,
      expected_quantity: quantity(item.expected_quantity),
      counted_quantity: quantity(item.counted_quantity),
      variance: quantity(item.variance),
      variance_value: money(item.variance_value),
      unit_cost: money(item.unit_cost),
      counted: StockCountItem.counted?(item),
      adjusts_stock: StockCountItem.adjusts_stock?(item),
      counted_at: timestamp(item.counted_at),
      reason: item.reason,
      note: item.note,
      variant: preloaded(item.variant, &CatalogSerializers.variant/1)
    }
  end

  # --- Purchasing -------------------------------------------------------------

  def supplier(%Supplier{} = supplier) do
    %{
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      contact_name: supplier.contact_name,
      phone: supplier.phone,
      email: supplier.email,
      website: supplier.website,
      address: %{
        line1: supplier.address_line1,
        line2: supplier.address_line2,
        city: supplier.city,
        state: supplier.state,
        postal_code: supplier.postal_code,
        country_code: supplier.country_code
      },
      tax_number: supplier.tax_number,
      currency: supplier.currency,
      payment_terms_days: supplier.payment_terms_days,
      credit_limit: money(supplier.credit_limit),
      balance: money(supplier.balance),
      notes: supplier.notes,
      is_active: supplier.is_active
    }
  end

  def supplier(_other), do: nil

  def supplier_product(%SupplierProduct{} = record) do
    %{
      id: record.id,
      supplier_id: record.supplier_id,
      variant_id: record.variant_id,
      supplier_sku: record.supplier_sku,
      supplier_name: record.supplier_name,
      unit_cost: money(record.unit_cost),
      minimum_order_quantity: quantity(record.minimum_order_quantity),
      pack_size: quantity(record.pack_size),
      lead_time_days: record.lead_time_days,
      is_preferred: record.is_preferred,
      is_active: record.is_active,
      last_purchased_at: timestamp(record.last_purchased_at),
      supplier: preloaded(record.supplier, &supplier/1),
      variant: preloaded(record.variant, &CatalogSerializers.variant/1)
    }
  end

  def ledger_entry(%SupplierLedgerEntry{} = entry) do
    %{
      id: entry.id,
      supplier_id: entry.supplier_id,
      kind: entry.kind,
      amount: money(entry.amount),
      balance_after: money(entry.balance_after),
      reference_type: entry.reference_type,
      reference_id: entry.reference_id,
      note: entry.note,
      occurred_at: timestamp(entry.occurred_at),
      actor: %{id: entry.actor_user_id, label: entry.actor_label}
    }
  end

  def purchase_order(%PurchaseOrder{} = order) do
    %{
      id: order.id,
      number: order.number,
      status: order.status,
      supplier_id: order.supplier_id,
      branch_id: order.branch_id,
      ordered_on: date(order.ordered_on),
      expected_on: date(order.expected_on),
      currency: order.currency,
      subtotal: money(order.subtotal),
      tax_total: money(order.tax_total),
      shipping_total: money(order.shipping_total),
      total: money(order.total),
      reference: order.reference,
      notes: order.notes,
      receivable: PurchaseOrder.receivable?(order),
      editable: PurchaseOrder.editable?(order),
      supplier: preloaded(order.supplier, &supplier/1),
      branch: preloaded(order.branch, &Serializers.branch/1),
      items: preloaded(order.items, &purchase_order_item/1),
      inserted_at: timestamp(order.inserted_at)
    }
  end

  def purchase_order(_other), do: nil

  def purchase_order_item(%PurchaseOrderItem{} = item) do
    %{
      id: item.id,
      variant_id: item.variant_id,
      description: item.description,
      supplier_sku: item.supplier_sku,
      ordered_quantity: quantity(item.ordered_quantity),
      received_quantity: quantity(item.received_quantity),
      outstanding_quantity: quantity(PurchaseOrderItem.outstanding_quantity(item)),
      fully_received: PurchaseOrderItem.fully_received?(item),
      unit_cost: money(item.unit_cost),
      discount_percent: quantity(item.discount_percent),
      tax_total: money(item.tax_total),
      line_total: money(item.line_total),
      variant: preloaded(item.variant, &CatalogSerializers.variant/1)
    }
  end

  def goods_receipt(%GoodsReceipt{} = receipt) do
    %{
      id: receipt.id,
      number: receipt.number,
      status: receipt.status,
      supplier_id: receipt.supplier_id,
      branch_id: receipt.branch_id,
      purchase_order_id: receipt.purchase_order_id,
      received_on: date(receipt.received_on),
      supplier_reference: receipt.supplier_reference,
      subtotal: money(receipt.subtotal),
      tax_total: money(receipt.tax_total),
      shipping_total: money(receipt.shipping_total),
      total: money(receipt.total),
      posted: GoodsReceipt.posted?(receipt),
      posted_at: timestamp(receipt.posted_at),
      notes: receipt.notes,
      supplier: preloaded(receipt.supplier, &supplier/1),
      purchase_order: preloaded(receipt.purchase_order, &purchase_order/1),
      items: preloaded(receipt.items, &goods_receipt_item/1),
      inserted_at: timestamp(receipt.inserted_at)
    }
  end

  def goods_receipt_item(%GoodsReceiptItem{} = item) do
    %{
      id: item.id,
      variant_id: item.variant_id,
      purchase_order_item_id: item.purchase_order_item_id,
      quantity: quantity(item.quantity),
      rejected_quantity: quantity(item.rejected_quantity),
      accepted_quantity: quantity(GoodsReceiptItem.accepted_quantity(item)),
      unit_cost: money(item.unit_cost),
      batch_id: item.batch_id,
      batch_number: item.batch_number,
      manufactured_on: date(item.manufactured_on),
      expires_on: date(item.expires_on),
      serials: item.serials,
      note: item.note,
      batch: preloaded(item.batch, &batch/1),
      variant: preloaded(item.variant, &CatalogSerializers.variant/1)
    }
  end

  def supplier_bill(%SupplierBill{} = bill) do
    %{
      id: bill.id,
      number: bill.number,
      supplier_invoice_number: bill.supplier_invoice_number,
      status: bill.status,
      supplier_id: bill.supplier_id,
      goods_receipt_id: bill.goods_receipt_id,
      issued_on: date(bill.issued_on),
      due_on: date(bill.due_on),
      currency: bill.currency,
      subtotal: money(bill.subtotal),
      tax_total: money(bill.tax_total),
      total: money(bill.total),
      paid_total: money(bill.paid_total),
      outstanding: money(SupplierBill.outstanding(bill)),
      overdue: SupplierBill.overdue?(bill, Date.utc_today()),
      notes: bill.notes,
      supplier: preloaded(bill.supplier, &supplier/1),
      items: preloaded(bill.items, &supplier_bill_item/1),
      inserted_at: timestamp(bill.inserted_at)
    }
  end

  def supplier_bill_item(%SupplierBillItem{} = item) do
    %{
      id: item.id,
      variant_id: item.variant_id,
      description: item.description,
      quantity: quantity(item.quantity),
      unit_cost: money(item.unit_cost),
      tax_total: money(item.tax_total),
      line_total: money(item.line_total)
    }
  end

  def supplier_payment(%SupplierPayment{} = payment) do
    %{
      id: payment.id,
      number: payment.number,
      supplier_id: payment.supplier_id,
      method: payment.method,
      amount: money(payment.amount),
      # Paid but not yet matched to a bill: money on account.
      unallocated_amount: money(payment.unallocated_amount),
      currency: payment.currency,
      paid_on: date(payment.paid_on),
      reference: payment.reference,
      notes: payment.notes,
      allocations: preloaded(payment.allocations, &allocation/1),
      inserted_at: timestamp(payment.inserted_at)
    }
  end

  defp allocation(record) do
    %{
      id: record.id,
      supplier_bill_id: record.supplier_bill_id,
      amount: money(record.amount)
    }
  end

  def purchase_return(%PurchaseReturn{} = record) do
    %{
      id: record.id,
      number: record.number,
      status: record.status,
      supplier_id: record.supplier_id,
      branch_id: record.branch_id,
      goods_receipt_id: record.goods_receipt_id,
      reason: record.reason,
      returned_on: date(record.returned_on),
      subtotal: money(record.subtotal),
      tax_total: money(record.tax_total),
      total: money(record.total),
      notes: record.notes,
      supplier: preloaded(record.supplier, &supplier/1),
      items: preloaded(record.items, &purchase_return_item/1),
      inserted_at: timestamp(record.inserted_at)
    }
  end

  def purchase_return_item(%PurchaseReturnItem{} = item) do
    %{
      id: item.id,
      variant_id: item.variant_id,
      batch_id: item.batch_id,
      quantity: quantity(item.quantity),
      unit_cost: money(item.unit_cost),
      line_total: money(item.line_total),
      note: item.note,
      variant: preloaded(item.variant, &CatalogSerializers.variant/1)
    }
  end

  def ageing(buckets) do
    %{
      current: money(buckets.current),
      overdue_1_30: money(buckets.overdue_1_30),
      overdue_31_60: money(buckets.overdue_31_60),
      overdue_61_90: money(buckets.overdue_61_90),
      overdue_90_plus: money(buckets.overdue_90_plus),
      total: money(buckets.total)
    }
  end
end
