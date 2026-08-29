defmodule KaarobarWeb.SalesSerializers do
  @moduledoc """
  Wire shapes for the till: sales, tickets, tenders, returns, drawers.

  A sale renders every figure that was snapshotted onto it rather than
  recomputing anything, because the point of snapshotting was that a receipt
  reprinted in two years shows what was actually charged.
  """

  import KaarobarWeb.JSONHelpers

  alias Kaarobar.Customers.Customer
  alias Kaarobar.Customers.CustomerLedgerEntry
  alias Kaarobar.Customers.CustomerPayment
  alias Kaarobar.Registers.CashMovement
  alias Kaarobar.Registers.Register
  alias Kaarobar.Registers.Shift
  alias Kaarobar.Sales.Order
  alias Kaarobar.Sales.OrderItem
  alias Kaarobar.Sales.OrderItemModifier
  alias Kaarobar.Sales.Payment
  alias Kaarobar.Sales.RefundRequest
  alias Kaarobar.Sales.RefundRequestItem
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Sales.SaleItem
  alias Kaarobar.Sales.SaleItemModifier
  alias Kaarobar.Sales.SaleItemTax
  alias Kaarobar.Sales.SaleReturn
  alias Kaarobar.Sales.SaleReturnItem
  alias KaarobarWeb.CatalogSerializers
  alias KaarobarWeb.Serializers

  # --- Sales ------------------------------------------------------------------

  def sale(%Sale{} = sale) do
    %{
      id: sale.id,
      number: sale.number,
      status: sale.status,
      channel: sale.channel,
      currency: sale.currency,
      branch_id: sale.branch_id,
      register_id: sale.register_id,
      shift_id: sale.shift_id,
      order_id: sale.order_id,
      customer_id: sale.customer_id,
      subtotal: money(sale.subtotal),
      discount_total: money(sale.discount_total),
      order_discount: money(sale.order_discount),
      tax_total: money(sale.tax_total),
      rounding: money(sale.rounding),
      total: money(sale.total),
      paid_total: money(sale.paid_total),
      change_due: money(sale.change_due),
      refunded_total: money(sale.refunded_total),
      refundable_amount: money(Sale.refundable_amount(sale)),
      cost_total: money(sale.cost_total),
      margin: money(Sale.margin(sale)),
      prices_include_tax: sale.prices_include_tax,
      service_mode: sale.service_mode,
      served_by_user_id: sale.served_by_user_id,
      cashier_id: sale.cashier_id,
      cashier_label: sale.cashier_label,
      notes: sale.notes,
      discount_reason: sale.discount_reason,
      voided_at: timestamp(sale.voided_at),
      void_reason: sale.void_reason,
      sold_at: timestamp(sale.sold_at),
      items: preloaded(sale.items, &sale_item/1),
      payments: preloaded(sale.payments, &payment/1),
      customer: preloaded(sale.customer, &customer/1),
      register: preloaded(sale.register, &register/1),
      cashier: preloaded(sale.cashier, &Serializers.user/1)
    }
  end

  def sale_summary(%Sale{} = sale) do
    %{
      id: sale.id,
      number: sale.number,
      status: sale.status,
      currency: sale.currency,
      total: money(sale.total),
      refunded_total: money(sale.refunded_total),
      customer_id: sale.customer_id,
      cashier_label: sale.cashier_label,
      sold_at: timestamp(sale.sold_at)
    }
  end

  def sale_item(%SaleItem{} = item) do
    %{
      id: item.id,
      variant_id: item.variant_id,
      product_id: item.product_id,
      name: item.name_snapshot,
      sku: item.sku_snapshot,
      unit: item.unit_snapshot,
      quantity: quantity(item.quantity),
      refunded_quantity: quantity(item.refunded_quantity),
      refundable_quantity: quantity(SaleItem.refundable_quantity(item)),
      list_price: money(item.list_price),
      unit_price: money(item.unit_price),
      discount_total: money(item.discount_total),
      modifier_total: money(item.modifier_total),
      net_total: money(item.net_total),
      tax_total: money(item.tax_total),
      line_total: money(item.line_total),
      cost_snapshot: money(item.cost_snapshot),
      margin: money(SaleItem.margin(item)),
      applied_rule_ids: item.applied_rule_ids,
      batch_id: item.batch_id,
      seat_number: item.seat_number,
      position: item.position,
      note: item.note,
      taxes: preloaded(item.taxes, &sale_item_tax/1),
      modifiers: preloaded(item.modifiers, &sale_item_modifier/1),
      variant: preloaded(item.variant, &CatalogSerializers.variant/1)
    }
  end

  def sale_item_tax(%SaleItemTax{} = tax) do
    %{
      tax_id: tax.tax_id,
      name: tax.name_snapshot,
      label: tax.label_snapshot,
      rate: money(tax.rate_snapshot),
      is_compound: tax.is_compound,
      amount: money(tax.amount),
      position: tax.position
    }
  end

  def sale_item_modifier(%SaleItemModifier{} = modifier) do
    %{
      modifier_id: modifier.modifier_id,
      name: modifier.name_snapshot,
      price_delta: money(modifier.price_delta)
    }
  end

  def payment(%Payment{} = payment) do
    %{
      id: payment.id,
      method: payment.method,
      amount: money(payment.amount),
      tendered_amount: money(payment.tendered_amount),
      change_due: money(Payment.change_due(payment)),
      refunded_amount: money(payment.refunded_amount),
      refundable_amount: money(Payment.refundable_amount(payment)),
      currency: payment.currency,
      reference: payment.reference,
      card_last_four: payment.card_last_four,
      card_scheme: payment.card_scheme,
      status: payment.status,
      occurred_at: timestamp(payment.occurred_at)
    }
  end

  # --- The priced basket, before it is a sale ---------------------------------

  def quote_summary(%{totals: totals, lines: lines}) do
    %{
      totals: quote_totals(totals),
      lines: Enum.map(lines, &quote_line/1)
    }
  end

  defp quote_totals(totals) do
    %{
      subtotal: money(totals.subtotal),
      discount_total: money(totals.discount_total),
      order_discount: money(totals.order_discount),
      tax_total: money(totals.tax_total),
      rounding: money(totals.rounding),
      total: money(totals.total)
    }
  end

  defp quote_line(line) do
    %{
      variant_id: line.variant_id,
      name: line.name,
      quantity: quantity(line.quantity),
      unit_price: money(line.unit_price),
      discounts: Enum.map(line.discounts, &discount/1),
      order_discount: money(line.order_discount),
      net: money(line.net),
      tax_total: money(line.tax_total),
      tax_lines: Enum.map(line.tax_lines, &tax_line/1),
      total: money(line.total)
    }
  end

  defp discount(entry) do
    %{
      rule_id: Map.get(entry, :rule_id),
      name: Map.get(entry, :name),
      kind: Map.get(entry, :kind),
      amount: money(Map.get(entry, :amount))
    }
  end

  defp tax_line(entry) do
    %{
      tax_id: Map.get(entry, :tax_id),
      name: Map.get(entry, :name),
      label: Map.get(entry, :label),
      rate: money(Map.get(entry, :rate)),
      amount: money(Map.get(entry, :amount))
    }
  end

  # --- Returns and refunds ----------------------------------------------------

  def sale_return(%SaleReturn{} = record) do
    %{
      id: record.id,
      number: record.number,
      sale_id: record.sale_id,
      customer_id: record.customer_id,
      refund_request_id: record.refund_request_id,
      branch_id: record.branch_id,
      shift_id: record.shift_id,
      reason: record.reason,
      subtotal: money(record.subtotal),
      tax_total: money(record.tax_total),
      total: money(record.total),
      cost_total: money(record.cost_total),
      processed_by_label: record.processed_by_label,
      returned_at: timestamp(record.returned_at),
      notes: record.notes,
      items: preloaded(record.items, &sale_return_item/1),
      sale: preloaded(record.sale, &sale_summary/1)
    }
  end

  def sale_return_item(%SaleReturnItem{} = item) do
    %{
      id: item.id,
      sale_item_id: item.sale_item_id,
      variant_id: item.variant_id,
      name: item.name_snapshot,
      quantity: quantity(item.quantity),
      unit_price: money(item.unit_price),
      tax_total: money(item.tax_total),
      line_total: money(item.line_total),
      cost_snapshot: money(item.cost_snapshot),
      restock: item.restock,
      reason: item.reason,
      position: item.position
    }
  end

  def refund_request(%RefundRequest{} = request) do
    %{
      id: request.id,
      number: request.number,
      status: request.status,
      sale_id: request.sale_id,
      branch_id: request.branch_id,
      reason: request.reason,
      requested_amount: money(request.requested_amount),
      requested_at: timestamp(request.requested_at),
      reviewed_at: timestamp(request.reviewed_at),
      review_note: request.review_note,
      items: preloaded(request.items, &refund_request_item/1),
      sale: preloaded(request.sale, &sale_summary/1),
      requested_by: preloaded(request.requested_by, &Serializers.user/1),
      reviewed_by: preloaded(request.reviewed_by, &Serializers.user/1)
    }
  end

  def refund_request_item(%RefundRequestItem{} = item) do
    %{
      id: item.id,
      sale_item_id: item.sale_item_id,
      quantity: quantity(item.quantity),
      restock: item.restock,
      reason: item.reason
    }
  end

  # --- Orders -----------------------------------------------------------------

  def order(%Order{} = order) do
    %{
      id: order.id,
      number: order.number,
      status: order.status,
      channel: order.channel,
      label: order.label,
      branch_id: order.branch_id,
      register_id: order.register_id,
      customer_id: order.customer_id,
      service_mode: order.service_mode,
      served_by_user_id: order.served_by_user_id,
      subtotal: money(order.subtotal),
      discount_total: money(order.discount_total),
      tax_total: money(order.tax_total),
      total: money(order.total),
      notes: order.notes,
      opened_at: timestamp(order.opened_at),
      billed_at: timestamp(order.billed_at),
      cancelled_at: timestamp(order.cancelled_at),
      cancel_reason: order.cancel_reason,
      items: preloaded(order.items, &order_item/1),
      customer: preloaded(order.customer, &customer/1)
    }
  end

  def order_item(%OrderItem{} = item) do
    %{
      id: item.id,
      variant_id: item.variant_id,
      name: item.name_snapshot,
      quantity: quantity(item.quantity),
      billed_quantity: quantity(item.billed_quantity),
      unbilled_quantity: quantity(OrderItem.unbilled_quantity(item)),
      unit_price: money(item.unit_price),
      line_total: money(item.line_total),
      seat_number: item.seat_number,
      position: item.position,
      note: item.note,
      modifiers: preloaded(item.modifiers, &order_item_modifier/1)
    }
  end

  def order_item_modifier(%OrderItemModifier{} = modifier) do
    %{
      id: modifier.id,
      modifier_id: modifier.modifier_id,
      name: modifier.name_snapshot,
      price_delta: money(modifier.price_delta)
    }
  end

  # --- Registers, shifts, cash ------------------------------------------------

  def register(%Register{} = register) do
    %{
      id: register.id,
      name: register.name,
      code: register.code,
      branch_id: register.branch_id,
      invoice_prefix: register.invoice_prefix,
      invoice_series: Register.invoice_series(register),
      receipt_settings: register.receipt_settings,
      settings: register.settings,
      is_active: register.is_active
    }
  end

  def shift(%Shift{} = shift) do
    %{
      id: shift.id,
      number: shift.number,
      status: shift.status,
      branch_id: shift.branch_id,
      register_id: shift.register_id,
      opened_at: timestamp(shift.opened_at),
      closed_at: timestamp(shift.closed_at),
      opening_float: money(shift.opening_float),
      sales_count: shift.sales_count,
      gross_sales: money(shift.gross_sales),
      discount_total: money(shift.discount_total),
      tax_total: money(shift.tax_total),
      refund_total: money(shift.refund_total),
      net_sales: money(Shift.net_sales(shift)),
      tender_totals: shift.tender_totals,
      cash_in: money(shift.cash_in),
      cash_out: money(shift.cash_out),
      # Live for an open shift, snapshotted for a closed one.
      expected_cash: money(shift.expected_cash || Shift.expected_cash(shift)),
      declared_cash: money(shift.declared_cash),
      declared_tenders: shift.declared_tenders,
      cash_variance: money(shift.cash_variance),
      balanced: Shift.balanced?(shift),
      notes: shift.notes,
      register: preloaded(shift.register, &register/1),
      opened_by: preloaded(shift.opened_by, &Serializers.user/1),
      closed_by: preloaded(shift.closed_by, &Serializers.user/1)
    }
  end

  def cash_movement(%CashMovement{} = movement) do
    %{
      id: movement.id,
      shift_id: movement.shift_id,
      kind: movement.kind,
      amount: money(movement.amount),
      outward: CashMovement.outward?(movement),
      reason: movement.reason,
      reference: movement.reference,
      note: movement.note,
      actor_label: movement.actor_label,
      occurred_at: timestamp(movement.occurred_at)
    }
  end

  def x_report(report) do
    %{
      shift: shift(report.shift),
      expected_cash: money(report.expected_cash),
      net_sales: money(report.net_sales),
      cash_movements: Enum.map(report.cash_movements, &cash_movement/1)
    }
  end

  def reconciliation(report) do
    %{
      recorded: %{
        sales_count: report.recorded.sales_count,
        gross_sales: money(report.recorded.gross_sales),
        tax_total: money(report.recorded.tax_total),
        discount_total: money(report.recorded.discount_total),
        tenders: report.recorded.tenders
      },
      computed: %{
        sales_count: report.computed.sales_count,
        gross_sales: money(report.computed.gross_sales),
        tax_total: money(report.computed.tax_total),
        discount_total: money(report.computed.discount_total),
        tenders: Map.new(report.computed.tenders, fn {method, sum} -> {method, money(sum)} end)
      },
      agrees: report.agrees?
    }
  end

  # --- Customers --------------------------------------------------------------

  def customer(%Customer{} = customer) do
    %{
      id: customer.id,
      name: customer.name,
      code: customer.code,
      phone: customer.phone,
      email: customer.email,
      address_line1: customer.address_line1,
      address_line2: customer.address_line2,
      city: customer.city,
      postal_code: customer.postal_code,
      country_code: customer.country_code,
      tax_number: customer.tax_number,
      date_of_birth: date(customer.date_of_birth),
      notes: customer.notes,
      balance: money(customer.balance),
      credit_limit: money(customer.credit_limit),
      credit_allowed: customer.credit_allowed,
      available_credit: available_credit(customer),
      owing: Customer.owing?(customer),
      is_active: customer.is_active
    }
  end

  defp available_credit(%Customer{} = customer) do
    case Customer.available_credit(customer) do
      :unlimited -> "unlimited"
      amount -> money(amount)
    end
  end

  def customer_ledger_entry(%CustomerLedgerEntry{} = entry) do
    %{
      id: entry.id,
      kind: entry.kind,
      amount: money(entry.amount),
      balance_after: money(entry.balance_after),
      reference_type: entry.reference_type,
      reference_id: entry.reference_id,
      note: entry.note,
      actor_label: entry.actor_label,
      occurred_at: timestamp(entry.occurred_at)
    }
  end

  def customer_payment(%CustomerPayment{} = payment) do
    %{
      id: payment.id,
      number: payment.number,
      customer_id: payment.customer_id,
      method: payment.method,
      amount: money(payment.amount),
      paid_on: date(payment.paid_on),
      reference: payment.reference,
      notes: payment.notes,
      shift_id: payment.shift_id
    }
  end

  def ageing(buckets) do
    %{
      current: money(buckets.current),
      days_30: money(buckets.days_30),
      days_60: money(buckets.days_60),
      days_90: money(buckets.days_90),
      days_over_90: money(buckets.days_over_90),
      total: money(buckets.total)
    }
  end
end
