defmodule KaarobarWeb.DiningSerializers do
  @moduledoc """
  JSON shapes for the food-service surfaces: the floor, the kitchen and the
  riders.

  Elapsed times go out as computed integers rather than as a start time for the
  client to subtract from. Every till, tablet and kitchen screen in a shop has
  a slightly different clock, and a kitchen display that disagrees with the
  pass about how long a table has been waiting is worse than one that shows
  nothing.
  """

  alias Kaarobar.Deliveries.Delivery
  alias Kaarobar.Dining.DiningTable
  alias Kaarobar.Dining.Floor
  alias Kaarobar.Dining.TableSession
  alias Kaarobar.Kitchen.Station
  alias Kaarobar.Kitchen.Ticket
  alias Kaarobar.Kitchen.TicketItem
  alias KaarobarWeb.JSONHelpers, as: H
  alias KaarobarWeb.SalesSerializers

  # --- The floor --------------------------------------------------------------

  def floor(%Floor{} = floor) do
    %{
      id: floor.id,
      branch_id: floor.branch_id,
      name: floor.name,
      position: floor.position,
      is_active: floor.is_active
    }
  end

  def dining_table(%DiningTable{} = table) do
    %{
      id: table.id,
      branch_id: table.branch_id,
      floor_id: table.floor_id,
      floor: H.preloaded(table.floor, &floor/1),
      name: table.name,
      seats: table.seats,
      position_x: table.position_x,
      position_y: table.position_y,
      shape: table.shape,
      placed: DiningTable.placed?(table),
      is_active: table.is_active
    }
  end

  def table_session(%TableSession{} = session) do
    %{
      id: session.id,
      dining_table_id: session.dining_table_id,
      dining_table: H.preloaded(session.dining_table, &dining_table/1),
      order_id: session.order_id,
      order: H.preloaded(session.order, &SalesSerializers.order/1),
      status: session.status,
      covers: session.covers,
      label: session.label,
      server_id: session.server_id,
      opened_at: H.timestamp(session.opened_at),
      closed_at: H.timestamp(session.closed_at),
      merged_into_id: session.merged_into_id,
      notes: session.notes
    }
  end

  @doc "One square on the floor plan: the table, and whoever is on it."
  def floor_plan_entry(entry) do
    %{
      table: dining_table(entry.table),
      occupied: entry.occupied,
      minutes_seated: entry.minutes_seated,
      session: entry.session && table_session(entry.session)
    }
  end

  # --- The kitchen ------------------------------------------------------------

  def station(%Station{} = station) do
    %{
      id: station.id,
      branch_id: station.branch_id,
      name: station.name,
      code: station.code,
      position: station.position,
      prep_minutes: station.prep_minutes,
      display_group: station.display_group,
      screen: Station.screen(station),
      is_active: station.is_active
    }
  end

  def ticket_item(%TicketItem{} = item) do
    %{
      id: item.id,
      order_item_id: item.order_item_id,
      name: item.name_snapshot,
      quantity: H.quantity(item.quantity),
      modifiers: item.modifiers_snapshot,
      note: item.note,
      seat_number: item.seat_number,
      status: item.status,
      display_line: TicketItem.display_line(item)
    }
  end

  def ticket(%Ticket{} = ticket) do
    %{
      id: ticket.id,
      number: ticket.number,
      order_id: ticket.order_id,
      kitchen_station_id: ticket.kitchen_station_id,
      status: ticket.status,
      course: ticket.course,
      table_label: ticket.table_label,
      service_mode: ticket.service_mode,
      server_label: ticket.server_label,
      is_priority: ticket.is_priority,
      notes: ticket.notes,
      fired_at: H.timestamp(ticket.fired_at),
      started_at: H.timestamp(ticket.started_at),
      bumped_at: H.timestamp(ticket.bumped_at),
      recalled_at: H.timestamp(ticket.recalled_at),
      items: H.preloaded(ticket.items, &ticket_item/1)
    }
  end

  @doc """
  One card on the kitchen display.

  The clock is computed here rather than left to the screen: every device in a
  shop has a slightly different idea of the time, and the pass and the kitchen
  disagreeing about how long a table has waited is the argument this is meant
  to prevent.
  """
  def board_entry(entry) do
    %{
      ticket: ticket(entry.ticket),
      station: entry.station && station(entry.station),
      elapsed_minutes: entry.elapsed_minutes,
      minutes_late: entry.minutes_late,
      late: entry.minutes_late > 0
    }
  end

  # --- Deliveries -------------------------------------------------------------

  def delivery(%Delivery{} = delivery) do
    %{
      id: delivery.id,
      number: delivery.number,
      status: delivery.status,
      order_id: delivery.order_id,
      sale_id: delivery.sale_id,
      customer_id: delivery.customer_id,
      customer: H.preloaded(delivery.customer, &SalesSerializers.customer/1),
      rider_user_id: delivery.rider_user_id,
      rider_label: delivery.rider_label,
      address: delivery.address_snapshot,
      phone: delivery.phone_snapshot,
      delivery_notes: delivery.delivery_notes,
      latitude: H.money(delivery.latitude),
      longitude: H.money(delivery.longitude),
      fee: H.money(delivery.fee),
      collected_amount: H.money(delivery.collected_amount),
      promised_at: H.timestamp(delivery.promised_at),
      assigned_at: H.timestamp(delivery.assigned_at),
      picked_up_at: H.timestamp(delivery.picked_up_at),
      delivered_at: H.timestamp(delivery.delivered_at),
      failed_at: H.timestamp(delivery.failed_at),
      failure_reason: delivery.failure_reason,
      minutes_late: Delivery.minutes_late(delivery, DateTime.utc_now())
    }
  end

  def rider_round(round) do
    %{
      rider_user_id: round.rider_user_id,
      rider_label: round.rider_label,
      count: round.count,
      late_count: round.late_count,
      cash_out: H.money(round.cash_out),
      deliveries: Enum.map(round.deliveries, &delivery/1)
    }
  end
end
