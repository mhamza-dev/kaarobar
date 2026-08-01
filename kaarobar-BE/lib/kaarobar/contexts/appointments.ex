defmodule Kaarobar.Appointments do
  @moduledoc """
  Scheduling & appointments (SCH-FR-001–005, CUS-FR-005).

  Gated by `Business.appointments_enabled` (auto-on for `salon` industry).
  Soft staff overlap conflict check implements SCH-FR-002.
  """

  import Ecto.Query

  alias Kaarobar.Repo
  alias Kaarobar.Pos
  alias Kaarobar.Inventory
  alias Kaarobar.Schemas.{
    Appointment,
    Branch,
    Business,
    Customer,
    Employee,
    Product,
    ProductBranchPrice
  }

  @active_statuses ~w(Booked CheckedIn InProgress)
  @terminal_statuses ~w(Completed Cancelled NoShow)
  @all_statuses ~w(Booked CheckedIn InProgress Completed Cancelled NoShow)
  @service_kinds ~w(service combo)
  @default_slot_step_minutes 15
  @day_start_hour 9
  @day_end_hour 18

  ## —— Gate ——————————————————————————————————————————————————————

  def appointments_enabled?(%Business{appointments_enabled: true}), do: true

  def appointments_enabled?(%Business{industry: industry}) when industry in ~w(salon), do: true

  def appointments_enabled?(%Business{}), do: false

  def appointments_enabled?(business_id) when is_binary(business_id) do
    case Repo.get(Business, business_id) do
      %Business{} = b -> appointments_enabled?(b)
      _ -> false
    end
  end

  def appointments_enabled?(_), do: false

  defp require_enabled(business_id) do
    case Repo.get(Business, business_id) do
      %Business{} = b ->
        if appointments_enabled?(b), do: {:ok, b}, else: {:error, :appointments_disabled}

      nil ->
        {:error, :business_not_found}
    end
  end

  ## —— Queries ———————————————————————————————————————————————————

  def list_appointments(business_id, owner_id, opts \\ []) do
    status = blank_to_nil(opts[:status])
    staff_id = blank_to_nil(opts[:staff_id])
    customer_id = blank_to_nil(opts[:customer_id])
    branch_id = blank_to_nil(opts[:branch_id])
    from_at = opts[:from]
    to_at = opts[:to]

    query =
      from(a in Appointment,
        where: a.business_id == ^business_id and a.owner_id == ^owner_id,
        order_by: [asc: a.starts_at],
        preload: [:customer, :product, :staff, :branch, :sale]
      )

    query = if is_binary(status), do: where(query, [a], a.status == ^status), else: query
    query = if is_binary(staff_id), do: where(query, [a], a.staff_id == ^staff_id), else: query

    query =
      if is_binary(customer_id), do: where(query, [a], a.customer_id == ^customer_id), else: query

    query = if is_binary(branch_id), do: where(query, [a], a.branch_id == ^branch_id), else: query

    query =
      if match?(%DateTime{}, from_at),
        do: where(query, [a], a.starts_at >= ^from_at),
        else: query

    query =
      if match?(%DateTime{}, to_at), do: where(query, [a], a.starts_at <= ^to_at), else: query

    Repo.all(query)
  end

  def get_appointment(id, owner_id) do
    Appointment
    |> where([a], a.id == ^id and a.owner_id == ^owner_id)
    |> preload([:customer, :product, :staff, :branch, :sale])
    |> Repo.one()
  end

  def get_appointment_for_customer(id, customer_ids) when is_list(customer_ids) do
    Appointment
    |> where([a], a.id == ^id and a.customer_id in ^customer_ids)
    |> preload([:customer, :product, :staff, :branch, :sale, :business])
    |> Repo.one()
  end

  def staff_day_schedule(business_id, owner_id, staff_id, %Date{} = date) do
    {from_at, to_at} = day_bounds(date)

    list_appointments(business_id, owner_id,
      staff_id: staff_id,
      from: from_at,
      to: to_at
    )
  end

  ## —— Slots (SCH-FR-001) ————————————————————————————————————————

  def list_slots(business_id, owner_id, attrs) do
    with {:ok, _business} <- require_enabled(business_id),
         {:ok, product} <- fetch_service(business_id, owner_id, attrs[:product_id] || attrs["product_id"]),
         {:ok, staff} <- fetch_staff(business_id, owner_id, attrs[:staff_id] || attrs["staff_id"]),
         {:ok, branch} <-
           fetch_branch(business_id, owner_id, attrs[:branch_id] || attrs["branch_id"]),
         {:ok, date} <- parse_date(attrs[:date] || attrs["date"]) do
      duration = product.duration_minutes || 30
      {day_start, day_end} = working_hours(date)
      existing = staff_day_schedule(business_id, owner_id, staff.id, date)

      slots =
        generate_slots(day_start, day_end, duration, @default_slot_step_minutes)
        |> Enum.reject(fn {starts, ends} ->
          Enum.any?(existing, fn appt ->
            appt.status in @active_statuses and overlaps?(starts, ends, appt.starts_at, appt.ends_at)
          end)
        end)
        |> Enum.map(fn {starts, ends} ->
          %{
            starts_at: DateTime.to_iso8601(starts),
            ends_at: DateTime.to_iso8601(ends),
            staff_id: staff.id,
            product_id: product.id,
            branch_id: branch.id,
            duration_minutes: duration
          }
        end)

      {:ok, slots}
    end
  end

  ## —— Book / cancel / reschedule (SCH-FR-001/002/004, CUS-FR-005) ——

  def book(business_id, owner_id, attrs) do
    with {:ok, business} <- require_enabled(business_id),
         {:ok, product} <- fetch_service(business_id, owner_id, attrs[:product_id] || attrs["product_id"]),
         {:ok, staff} <- fetch_staff(business_id, owner_id, attrs[:staff_id] || attrs["staff_id"]),
         {:ok, branch} <-
           fetch_branch(business_id, owner_id, attrs[:branch_id] || attrs["branch_id"]),
         {:ok, starts_at} <- parse_dt(attrs[:starts_at] || attrs["starts_at"]),
         {:ok, ends_at} <- resolve_ends_at(starts_at, product, attrs),
         :ok <- ensure_no_conflict(staff.id, starts_at, ends_at),
         {:ok, customer_id} <- optional_customer(business_id, owner_id, attrs) do
      %Appointment{}
      |> Appointment.changeset(%{
        owner_id: owner_id,
        business_id: business.id,
        branch_id: branch.id,
        product_id: product.id,
        staff_id: staff.id,
        customer_id: customer_id,
        starts_at: starts_at,
        ends_at: ends_at,
        status: "Booked",
        notes: blank_to_nil(attrs[:notes] || attrs["notes"]),
        booked_by: blank_to_nil(attrs[:booked_by] || attrs["booked_by"]) || "staff"
      })
      |> Repo.insert()
      |> case do
        {:ok, appt} -> {:ok, preload(appt)}
        error -> error
      end
    end
  end

  def cancel(%Appointment{} = appt, opts \\ []) do
    if appt.status in @terminal_statuses do
      {:error, :invalid_transition}
    else
      actor = Keyword.get(opts, :actor, :staff)

      if actor == :customer and appt.status not in ~w(Booked) do
        {:error, :invalid_transition}
      else
        appt
        |> Appointment.changeset(%{status: "Cancelled"})
        |> Repo.update()
        |> case do
          {:ok, updated} -> {:ok, preload(updated)}
          error -> error
        end
      end
    end
  end

  def reschedule(%Appointment{} = appt, attrs) do
    if appt.status not in ~w(Booked CheckedIn) do
      {:error, :invalid_transition}
    else
      with {:ok, starts_at} <- parse_dt(attrs[:starts_at] || attrs["starts_at"]),
           product <- appt.product || Repo.get(Product, appt.product_id),
           {:ok, ends_at} <- resolve_ends_at(starts_at, product, attrs),
           staff_id <- blank_to_nil(attrs[:staff_id] || attrs["staff_id"]) || appt.staff_id,
           {:ok, staff} <- fetch_staff(appt.business_id, appt.owner_id, staff_id),
           :ok <- ensure_no_conflict(staff.id, starts_at, ends_at, exclude_id: appt.id) do
        appt
        |> Appointment.changeset(%{
          starts_at: starts_at,
          ends_at: ends_at,
          staff_id: staff.id,
          status: "Booked"
        })
        |> Repo.update()
        |> case do
          {:ok, updated} -> {:ok, preload(updated)}
          error -> error
        end
      end
    end
  end

  def transition(%Appointment{} = appt, status) when status in @all_statuses do
    do_transition(appt, status)
  end

  def transition(%Appointment{}, _), do: {:error, :invalid_status}

  defp do_transition(appt, "Cancelled"), do: cancel(appt)

  defp do_transition(appt, "Completed") do
    with {:ok, updated} <- apply_transition(appt, "Completed"),
         {:ok, with_sale} <- maybe_create_linked_sale(updated) do
      {:ok, with_sale}
    end
  end

  defp do_transition(appt, status) do
    apply_transition(appt, status)
  end

  defp apply_transition(appt, status) do
    allowed = transitions(appt.status)

    if status in allowed do
      appt
      |> Appointment.changeset(%{status: status})
      |> Repo.update()
      |> case do
        {:ok, updated} -> {:ok, preload(updated)}
        error -> error
      end
    else
      {:error, :invalid_transition}
    end
  end

  defp transitions("Booked"), do: ~w(CheckedIn Cancelled NoShow)
  defp transitions("CheckedIn"), do: ~w(InProgress Cancelled NoShow)
  defp transitions("InProgress"), do: ~w(Completed Cancelled)
  defp transitions(_), do: []

  ## —— SCH-FR-005 linked sale stub ——————————————————————————————

  defp maybe_create_linked_sale(%Appointment{sale_id: id} = appt) when is_binary(id),
    do: {:ok, appt}

  defp maybe_create_linked_sale(%Appointment{} = appt) do
    appt = preload(appt)
    product = appt.product
    staff = appt.staff

    price =
      case Repo.get_by(ProductBranchPrice,
             product_id: product.id,
             branch_id: appt.branch_id
           ) do
        %{price: p} -> p
        _ -> Decimal.new("0")
      end

    cashier_id = (staff && staff.user_id) || appt.owner_id

    if is_nil(Repo.get_by(ProductBranchPrice, product_id: product.id, branch_id: appt.branch_id)) do
      _ =
        Inventory.set_branch_price(
          product.id,
          appt.branch_id,
          appt.owner_id,
          appt.business_id,
          to_string(price)
        )
    end

    attrs = %{
      client_txn_id: Ecto.UUID.generate(),
      customer_id: appt.customer_id,
      items: [%{product_id: product.id, quantity: "1"}],
      discount_amount: "0",
      notes: "Appointment #{appt.id}",
      payments: [%{method: "cash", amount: to_string(price)}]
    }

    case Pos.create_sale(appt.branch_id, appt.owner_id, appt.business_id, cashier_id, attrs) do
      {:ok, sale} ->
        appt
        |> Appointment.changeset(%{sale_id: sale.id})
        |> Repo.update()
        |> case do
          {:ok, updated} -> {:ok, preload(updated)}
          error -> error
        end

      {:error, _reason} ->
        # SCH-FR-005 stub: completion succeeds even if linked sale fails
        {:ok, appt}
    end
  end

  ## —— Conflict (SCH-FR-002) —————————————————————————————————————

  def ensure_no_conflict(staff_id, starts_at, ends_at, opts \\ []) do
    exclude_id = Keyword.get(opts, :exclude_id)

    query =
      from(a in Appointment,
        where:
          a.staff_id == ^staff_id and a.status in ^@active_statuses and
            a.starts_at < ^ends_at and a.ends_at > ^starts_at
      )

    query =
      if is_binary(exclude_id), do: where(query, [a], a.id != ^exclude_id), else: query

    if Repo.exists?(query), do: {:error, :conflict}, else: :ok
  end

  defp overlaps?(s1, e1, s2, e2) do
    DateTime.compare(s1, e2) == :lt and DateTime.compare(e1, s2) == :gt
  end

  ## —— Helpers ———————————————————————————————————————————————————

  def serialize(%Appointment{} = a) do
    %{
      id: a.id,
      business_id: a.business_id,
      branch_id: a.branch_id,
      customer_id: a.customer_id,
      product_id: a.product_id,
      staff_id: a.staff_id,
      sale_id: a.sale_id,
      starts_at: a.starts_at && DateTime.to_iso8601(a.starts_at),
      ends_at: a.ends_at && DateTime.to_iso8601(a.ends_at),
      status: a.status,
      notes: a.notes,
      booked_by: a.booked_by,
      customer_name: a.customer && a.customer.name,
      product_name: a.product && a.product.name,
      staff_name: a.staff && a.staff.name,
      business_name: a.business && a.business.name,
      duration_minutes: a.product && a.product.duration_minutes
    }
  end

  defp preload(appt),
    do: Repo.preload(appt, [:customer, :product, :staff, :branch, :sale, :business])

  defp fetch_service(business_id, owner_id, product_id) do
    case Repo.get_by(Product, id: product_id, business_id: business_id, owner_id: owner_id) do
      %Product{product_kind: kind, is_active: true} = p when kind in @service_kinds ->
        {:ok, p}

      %Product{} ->
        {:error, :invalid_service}

      nil ->
        {:error, :product_not_found}
    end
  end

  defp fetch_staff(business_id, owner_id, staff_id) do
    case Repo.get_by(Employee,
           id: staff_id,
           business_id: business_id,
           owner_id: owner_id,
           status: "active"
         ) do
      %Employee{} = e -> {:ok, e}
      nil -> {:error, :staff_not_found}
    end
  end

  defp fetch_branch(business_id, owner_id, branch_id) do
    case Repo.get_by(Branch, id: branch_id, business_id: business_id, owner_id: owner_id) do
      %Branch{is_active: true} = b -> {:ok, b}
      %Branch{} -> {:error, :branch_inactive}
      nil -> {:error, :branch_not_found}
    end
  end

  defp optional_customer(business_id, owner_id, attrs) do
    customer_id = blank_to_nil(attrs[:customer_id] || attrs["customer_id"])

    if is_nil(customer_id) do
      {:ok, nil}
    else
      case Repo.get_by(Customer,
             id: customer_id,
             business_id: business_id,
             owner_id: owner_id
           ) do
        %Customer{} = c -> {:ok, c.id}
        nil -> {:error, :customer_not_found}
      end
    end
  end

  defp resolve_ends_at(starts_at, product, attrs) do
    case blank_to_nil(attrs[:ends_at] || attrs["ends_at"]) do
      nil ->
        mins = product.duration_minutes || 30
        {:ok, DateTime.add(starts_at, mins * 60, :second)}

      raw ->
        parse_dt(raw)
    end
  end

  defp generate_slots(day_start, day_end, duration_mins, step_mins) do
    duration_secs = duration_mins * 60
    step_secs = step_mins * 60

    Stream.unfold(day_start, fn cursor ->
      ends = DateTime.add(cursor, duration_secs, :second)

      if DateTime.compare(ends, day_end) != :gt do
        {{cursor, ends}, DateTime.add(cursor, step_secs, :second)}
      else
        nil
      end
    end)
    |> Enum.to_list()
  end

  defp working_hours(%Date{} = date) do
    start = DateTime.new!(date, Time.new!(@day_start_hour, 0, 0), "Etc/UTC")
    ending = DateTime.new!(date, Time.new!(@day_end_hour, 0, 0), "Etc/UTC")
    {start, ending}
  end

  defp day_bounds(%Date{} = date) do
    {DateTime.new!(date, ~T[00:00:00], "Etc/UTC"),
     DateTime.new!(date, ~T[23:59:59], "Etc/UTC")}
  end

  defp parse_date(%Date{} = d), do: {:ok, d}

  defp parse_date(str) when is_binary(str) do
    case Date.from_iso8601(String.trim(str)) do
      {:ok, d} -> {:ok, d}
      _ -> {:error, :invalid_date}
    end
  end

  defp parse_date(_), do: {:error, :invalid_date}

  defp parse_dt(%DateTime{} = dt), do: {:ok, DateTime.truncate(dt, :second)}

  defp parse_dt(str) when is_binary(str) do
    str = String.trim(str)

    cond do
      match?({:ok, _, _}, DateTime.from_iso8601(str)) ->
        {:ok, dt, _} = DateTime.from_iso8601(str)
        {:ok, DateTime.truncate(dt, :second)}

      match?({:ok, _}, NaiveDateTime.from_iso8601(str)) ->
        {:ok, ndt} = NaiveDateTime.from_iso8601(str)
        {:ok, DateTime.from_naive!(ndt, "Etc/UTC") |> DateTime.truncate(:second)}

      true ->
        {:error, :invalid_datetime}
    end
  end

  defp parse_dt(_), do: {:error, :invalid_datetime}

  defp blank_to_nil(nil), do: nil
  defp blank_to_nil(""), do: nil

  defp blank_to_nil(v) when is_binary(v) do
    s = String.trim(v)
    if s == "", do: nil, else: s
  end

  defp blank_to_nil(v), do: v
end
