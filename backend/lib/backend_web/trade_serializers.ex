defmodule KaarobarWeb.TradeSerializers do
  @moduledoc """
  JSON shapes for hire, professional services and the regulated register.

  The register goes out with `line`, the single-string form that matches the
  column order of the paper book the law expects — so an inspector can check
  the two against each other without translating between them.
  """

  alias Kaarobar.Professional.Quote
  alias Kaarobar.Professional.QuoteLine
  alias Kaarobar.Professional.TimeEntry
  alias Kaarobar.Regulated.RegisterEntry
  alias Kaarobar.Rentals.Agreement
  alias Kaarobar.Rentals.AgreementLine
  alias Kaarobar.Rentals.Unit
  alias KaarobarWeb.CatalogSerializers
  alias KaarobarWeb.JSONHelpers, as: H
  alias KaarobarWeb.SalesSerializers

  # --- Hire -------------------------------------------------------------------

  def unit(%Unit{} = unit) do
    %{
      id: unit.id,
      branch_id: unit.branch_id,
      variant_id: unit.variant_id,
      asset_code: unit.asset_code,
      serial_number: unit.serial_number,
      condition_notes: unit.condition_notes,
      status: unit.status,
      daily_rate: H.money(unit.daily_rate),
      deposit_amount: H.money(unit.deposit_amount),
      acquired_on: H.date(unit.acquired_on),
      hireable: Unit.hireable?(unit),
      is_active: unit.is_active
    }
  end

  def agreement_line(%AgreementLine{} = line) do
    %{
      id: line.id,
      rental_unit_id: line.rental_unit_id,
      rental_unit: H.preloaded(line.rental_unit, &unit/1),
      name: line.name_snapshot,
      daily_rate: H.money(line.daily_rate),
      deposit_amount: H.money(line.deposit_amount),
      held_from: H.timestamp(line.held_from),
      held_until: H.timestamp(line.held_until),
      returned_at: H.timestamp(line.returned_at),
      return_condition: line.return_condition,
      condition_notes: line.condition_notes,
      out: AgreementLine.out?(line)
    }
  end

  def agreement(%Agreement{} = agreement) do
    now = DateTime.utc_now()

    %{
      id: agreement.id,
      number: agreement.number,
      status: agreement.status,
      customer_id: agreement.customer_id,
      customer: H.preloaded(agreement.customer, &SalesSerializers.customer/1),
      starts_at: H.timestamp(agreement.starts_at),
      due_back_at: H.timestamp(agreement.due_back_at),
      returned_at: H.timestamp(agreement.returned_at),
      days_late: Agreement.days_late(agreement, now),
      hire_total: H.money(agreement.hire_total),
      deposit_held: H.money(agreement.deposit_held),
      deposit_returned: H.money(agreement.deposit_returned),
      late_fee: H.money(agreement.late_fee),
      damage_fee: H.money(agreement.damage_fee),
      total_due: H.money(Agreement.total_due(agreement)),
      sale_id: agreement.sale_id,
      notes: agreement.notes,
      cancel_reason: agreement.cancel_reason,
      lines: H.preloaded(agreement.lines, &agreement_line/1)
    }
  end

  # --- Professional services --------------------------------------------------

  def quote_line(%QuoteLine{} = line) do
    %{
      id: line.id,
      variant_id: line.variant_id,
      description: line.description,
      quantity: H.quantity(line.quantity),
      unit_price: H.money(line.unit_price),
      discount: H.money(line.discount),
      line_total: H.money(line.line_total)
    }
  end

  def quote(%Quote{} = quote) do
    %{
      id: quote.id,
      number: quote.number,
      title: quote.title,
      status: quote.status,
      customer_id: quote.customer_id,
      customer: H.preloaded(quote.customer, &SalesSerializers.customer/1),
      currency: quote.currency,
      subtotal: H.money(quote.subtotal),
      discount_total: H.money(quote.discount_total),
      tax_total: H.money(quote.tax_total),
      total: H.money(quote.total),
      valid_until: H.date(quote.valid_until),
      lapsed: Quote.lapsed?(quote, Date.utc_today()),
      notes: quote.notes,
      terms: quote.terms,
      sent_at: H.timestamp(quote.sent_at),
      accepted_at: H.timestamp(quote.accepted_at),
      declined_at: H.timestamp(quote.declined_at),
      decline_reason: quote.decline_reason,
      service_job_id: quote.service_job_id,
      sale_id: quote.sale_id,
      lines: H.preloaded(quote.lines, &quote_line/1)
    }
  end

  def win_rate(stats) do
    %{
      from: H.date(stats.from),
      to: H.date(stats.to),
      quoted_count: stats.quoted_count,
      decided_count: stats.decided_count,
      won_count: stats.won_count,
      quoted_value: H.money(stats.quoted_value),
      won_value: H.money(stats.won_value),
      win_rate: H.money(stats.win_rate)
    }
  end

  def time_entry(%TimeEntry{} = entry) do
    %{
      id: entry.id,
      user_id: entry.user_id,
      customer_id: entry.customer_id,
      service_job_id: entry.service_job_id,
      description: entry.description,
      worked_on: H.date(entry.worked_on),
      minutes: entry.minutes,
      hours: H.money(TimeEntry.hours(entry)),
      is_billable: entry.is_billable,
      hourly_rate: H.money(entry.hourly_rate),
      amount: H.money(entry.amount),
      billed_at: H.timestamp(entry.billed_at),
      sale_id: entry.sale_id,
      unbilled: TimeEntry.unbilled?(entry),
      notes: entry.notes
    }
  end

  def utilisation_row(row) do
    %{
      user_id: row.user_id,
      billable_minutes: row.billable_minutes,
      non_billable_minutes: row.non_billable_minutes,
      amount: H.money(row.amount)
    }
  end

  # --- The regulated register -------------------------------------------------

  def register_entry(%RegisterEntry{} = entry) do
    %{
      id: entry.id,
      sale_id: entry.sale_id,
      sale_item_id: entry.sale_item_id,
      product_id: entry.product_id,
      product_name: entry.product_name_snapshot,
      regulatory_class: entry.regulatory_class,
      active_ingredient: entry.active_ingredient,
      batch_id: entry.batch_id,
      batch_number: entry.batch_number_snapshot,
      quantity: H.quantity(entry.quantity),
      unit: entry.unit_snapshot,
      customer_id: entry.customer_id,
      buyer_name: entry.buyer_name,
      buyer_id_type: entry.buyer_id_type,
      buyer_id_number: entry.buyer_id_number,
      buyer_licence_number: entry.buyer_licence_number,
      buyer_address: entry.buyer_address,
      sold_by_label: entry.sold_by_label,
      business_licence: entry.business_licence_snapshot,
      prescriber_name: entry.prescriber_name,
      prescription_reference: entry.prescription_reference,
      purpose: entry.purpose,
      occurred_at: H.timestamp(entry.occurred_at),
      # The paper-book form, so the two can be checked against each other.
      line: RegisterEntry.to_line(entry)
    }
  end

  def restricted_product(product), do: CatalogSerializers.product(product)
end
