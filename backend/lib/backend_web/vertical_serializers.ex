defmodule KaarobarWeb.VerticalSerializers do
  @moduledoc """
  JSON shapes for the appointment, queue, commission and service-job surfaces.

  Waiting times and overdue flags are computed here rather than left to the
  client, for the same reason the kitchen display computes its own clock: a
  salon has a screen at the desk and one in the back, and they must not
  disagree about how long somebody has been sitting there.
  """

  alias Kaarobar.Commissions.Entry
  alias Kaarobar.Commissions.Rule
  alias Kaarobar.Scheduling.Appointment
  alias Kaarobar.Scheduling.AppointmentService
  alias Kaarobar.Scheduling.QueueEntry
  alias Kaarobar.Scheduling.Resource
  alias Kaarobar.ServiceDesk.Job
  alias Kaarobar.ServiceDesk.JobEvent
  alias Kaarobar.ServiceDesk.JobItem
  alias KaarobarWeb.JSONHelpers, as: H
  alias KaarobarWeb.SalesSerializers

  # --- Scheduling -------------------------------------------------------------

  def resource(%Resource{} = resource) do
    %{
      id: resource.id,
      branch_id: resource.branch_id,
      name: resource.name,
      kind: resource.kind,
      user_id: resource.user_id,
      colour: resource.colour,
      position: resource.position,
      working_hours: resource.working_hours,
      is_bookable: resource.is_bookable,
      bookable: Resource.bookable?(resource),
      is_active: resource.is_active
    }
  end

  def slot(slot) do
    %{starts_at: H.timestamp(slot.starts_at), ends_at: H.timestamp(slot.ends_at)}
  end

  def appointment_service(%AppointmentService{} = service) do
    %{
      id: service.id,
      appointment_id: service.appointment_id,
      variant_id: service.variant_id,
      resource_id: service.resource_id,
      resource: H.preloaded(service.resource, &resource/1),
      name: service.name_snapshot,
      duration_minutes: service.duration_minutes,
      price: H.money(service.price),
      starts_at: H.timestamp(service.starts_at),
      ends_at: H.timestamp(service.ends_at),
      status: service.status,
      notes: service.notes
    }
  end

  def appointment(%Appointment{} = appointment) do
    %{
      id: appointment.id,
      number: appointment.number,
      status: appointment.status,
      source: appointment.source,
      who: Appointment.who(appointment),
      customer_id: appointment.customer_id,
      customer: H.preloaded(appointment.customer, &SalesSerializers.customer/1),
      walk_in_name: appointment.walk_in_name,
      walk_in_phone: appointment.walk_in_phone,
      starts_at: H.timestamp(appointment.starts_at),
      ends_at: H.timestamp(appointment.ends_at),
      duration_minutes: Appointment.duration_minutes(appointment),
      notes: appointment.notes,
      order_id: appointment.order_id,
      sale_id: appointment.sale_id,
      confirmed_at: H.timestamp(appointment.confirmed_at),
      arrived_at: H.timestamp(appointment.arrived_at),
      started_at: H.timestamp(appointment.started_at),
      completed_at: H.timestamp(appointment.completed_at),
      cancelled_at: H.timestamp(appointment.cancelled_at),
      cancel_reason: appointment.cancel_reason,
      no_show_at: H.timestamp(appointment.no_show_at),
      services: H.preloaded(appointment.services, &appointment_service/1)
    }
  end

  @doc "One column of the day's diary: a resource and what it is booked for."
  def diary_column(column) do
    %{
      resource: resource(column.resource),
      services: Enum.map(column.services, &appointment_service/1)
    }
  end

  def queue_entry(entry) when is_map(entry) and is_map_key(entry, :entry) do
    entry.entry
    |> queue_entry()
    |> Map.put(:minutes_waiting, entry.minutes_waiting)
  end

  def queue_entry(%QueueEntry{} = entry) do
    %{
      id: entry.id,
      name: entry.name,
      phone: entry.phone,
      customer_id: entry.customer_id,
      variant_id: entry.variant_id,
      requested_resource_id: entry.requested_resource_id,
      requested_resource: H.preloaded(entry.requested_resource, &resource/1),
      status: entry.status,
      position: entry.position,
      notes: entry.notes,
      joined_at: H.timestamp(entry.joined_at),
      called_at: H.timestamp(entry.called_at),
      seated_at: H.timestamp(entry.seated_at),
      appointment_id: entry.appointment_id
    }
  end

  # --- Commissions ------------------------------------------------------------

  def commission_rule(%Rule{} = rule) do
    %{
      id: rule.id,
      name: rule.name,
      user_id: rule.user_id,
      variant_id: rule.variant_id,
      category_id: rule.category_id,
      basis: rule.basis,
      rate: H.money(rule.rate),
      flat_amount: H.money(rule.flat_amount),
      min_sales_amount: H.money(rule.min_sales_amount),
      priority: rule.priority,
      specificity: Rule.specificity(rule),
      is_active: rule.is_active
    }
  end

  def commission(%Entry{} = entry) do
    %{
      id: entry.id,
      user_id: entry.user_id,
      sale_id: entry.sale_id,
      sale_item_id: entry.sale_item_id,
      commission_rule_id: entry.commission_rule_id,
      basis: entry.basis_snapshot,
      rate: H.money(entry.rate_snapshot),
      base_amount: H.money(entry.base_amount),
      amount: H.money(entry.amount),
      status: entry.status,
      earned_on: H.date(entry.earned_on),
      paid_at: H.timestamp(entry.paid_at),
      reversed_at: H.timestamp(entry.reversed_at),
      note: entry.note
    }
  end

  def commission_statement(statement) do
    %{
      user_id: statement.user_id,
      from: H.date(statement.from),
      to: H.date(statement.to),
      earned: H.money(statement.earned),
      reversed: H.money(statement.reversed),
      paid: H.money(statement.paid),
      entries: Enum.map(statement.entries, &commission/1)
    }
  end

  def commission_summary(row) do
    %{user_id: row.user_id, amount: H.money(row.amount), line_count: row.line_count}
  end

  # --- Service jobs -----------------------------------------------------------

  def job_item(%JobItem{} = item) do
    %{
      id: item.id,
      variant_id: item.variant_id,
      description: item.description,
      quantity: H.quantity(item.quantity),
      unit_price: H.money(item.unit_price),
      line_total: H.money(item.line_total),
      tag_code: item.tag_code,
      label: JobItem.label(item),
      condition_notes: item.condition_notes,
      condition_photo_paths: item.condition_photo_paths,
      colour: item.colour,
      brand: item.brand,
      serial_number: item.serial_number,
      status: item.status,
      rack_location: item.rack_location,
      ready_at: H.timestamp(item.ready_at),
      delivered_at: H.timestamp(item.delivered_at),
      notes: item.notes
    }
  end

  def job(%Job{} = job) do
    today = Date.utc_today()

    %{
      id: job.id,
      number: job.number,
      status: job.status,
      priority: job.priority,
      who: Job.who(job),
      customer_id: job.customer_id,
      customer: H.preloaded(job.customer, &SalesSerializers.customer/1),
      walk_in_name: job.walk_in_name,
      walk_in_phone: job.walk_in_phone,
      promised_on: H.date(job.promised_on),
      overdue: Job.overdue?(job, today),
      received_at: H.timestamp(job.received_at),
      started_at: H.timestamp(job.started_at),
      ready_at: H.timestamp(job.ready_at),
      delivered_at: H.timestamp(job.delivered_at),
      cancelled_at: H.timestamp(job.cancelled_at),
      cancel_reason: job.cancel_reason,
      quoted_total: H.money(job.quoted_total),
      advance_paid: H.money(job.advance_paid),
      balance_due: H.money(Job.balance_due(job)),
      sale_id: job.sale_id,
      rack_location: job.rack_location,
      fulfilment: job.fulfilment,
      delivery_address: job.delivery_address,
      delivery_notes: job.delivery_notes,
      assigned_to_id: job.assigned_to_id,
      notes: job.notes,
      items: H.preloaded(job.items, &job_item/1)
    }
  end

  def job_event(%JobEvent{} = event) do
    %{
      id: event.id,
      kind: event.kind,
      summary: event.summary,
      detail: event.detail,
      service_job_item_id: event.service_job_item_id,
      actor_label: event.actor_label,
      occurred_at: H.timestamp(event.occurred_at)
    }
  end
end
