defmodule Kaarobar.Kitchen do
  @moduledoc """
  Sending food to be cooked, and knowing when it is up.

  ## Firing is an act, not a queue

  Putting a line on a ticket does not send it. `fire/3` does, and it stamps a
  time — because starters go on order and mains go when the table is ready for
  them, which is a judgement somebody makes at the pass. A kitchen that starts
  everything the moment it is typed sends cold mains.

  ## One order becomes several tickets

  Routed by station, so the grill never reads past the drinks to find its own
  work, and each station bumps independently. That is the entire reason a
  kitchen display exists rather than a printer.

  Lines whose product has no station fall to the branch's first station rather
  than vanishing: a dish nobody routed is still a dish somebody has to cook,
  and silently dropping it is the one failure a kitchen cannot recover from.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Kitchen.Station
  alias Kaarobar.Kitchen.Ticket
  alias Kaarobar.Kitchen.TicketItem
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Sales
  alias Kaarobar.Sales.Order
  alias Kaarobar.Sales.OrderItem
  alias Kaarobar.Scope
  alias Kaarobar.Sequences

  # ===========================================================================
  # Stations
  # ===========================================================================

  @doc "The branch's stations, in display order."
  @spec list_stations(Scope.t()) :: [Station.t()]
  def list_stations(%Scope{} = scope) do
    Station
    |> Scoped.for_branch(scope)
    |> Scoped.active()
    |> order_by([station], asc: station.position, asc: station.name)
    |> Repo.all()
  end

  @doc "Fetches a station."
  @spec fetch_station(Scope.t(), Ecto.UUID.t()) :: {:ok, Station.t()} | {:error, :not_found}
  def fetch_station(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Station
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([station], station.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        station -> {:ok, station}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Creates a station."
  @spec create_station(Scope.t(), map()) :: {:ok, Station.t()} | {:error, Ecto.Changeset.t()}
  def create_station(%Scope{} = scope, attrs) do
    %Station{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> Station.changeset(Map.put_new(stringify(attrs), "branch_id", Scope.branch_id(scope)))
    |> Repo.insert()
  end

  @doc "Updates a station."
  @spec update_station(Scope.t(), Station.t(), map()) ::
          {:ok, Station.t()} | {:error, Ecto.Changeset.t()}
  def update_station(%Scope{}, %Station{} = station, attrs),
    do: station |> Station.changeset(attrs) |> Repo.update()

  @doc "Soft-deletes a station. Its past tickets stay readable."
  @spec delete_station(Scope.t(), Station.t()) ::
          {:ok, Station.t()} | {:error, Ecto.Changeset.t()}
  def delete_station(%Scope{}, %Station{} = station),
    do: station |> Station.soft_delete_changeset() |> Repo.update()

  # ===========================================================================
  # Firing
  # ===========================================================================

  @doc """
  Sends a course to the kitchen.

  Every held line of that course is routed to its station and one ticket is
  written per station. Lines already fired are skipped, so firing twice is
  harmless — which matters, because at a busy pass somebody will.

  Runs in one transaction: an order half-sent leaves the kitchen cooking a
  meal nobody can account for.
  """
  @spec fire(Scope.t(), Order.t(), keyword()) :: {:ok, [Ticket.t()]} | {:error, term()}
  def fire(%Scope{} = scope, %Order{} = order, opts \\ []) do
    course = Keyword.get(opts, :course, 1)

    Repo.transaction(fn ->
      case do_fire(scope, order, course, opts) do
        {:ok, tickets} -> tickets
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "The courses on a ticket that still have unfired lines."
  @spec pending_courses(Order.t()) :: [pos_integer()]
  def pending_courses(%Order{items: items}) when is_list(items) do
    items
    |> Enum.filter(&OrderItem.held?/1)
    |> Enum.map(& &1.course)
    |> Enum.uniq()
    |> Enum.sort()
  end

  def pending_courses(%Order{}), do: []

  # ===========================================================================
  # The display
  # ===========================================================================

  @doc """
  What is live on a screen, most urgent first.

  Priority tickets jump the queue; everything else is oldest first, because a
  kitchen that works newest-first leaves one table waiting all night.

  ## Options

    * `:station_id` — one station's work.
    * `:display_group` — a shared screen's work.
  """
  @spec board(Scope.t(), keyword()) :: [map()]
  def board(%Scope{} = scope, opts \\ []) do
    now = DateTime.utc_now()
    stations = scope |> list_stations() |> Map.new(&{&1.id, &1})

    Ticket
    |> Scoped.for_branch(scope)
    |> where([ticket], ticket.status in ^Ticket.live_statuses())
    |> filter_station(Keyword.get(opts, :station_id))
    |> filter_group(scope, Keyword.get(opts, :display_group))
    |> order_by([ticket], desc: ticket.is_priority, asc: ticket.fired_at)
    |> preload(:items)
    |> Repo.all()
    |> Enum.map(fn ticket ->
      station = Map.get(stations, ticket.kitchen_station_id)

      %{
        ticket: ticket,
        station: station,
        elapsed_minutes: Ticket.elapsed_minutes(ticket, now),
        minutes_late: Ticket.minutes_late(ticket, station, now)
      }
    end)
  end

  @doc "Fetches a ticket with its lines."
  @spec fetch_ticket(Scope.t(), Ecto.UUID.t()) :: {:ok, Ticket.t()} | {:error, :not_found}
  def fetch_ticket(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Ticket
      |> Scoped.for_business(scope)
      |> where([ticket], ticket.id == ^id)
      |> preload([:items, :kitchen_station])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        ticket -> {:ok, ticket}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Somebody has picked the ticket up."
  @spec start_ticket(Scope.t(), Ticket.t()) :: {:ok, Ticket.t()} | {:error, term()}
  def start_ticket(%Scope{}, %Ticket{} = ticket),
    do: ticket |> Ticket.start_changeset() |> Repo.update()

  @doc "The food is up at the pass. Marks the order lines ready with it."
  @spec mark_ready(Scope.t(), Ticket.t()) :: {:ok, Ticket.t()} | {:error, term()}
  def mark_ready(%Scope{} = scope, %Ticket{} = ticket) do
    Repo.transaction(fn ->
      with {:ok, updated} <- ticket |> Ticket.ready_changeset() |> Repo.update(),
           :ok <- sync_order_items(scope, ticket, :ready) do
        updated
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Clears the ticket from the screen: the food has gone out.

  The order lines are marked served with it, so the floor knows what has landed
  without the kitchen having to tell them twice.
  """
  @spec bump(Scope.t(), Ticket.t()) :: {:ok, Ticket.t()} | {:error, term()}
  def bump(%Scope{} = scope, %Ticket{} = ticket) do
    Repo.transaction(fn ->
      with {:ok, bumped} <- ticket |> Ticket.bump_changeset(Scope.user_id(scope)) |> Repo.update(),
           :ok <- sync_order_items(scope, ticket, :served) do
        Audit.log(scope, "kitchen_ticket.bumped", bumped,
          entity_type: "kitchen_ticket",
          label: bumped.number
        )

        bumped
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Puts a bumped ticket back on the screen.

  Somebody bumps the wrong ticket in every service. The recall is stamped, so a
  station that does it constantly is visible rather than merely annoying.
  """
  @spec recall(Scope.t(), Ticket.t()) :: {:ok, Ticket.t()} | {:error, term()}
  def recall(%Scope{} = scope, %Ticket{} = ticket) do
    with {:ok, recalled} <- ticket |> Ticket.recall_changeset() |> Repo.update() do
      Audit.log(scope, "kitchen_ticket.recalled", recalled,
        entity_type: "kitchen_ticket",
        label: recalled.number
      )

      {:ok, recalled}
    end
  end

  @doc "Marks one dish done without touching the rest of the ticket."
  @spec set_item_status(Scope.t(), Ticket.t(), Ecto.UUID.t(), String.t()) ::
          {:ok, TicketItem.t()} | {:error, term()}
  def set_item_status(%Scope{}, %Ticket{} = ticket, item_id, status) do
    case Enum.find(ticket.items, &(&1.id == item_id)) do
      nil -> {:error, :not_found}
      item -> item |> TicketItem.status_changeset(status) |> Repo.update()
    end
  end

  @doc "Kills every live ticket for an order that has been cancelled."
  @spec cancel_for_order(Scope.t(), Order.t()) :: {:ok, non_neg_integer()}
  def cancel_for_order(%Scope{} = scope, %Order{} = order) do
    {count, _returned} =
      Ticket
      |> Scoped.for_business(scope)
      |> where([ticket], ticket.order_id == ^order.id)
      |> where([ticket], ticket.status in ^Ticket.live_statuses())
      |> Repo.update_all(set: [status: "cancelled"])

    {:ok, count}
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp do_fire(%Scope{} = scope, %Order{} = order, course, opts) do
    {:ok, order} = Sales.fetch_order(scope, order.id)
    stations = list_stations(scope)

    lines =
      order.items
      |> Enum.filter(&(&1.course == course))
      |> Enum.filter(&OrderItem.held?/1)

    cond do
      stations == [] -> {:error, :no_kitchen_stations}
      lines == [] -> {:ok, []}
      true -> write_tickets(scope, order, course, lines, stations, opts)
    end
  end

  defp write_tickets(%Scope{} = scope, order, course, lines, stations, opts) do
    fallback = List.first(stations)
    routing = station_routing(scope, lines, stations, fallback)

    routing
    |> Enum.reduce_while({:ok, []}, fn {station_id, station_lines}, {:ok, acc} ->
      case write_ticket(scope, order, course, station_id, station_lines, opts) do
        {:ok, ticket} -> {:cont, {:ok, [ticket | acc]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, tickets} -> mark_lines_fired(scope, lines, Enum.reverse(tickets))
      {:error, reason} -> {:error, reason}
    end
  end

  # A dish with no station still has to be cooked, so an unrouted line falls to
  # the first station rather than being silently dropped.
  defp station_routing(%Scope{} = scope, lines, stations, fallback) do
    station_ids = MapSet.new(stations, & &1.id)
    variant_stations = variant_station_map(scope, Enum.map(lines, & &1.variant_id))

    Enum.group_by(lines, fn line ->
      case Map.get(variant_stations, line.variant_id) do
        nil -> fallback.id
        station_id -> if MapSet.member?(station_ids, station_id), do: station_id, else: fallback.id
      end
    end)
  end

  defp variant_station_map(%Scope{} = scope, variant_ids) do
    from(variant in Kaarobar.Catalog.ProductVariant,
      join: product in assoc(variant, :product),
      where: variant.id in ^variant_ids,
      select: {variant.id, product.kitchen_station_id}
    )
    |> Scoped.for_business(scope)
    |> Repo.all()
    |> Map.new()
  end

  defp write_ticket(%Scope{} = scope, order, course, station_id, lines, opts) do
    with {:ok, number} <- Sequences.next(scope, "kitchen_ticket"),
         {:ok, ticket} <- insert_ticket(scope, order, course, station_id, number, opts) do
      lines
      |> Enum.with_index()
      |> Enum.reduce_while({:ok, ticket}, fn {line, position}, acc ->
        case insert_ticket_item(scope, ticket, line, position) do
          {:ok, _item} -> {:cont, acc}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
    end
  end

  defp insert_ticket(%Scope{} = scope, order, course, station_id, number, opts) do
    %Ticket{}
    |> Ticket.changeset(%{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      branch_id: order.branch_id,
      kitchen_station_id: station_id,
      order_id: order.id,
      number: number,
      course: course,
      table_label: order.label,
      service_mode: order.service_mode,
      server_label: scope.user && scope.user.name,
      is_priority: Keyword.get(opts, :priority, false),
      notes: Keyword.get(opts, :notes),
      fired_at: DateTime.utc_now()
    })
    |> Repo.insert()
  end

  defp insert_ticket_item(%Scope{} = scope, %Ticket{} = ticket, %OrderItem{} = line, position) do
    %TicketItem{}
    |> TicketItem.changeset(%{
      business_id: Scope.business_id(scope),
      kitchen_ticket_id: ticket.id,
      order_item_id: line.id,
      name_snapshot: line.name_snapshot,
      quantity: line.quantity,
      modifiers_snapshot: modifier_labels(line),
      note: line.note,
      seat_number: line.seat_number,
      position: position
    })
    |> Repo.insert()
  end

  defp modifier_labels(%OrderItem{modifiers: modifiers}) when is_list(modifiers),
    do: Enum.map(modifiers, & &1.name_snapshot)

  defp modifier_labels(%OrderItem{}), do: []

  defp mark_lines_fired(%Scope{}, lines, tickets) do
    Enum.each(lines, fn line ->
      {:ok, _fired} = line |> OrderItem.fire_changeset() |> Repo.update()
    end)

    {:ok, tickets}
  end

  # The kitchen and the floor read different tables, so a ticket moving on has
  # to move its order lines with it — otherwise a server checking the ticket
  # sees food that the kitchen has already sent.
  defp sync_order_items(%Scope{} = scope, %Ticket{} = ticket, state) do
    ticket = Repo.preload(ticket, :items)
    item_ids = Enum.map(ticket.items, & &1.order_item_id)

    lines =
      OrderItem
      |> Scoped.for_business(scope)
      |> where([line], line.id in ^item_ids)
      |> Repo.all()

    Enum.each(lines, fn line ->
      changeset =
        case state do
          :ready -> OrderItem.ready_changeset(line)
          :served -> OrderItem.served_changeset(line)
        end

      {:ok, _updated} = Repo.update(changeset)
    end)

    :ok
  end

  defp filter_station(query, nil), do: query

  defp filter_station(query, station_id),
    do: where(query, [ticket], ticket.kitchen_station_id == ^station_id)

  defp filter_group(query, _scope, nil), do: query

  defp filter_group(query, %Scope{} = scope, group) do
    ids =
      scope
      |> list_stations()
      |> Enum.filter(&(Station.screen(&1) == group))
      |> Enum.map(& &1.id)

    where(query, [ticket], ticket.kitchen_station_id in ^ids)
  end

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} ->
      {if(is_atom(key), do: Atom.to_string(key), else: key), value}
    end)
  end
end
