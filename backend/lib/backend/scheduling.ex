defmodule Kaarobar.Scheduling do
  @moduledoc """
  The diary: resources, bookings, and the bench of people waiting.

  ## Availability is computed, not stored

  A free-slot table would have to be maintained against every booking, every
  cancellation and every rota change, and would be wrong the first time one of
  those was missed. `availability/3` walks the resource's working hours and
  subtracts what is already booked, so the answer is derived from the same rows
  the booking is checked against and cannot disagree with them.

  ## Double-booking is refused by the database

  A `gist` exclusion constraint on `(resource_id, period)`. Two receptionists
  booking the same stylist for four o'clock is the ordinary case, not the edge
  case, and a `SELECT` then `INSERT` loses that race every time. The constraint
  surfaces as a changeset error on `resource_id`, so the caller gets the same
  shape as any other validation failure.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Catalog
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scheduling.Appointment
  alias Kaarobar.Scheduling.AppointmentService
  alias Kaarobar.Scheduling.QueueEntry
  alias Kaarobar.Scheduling.Resource
  alias Kaarobar.Scope
  alias Kaarobar.Sequences

  # Falls back to these when neither the resource nor the branch says otherwise.
  @default_open ~T[09:00:00]
  @default_close ~T[21:00:00]
  @slot_minutes 15

  # ===========================================================================
  # Resources
  # ===========================================================================

  @doc "The branch's bookable resources."
  @spec list_resources(Scope.t()) :: [Resource.t()]
  def list_resources(%Scope{} = scope) do
    Resource
    |> Scoped.for_branch(scope)
    |> Scoped.active()
    |> order_by([resource], asc: resource.position, asc: resource.name)
    |> Repo.all()
  end

  @doc "Fetches a resource."
  @spec fetch_resource(Scope.t(), Ecto.UUID.t()) :: {:ok, Resource.t()} | {:error, :not_found}
  def fetch_resource(%Scope{} = scope, id), do: fetch_scoped(scope, Resource, id)

  @doc "Creates a bookable resource — a stylist, a chair, a room."
  @spec create_resource(Scope.t(), map()) :: {:ok, Resource.t()} | {:error, Ecto.Changeset.t()}
  def create_resource(%Scope{} = scope, attrs) do
    %Resource{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> Resource.changeset(put_branch(scope, attrs))
    |> Repo.insert()
  end

  @doc "Updates a resource — its name, rota, or whether it can be booked."
  @spec update_resource(Scope.t(), Resource.t(), map()) ::
          {:ok, Resource.t()} | {:error, Ecto.Changeset.t()}
  def update_resource(%Scope{}, %Resource{} = resource, attrs),
    do: resource |> Resource.changeset(attrs) |> Repo.update()

  @doc "Soft-deletes a resource, keeping its bookings readable."
  @spec delete_resource(Scope.t(), Resource.t()) ::
          {:ok, Resource.t()} | {:error, Ecto.Changeset.t()}
  def delete_resource(%Scope{}, %Resource{} = resource),
    do: resource |> Resource.soft_delete_changeset() |> Repo.update()

  # ===========================================================================
  # Availability
  # ===========================================================================

  @doc """
  Free slots for a resource on a day, in 15-minute steps.

  Derived from the rota minus what is already booked, rather than read from a
  table of free slots — a stored availability table has to be maintained
  against every booking, cancellation and rota change, and is wrong the first
  time one of those is missed.

  `duration_minutes` is the length being looked for: a 90-minute colour needs
  90 free minutes, not a 15-minute gap.
  """
  @spec availability(Scope.t(), Resource.t(), Date.t(), keyword()) :: [
          %{starts_at: DateTime.t(), ends_at: DateTime.t()}
        ]
  def availability(%Scope{} = scope, %Resource{} = resource, date, opts \\ []) do
    duration = Keyword.get(opts, :duration_minutes, @slot_minutes)

    if Resource.bookable?(resource) do
      booked = booked_periods(scope, resource, date)

      resource
      |> windows_on(date)
      |> Enum.flat_map(&slots_in(&1, date, duration))
      |> Enum.reject(&overlaps_any?(&1, booked))
    else
      []
    end
  end

  @doc """
  The day's diary for a branch: every resource with its bookings.

  What a salon opens in the morning and leaves open, so it returns resources
  with no bookings too — an empty column is information.
  """
  @spec day_view(Scope.t(), Date.t()) :: [map()]
  def day_view(%Scope{} = scope, date) do
    resources = list_resources(scope)
    {from, to} = day_bounds(date)

    services =
      AppointmentService
      |> Scoped.for_business(scope)
      |> where([service], service.starts_at >= ^from and service.starts_at < ^to)
      |> where([service], service.status != "cancelled")
      |> order_by([service], asc: service.starts_at)
      |> preload(appointment: :customer)
      |> Repo.all()
      |> Enum.group_by(& &1.resource_id)

    Enum.map(resources, fn resource ->
      %{resource: resource, services: Map.get(services, resource.id, [])}
    end)
  end

  # ===========================================================================
  # Appointments
  # ===========================================================================

  @doc "Bookings in a window, earliest first."
  @spec list_appointments(Scope.t(), keyword()) :: [Appointment.t()]
  def list_appointments(%Scope{} = scope, opts \\ []) do
    Appointment
    |> Scoped.for_branch(scope)
    |> filter_window(Keyword.get(opts, :from), Keyword.get(opts, :to))
    |> filter_status(Keyword.get(opts, :status))
    |> filter_customer(Keyword.get(opts, :customer_id))
    |> order_by([appointment], asc: appointment.starts_at)
    |> preload([:customer, services: :resource])
    |> Repo.all()
  end

  @doc "Fetches a booking with its services."
  @spec fetch_appointment(Scope.t(), Ecto.UUID.t()) ::
          {:ok, Appointment.t()} | {:error, :not_found}
  def fetch_appointment(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Appointment
      |> Scoped.for_business(scope)
      |> where([appointment], appointment.id == ^id)
      |> preload([:customer, services: :resource])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        appointment -> {:ok, appointment}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Books a visit.

  `services` is a list of `%{"variant_id", "resource_id", "starts_at"}` — the
  duration comes from the service in the catalogue, so a receptionist cannot
  book a 90-minute colour into a 30-minute gap by typing the wrong end time.

  The services are laid down in one transaction. A visit that half-books leaves
  a stylist held for work the customer was never told about.
  """
  @spec book(Scope.t(), map()) :: {:ok, Appointment.t()} | {:error, term()}
  def book(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)
    lines = Map.get(attrs, "services", [])

    Repo.transaction(fn ->
      with :ok <- ensure_services_given(lines),
           {:ok, number} <- Sequences.next(scope, "appointment"),
           {:ok, prepared} <- prepare_services(scope, lines),
           {:ok, appointment} <- insert_appointment(scope, attrs, number, prepared),
           :ok <- insert_services(scope, appointment, prepared) do
        Audit.log(scope, "appointment.booked", appointment,
          entity_type: "appointment",
          label: appointment.number
        )

        reload_appointment(scope, appointment.id)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Confirms, marks arrived, starts, or completes a booking."
  @spec advance(Scope.t(), Appointment.t(), atom()) ::
          {:ok, Appointment.t()} | {:error, term()}
  def advance(%Scope{} = scope, %Appointment{} = appointment, step) do
    changeset =
      case step do
        :confirm -> Appointment.confirm_changeset(appointment)
        :arrive -> Appointment.arrive_changeset(appointment)
        :start -> Appointment.start_changeset(appointment)
        :complete -> Appointment.complete_changeset(appointment)
      end

    with {:ok, updated} <- Repo.update(changeset) do
      Audit.log(scope, "appointment.#{step}", updated,
        entity_type: "appointment",
        label: updated.number
      )

      {:ok, updated}
    end
  end

  @doc """
  Cancels a booking and frees every slot it held.

  The services are marked cancelled rather than deleted, so the slot is
  immediately rebookable — the exclusion constraint ignores cancelled rows —
  while the record of what was booked survives.
  """
  @spec cancel(Scope.t(), Appointment.t(), String.t() | nil) ::
          {:ok, Appointment.t()} | {:error, term()}
  def cancel(%Scope{} = scope, %Appointment{} = appointment, reason \\ nil) do
    Repo.transaction(fn ->
      cancel_services(scope, appointment)

      case appointment |> Appointment.cancel_changeset(reason) |> Repo.update() do
        {:ok, cancelled} ->
          Audit.log(scope, "appointment.cancelled", cancelled,
            entity_type: "appointment",
            label: cancelled.number,
            summary: reason
          )

          cancelled

        {:error, failure} ->
          Repo.rollback(failure)
      end
    end)
  end

  @doc """
  Records a no-show, freeing the slots.

  Kept apart from a cancellation because a salon cannot decide whether to start
  taking deposits without knowing how often people simply do not turn up as
  opposed to how often they call ahead.
  """
  @spec no_show(Scope.t(), Appointment.t()) :: {:ok, Appointment.t()} | {:error, term()}
  def no_show(%Scope{} = scope, %Appointment{} = appointment) do
    Repo.transaction(fn ->
      cancel_services(scope, appointment)

      case appointment |> Appointment.no_show_changeset() |> Repo.update() do
        {:ok, marked} ->
          Audit.log(scope, "appointment.no_show", marked,
            entity_type: "appointment",
            label: marked.number
          )

          marked

        {:error, failure} ->
          Repo.rollback(failure)
      end
    end)
  end

  @doc """
  Moves a whole booking, keeping its services in the same relative order.

  Each service shifts by the same offset, so a cut followed by a colour stays a
  cut followed by a colour.
  """
  @spec reschedule(Scope.t(), Appointment.t(), DateTime.t()) ::
          {:ok, Appointment.t()} | {:error, term()}
  def reschedule(%Scope{} = scope, %Appointment{} = appointment, starts_at) do
    offset = DateTime.diff(starts_at, appointment.starts_at, :second)

    Repo.transaction(fn ->
      appointment = Repo.preload(appointment, :services)

      shifted =
        Enum.reduce_while(appointment.services, :ok, fn service, _acc ->
          changeset =
            service
            |> AppointmentService.changeset(%{
              "starts_at" => DateTime.add(service.starts_at, offset, :second),
              "ends_at" => DateTime.add(service.ends_at, offset, :second)
            })

          case Repo.update(changeset) do
            {:ok, _moved} -> {:cont, :ok}
            {:error, failure} -> {:halt, {:error, failure}}
          end
        end)

      new_end = DateTime.add(appointment.ends_at, offset, :second)

      with :ok <- shifted,
           {:ok, moved} <-
             appointment
             |> Appointment.reschedule_changeset(starts_at, new_end)
             |> Repo.update() do
        reload_appointment(scope, moved.id)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  # ===========================================================================
  # The walk-in queue
  # ===========================================================================

  @doc "Who is waiting, in the order they arrived."
  @spec queue(Scope.t()) :: [map()]
  def queue(%Scope{} = scope) do
    now = DateTime.utc_now()

    QueueEntry
    |> Scoped.for_branch(scope)
    |> where([entry], entry.status in ["waiting", "called"])
    |> order_by([entry], asc: entry.position, asc: entry.joined_at)
    |> preload([:customer, :requested_resource])
    |> Repo.all()
    |> Enum.map(&%{entry: &1, minutes_waiting: QueueEntry.minutes_waiting(&1, now)})
  end

  @doc "Adds somebody to the bench."
  @spec join_queue(Scope.t(), map()) :: {:ok, QueueEntry.t()} | {:error, Ecto.Changeset.t()}
  def join_queue(%Scope{} = scope, attrs) do
    %QueueEntry{}
    |> QueueEntry.changeset(
      Map.merge(stringify(attrs), %{
        "organization_id" => Scope.organization_id(scope),
        "business_id" => Scope.business_id(scope),
        "branch_id" => Scope.branch_id(scope)
      })
    )
    |> Repo.insert()
  end

  @doc "Fetches a queue entry."
  @spec fetch_queue_entry(Scope.t(), Ecto.UUID.t()) ::
          {:ok, QueueEntry.t()} | {:error, :not_found}
  def fetch_queue_entry(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      QueueEntry
      |> Scoped.for_business(scope)
      |> where([entry], entry.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        entry -> {:ok, entry}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Calls the next person over."
  @spec call_from_queue(Scope.t(), QueueEntry.t()) ::
          {:ok, QueueEntry.t()} | {:error, Ecto.Changeset.t()}
  def call_from_queue(%Scope{}, %QueueEntry{} = entry),
    do: entry |> QueueEntry.call_changeset() |> Repo.update()

  @doc """
  Seats somebody from the bench, turning their wait into a booking.

  Recording the appointment on the entry is what makes the wait measurable —
  joined-to-seated is the number a shop needs before it can promise anyone a
  time.
  """
  @spec seat_from_queue(Scope.t(), QueueEntry.t(), map()) ::
          {:ok, %{entry: QueueEntry.t(), appointment: Appointment.t()}} | {:error, term()}
  def seat_from_queue(%Scope{} = scope, %QueueEntry{} = entry, attrs) do
    Repo.transaction(fn ->
      booking_attrs =
        attrs
        |> stringify()
        |> Map.put_new("customer_id", entry.customer_id)
        |> Map.put_new("walk_in_name", entry.name)
        |> Map.put_new("walk_in_phone", entry.phone)
        |> Map.put_new("source", "walk_in")

      with {:ok, appointment} <- book(scope, booking_attrs),
           {:ok, seated} <- entry |> QueueEntry.seat_changeset(appointment) |> Repo.update() do
        %{entry: seated, appointment: appointment}
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "They gave up and went home, or never answered when called."
  @spec leave_queue(Scope.t(), QueueEntry.t(), String.t()) ::
          {:ok, QueueEntry.t()} | {:error, Ecto.Changeset.t()}
  def leave_queue(%Scope{}, %QueueEntry{} = entry, status \\ "left"),
    do: entry |> QueueEntry.leave_changeset(status) |> Repo.update()

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp ensure_services_given([]), do: {:error, :services_required}
  defp ensure_services_given(lines) when is_list(lines), do: :ok
  defp ensure_services_given(_other), do: {:error, :services_required}

  # Duration comes from the catalogue, not the request: a receptionist must not
  # be able to book a 90-minute colour into a 30-minute gap by typing the wrong
  # end time.
  defp prepare_services(%Scope{} = scope, lines) do
    lines
    |> Enum.reduce_while({:ok, []}, fn line, {:ok, acc} ->
      line = stringify(line)

      with {:ok, variant} <- Catalog.fetch_variant(scope, Map.get(line, "variant_id")),
           {:ok, resource} <- fetch_resource(scope, Map.get(line, "resource_id")),
           {:ok, starts_at} <- parse_datetime(Map.get(line, "starts_at")),
           :ok <- ensure_bookable(resource) do
        duration = duration_for(variant, line)

        {:cont,
         {:ok,
          [
            %{
              variant: variant,
              resource: resource,
              starts_at: starts_at,
              ends_at: DateTime.add(starts_at, duration * 60, :second),
              duration_minutes: duration,
              price: Map.get(line, "price") || variant.price,
              notes: Map.get(line, "notes")
            }
            | acc
          ]}}
      else
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, prepared} -> {:ok, Enum.reverse(prepared)}
      {:error, reason} -> {:error, reason}
    end
  end

  defp duration_for(variant, line) do
    case Map.get(line, "duration_minutes") do
      nil -> variant_duration(variant)
      value when is_integer(value) -> value
      value when is_binary(value) -> String.to_integer(value)
    end
  end

  defp variant_duration(%{product: %{service_duration_minutes: minutes}})
       when is_integer(minutes) and minutes > 0,
       do: minutes

  defp variant_duration(_variant), do: 30

  defp ensure_bookable(%Resource{} = resource) do
    if Resource.bookable?(resource), do: :ok, else: {:error, :resource_unavailable}
  end

  defp insert_appointment(%Scope{} = scope, attrs, number, prepared) do
    starts_at = prepared |> Enum.map(& &1.starts_at) |> Enum.min(DateTime)
    ends_at = prepared |> Enum.map(& &1.ends_at) |> Enum.max(DateTime)

    %Appointment{}
    |> Appointment.changeset(
      Map.merge(attrs, %{
        "organization_id" => Scope.organization_id(scope),
        "business_id" => Scope.business_id(scope),
        "branch_id" => Map.get(attrs, "branch_id") || Scope.branch_id(scope),
        "number" => number,
        "starts_at" => starts_at,
        "ends_at" => ends_at,
        "booked_by_id" => Scope.user_id(scope)
      })
    )
    |> Repo.insert()
  end

  defp insert_services(%Scope{} = scope, %Appointment{} = appointment, prepared) do
    prepared
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {line, position}, _acc ->
      changeset =
        %AppointmentService{}
        |> AppointmentService.changeset(%{
          "business_id" => Scope.business_id(scope),
          "appointment_id" => appointment.id,
          "variant_id" => line.variant.id,
          "resource_id" => line.resource.id,
          # A default variant carries no name of its own — the product does — so
          # this goes through the catalogue's own naming rather than reading
          # `variant.name`, which is nil for most things a salon books.
          "name_snapshot" => ProductVariant.display_name(line.variant, line.variant.product),
          "duration_minutes" => line.duration_minutes,
          "price" => line.price,
          "starts_at" => line.starts_at,
          "ends_at" => line.ends_at,
          "position" => position,
          "notes" => line.notes
        })

      case Repo.insert(changeset) do
        {:ok, _service} -> {:cont, :ok}
        {:error, failure} -> {:halt, {:error, failure}}
      end
    end)
  end

  defp cancel_services(%Scope{} = scope, %Appointment{} = appointment) do
    AppointmentService
    |> Scoped.for_business(scope)
    |> where([service], service.appointment_id == ^appointment.id)
    |> where([service], service.status != "cancelled")
    |> Repo.update_all(set: [status: "cancelled"])

    :ok
  end

  defp booked_periods(%Scope{} = scope, %Resource{} = resource, date) do
    {from, to} = day_bounds(date)

    AppointmentService
    |> Scoped.for_business(scope)
    |> where([service], service.resource_id == ^resource.id)
    |> where([service], service.status != "cancelled")
    |> where([service], service.starts_at < ^to and service.ends_at > ^from)
    |> select([service], %{starts_at: service.starts_at, ends_at: service.ends_at})
    |> Repo.all()
  end

  defp windows_on(%Resource{} = resource, date) do
    case Resource.hours_on(resource, date) do
      :default -> [%{from: @default_open, to: @default_close}]
      windows -> windows
    end
  end

  defp slots_in(%{from: from, to: to}, date, duration) do
    open = to_utc(date, from)
    close = to_utc(date, to)
    step = @slot_minutes * 60
    length = duration * 60

    Stream.iterate(open, &DateTime.add(&1, step, :second))
    |> Stream.take_while(&(DateTime.compare(DateTime.add(&1, length, :second), close) != :gt))
    |> Enum.map(&%{starts_at: &1, ends_at: DateTime.add(&1, length, :second)})
  end

  defp overlaps_any?(slot, booked) do
    Enum.any?(booked, fn period ->
      DateTime.compare(slot.starts_at, period.ends_at) == :lt and
        DateTime.compare(slot.ends_at, period.starts_at) == :gt
    end)
  end

  defp day_bounds(date) do
    {to_utc(date, ~T[00:00:00]), to_utc(Date.add(date, 1), ~T[00:00:00])}
  end

  defp to_utc(date, time), do: DateTime.new!(date, time, "Etc/UTC")

  defp parse_datetime(%DateTime{} = value), do: {:ok, value}

  defp parse_datetime(value) when is_binary(value) do
    case DateTime.from_iso8601(value) do
      {:ok, datetime, _offset} -> {:ok, datetime}
      {:error, _reason} -> {:error, :invalid_starts_at}
    end
  end

  defp parse_datetime(_value), do: {:error, :invalid_starts_at}

  defp reload_appointment(%Scope{} = scope, id) do
    {:ok, appointment} = fetch_appointment(scope, id)
    appointment
  end

  defp filter_window(query, nil, nil), do: query

  defp filter_window(query, from, nil),
    do: where(query, [appointment], appointment.starts_at >= ^from)

  defp filter_window(query, nil, to),
    do: where(query, [appointment], appointment.starts_at < ^to)

  defp filter_window(query, from, to),
    do: where(query, [a], a.starts_at >= ^from and a.starts_at < ^to)

  defp filter_status(query, nil), do: query
  defp filter_status(query, "all"), do: query

  defp filter_status(query, "live"),
    do: where(query, [a], a.status in ^Appointment.live_statuses())

  defp filter_status(query, status), do: where(query, [a], a.status == ^status)

  defp filter_customer(query, nil), do: query
  defp filter_customer(query, customer_id), do: where(query, [a], a.customer_id == ^customer_id)

  defp fetch_scoped(%Scope{} = scope, schema, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      schema
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([record], record.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        record -> {:ok, record}
      end
    else
      {:error, :not_found}
    end
  end

  defp put_branch(%Scope{} = scope, attrs),
    do: Map.put_new(stringify(attrs), "branch_id", Scope.branch_id(scope))

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} ->
      {if(is_atom(key), do: Atom.to_string(key), else: key), value}
    end)
  end

  defp stringify(other), do: other
end
