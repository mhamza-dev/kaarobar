defmodule Kaarobar.Appointments do
  @moduledoc """
  Scheduling & appointments (SCH-FR-001–005, CUS-FR-005, FUT-FR-081).

  Gated by `Business.appointments_enabled` (auto-on for `salon` industry).
  Soft staff overlap conflict check implements SCH-FR-002.
  Soft resource overlap with buffers implements FUT-FR-081.
  """

  import Ecto.Query

  alias Kaarobar.Repo
  alias Kaarobar.Pos
  alias Kaarobar.Inventory

  alias Kaarobar.Schemas.{
    Appointment,
    AppointmentResource,
    BookableResource,
    Branch,
    Business,
    Customer,
    CustomerPackagePurchase,
    Employee,
    Product,
    ProductBranchPrice,
    ProductResource,
    ServicePackage
  }

  @active_statuses ~w(Booked CheckedIn InProgress)
  @terminal_statuses ~w(Completed Cancelled NoShow)
  @all_statuses ~w(Booked CheckedIn InProgress Completed Cancelled NoShow)
  @service_kinds ~w(service combo)
  @resource_kinds ~w(room chair equipment)
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

  ## —— Bookable resources CRUD (FUT-FR-081) ——————————————————————

  def list_bookable_resources(business_id, owner_id, opts \\ []) do
    branch_id = blank_to_nil(opts[:branch_id])
    kind = blank_to_nil(opts[:kind])
    active_only? = opts[:active_only] != false

    query =
      from(r in BookableResource,
        where: r.business_id == ^business_id and r.owner_id == ^owner_id,
        order_by: [asc: r.kind, asc: r.name]
      )

    query = if is_binary(branch_id), do: where(query, [r], r.branch_id == ^branch_id), else: query
    query = if is_binary(kind), do: where(query, [r], r.kind == ^kind), else: query
    query = if active_only?, do: where(query, [r], r.is_active == true), else: query

    Repo.all(query)
  end

  def get_bookable_resource(id, business_id, owner_id) do
    Repo.get_by(BookableResource, id: id, business_id: business_id, owner_id: owner_id)
  end

  def create_bookable_resource(business_id, owner_id, attrs) do
    with {:ok, _business} <- require_enabled(business_id),
         {:ok, branch} <-
           fetch_branch(business_id, owner_id, attrs[:branch_id] || attrs["branch_id"]) do
      %BookableResource{}
      |> BookableResource.changeset(%{
        owner_id: owner_id,
        business_id: business_id,
        branch_id: branch.id,
        name: attrs[:name] || attrs["name"],
        kind: attrs[:kind] || attrs["kind"],
        capacity: parse_int(attrs[:capacity] || attrs["capacity"], 1),
        is_active: parse_bool(attrs[:is_active] || attrs["is_active"], true),
        notes: blank_to_nil(attrs[:notes] || attrs["notes"])
      })
      |> Repo.insert()
    end
  end

  def update_bookable_resource(%BookableResource{} = resource, attrs) do
    resource
    |> BookableResource.changeset(%{
      name: attrs[:name] || attrs["name"] || resource.name,
      kind: attrs[:kind] || attrs["kind"] || resource.kind,
      capacity: parse_int(attrs[:capacity] || attrs["capacity"], resource.capacity),
      is_active: parse_bool(attrs[:is_active] || attrs["is_active"], resource.is_active),
      notes:
        if(Map.has_key?(attrs, :notes) or Map.has_key?(attrs, "notes"),
          do: blank_to_nil(attrs[:notes] || attrs["notes"]),
          else: resource.notes
        )
    })
    |> Repo.update()
  end

  def deactivate_bookable_resource(%BookableResource{} = resource) do
    resource
    |> BookableResource.changeset(%{is_active: false})
    |> Repo.update()
  end

  def serialize_bookable_resource(%BookableResource{} = r) do
    %{
      id: r.id,
      business_id: r.business_id,
      branch_id: r.branch_id,
      name: r.name,
      kind: r.kind,
      capacity: r.capacity,
      is_active: r.is_active,
      notes: r.notes
    }
  end

  ## —— Product resource requirements —————————————————————————————

  def list_product_resources(product_id) do
    from(pr in ProductResource,
      where: pr.product_id == ^product_id,
      preload: [:bookable_resource]
    )
    |> Repo.all()
  end

  def sync_product_resources(product_id, requirements) when is_list(requirements) do
    Repo.transaction(fn ->
      from(pr in ProductResource, where: pr.product_id == ^product_id)
      |> Repo.delete_all()

      Enum.each(requirements, fn req ->
        attrs = %{
          product_id: product_id,
          bookable_resource_id:
            blank_to_nil(req[:bookable_resource_id] || req["bookable_resource_id"]),
          resource_kind: blank_to_nil(req[:resource_kind] || req["resource_kind"] || req[:kind] || req["kind"])
        }

        case %ProductResource{} |> ProductResource.changeset(attrs) |> Repo.insert() do
          {:ok, _} -> :ok
          {:error, cs} -> Repo.rollback(cs)
        end
      end)

      list_product_resources(product_id)
    end)
  end

  def sync_product_resources(_product_id, _), do: {:ok, []}

  def serialize_product_resource(%ProductResource{} = pr) do
    %{
      id: pr.id,
      product_id: pr.product_id,
      bookable_resource_id: pr.bookable_resource_id,
      resource_kind: pr.resource_kind,
      bookable_resource:
        pr.bookable_resource && serialize_bookable_resource(pr.bookable_resource)
    }
  end

  ## —— Service packages ——————————————————————————————————————————

  def list_service_packages(business_id, owner_id, opts \\ []) do
    active_only? = opts[:active_only] != false

    query =
      from(p in ServicePackage,
        where: p.business_id == ^business_id and p.owner_id == ^owner_id,
        order_by: [asc: p.name],
        preload: [:product]
      )

    query = if active_only?, do: where(query, [p], p.is_active == true), else: query
    Repo.all(query)
  end

  def create_service_package(business_id, owner_id, attrs) do
    with {:ok, _business} <- require_enabled(business_id),
         {:ok, product} <-
           fetch_service(business_id, owner_id, attrs[:product_id] || attrs["product_id"]) do
      %ServicePackage{}
      |> ServicePackage.changeset(%{
        owner_id: owner_id,
        business_id: business_id,
        product_id: product.id,
        name: attrs[:name] || attrs["name"],
        session_count: parse_int(attrs[:session_count] || attrs["session_count"], 1),
        price: attrs[:price] || attrs["price"],
        is_active: parse_bool(attrs[:is_active] || attrs["is_active"], true)
      })
      |> Repo.insert()
    end
  end

  def serialize_service_package(%ServicePackage{} = p) do
    %{
      id: p.id,
      business_id: p.business_id,
      product_id: p.product_id,
      product_name: p.product && p.product.name,
      name: p.name,
      session_count: p.session_count,
      price: decimal_str(p.price),
      is_active: p.is_active
    }
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
        preload: [
          :customer,
          :product,
          :staff,
          :branch,
          :sale,
          appointment_resources: :bookable_resource
        ]
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
    |> preload([
      :customer,
      :product,
      :staff,
      :branch,
      :sale,
      :deposit_sale,
      :package_purchase,
      appointment_resources: :bookable_resource
    ])
    |> Repo.one()
  end

  def get_appointment_for_customer(id, customer_ids) when is_list(customer_ids) do
    Appointment
    |> where([a], a.id == ^id and a.customer_id in ^customer_ids)
    |> preload([
      :customer,
      :product,
      :staff,
      :branch,
      :sale,
      :business,
      appointment_resources: :bookable_resource
    ])
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
         {:ok, product} <-
           fetch_service(business_id, owner_id, attrs[:product_id] || attrs["product_id"]),
         {:ok, staff} <-
           fetch_staff(business_id, owner_id, attrs[:staff_id] || attrs["staff_id"]),
         {:ok, branch} <-
           fetch_branch(business_id, owner_id, attrs[:branch_id] || attrs["branch_id"]),
         {:ok, date} <- parse_date(attrs[:date] || attrs["date"]) do
      duration = product.duration_minutes || 30
      buffer_before = product.buffer_before_minutes || 0
      buffer_after = product.buffer_after_minutes || 0
      {day_start, day_end} = working_hours(date)
      existing = staff_day_schedule(business_id, owner_id, staff.id, date)
      requirements = list_product_resources(product.id)

      slots =
        generate_slots(day_start, day_end, duration, @default_slot_step_minutes)
        |> Enum.reject(fn {starts, ends} ->
          busy_start = DateTime.add(starts, -buffer_before * 60, :second)
          busy_end = DateTime.add(ends, buffer_after * 60, :second)

          staff_busy? =
            Enum.any?(existing, fn appt ->
              appt.status in @active_statuses and
                overlaps?(
                  busy_start,
                  busy_end,
                  busy_window_start(appt),
                  busy_window_end(appt)
                )
            end)

          resource_busy? =
            requirements != [] and
              match?(
                {:error, _},
                assign_resources(product, branch.id, business_id, owner_id, starts, ends,
                  buffer_before: buffer_before,
                  buffer_after: buffer_after
                )
              )

          staff_busy? or resource_busy?
        end)
        |> Enum.map(fn {starts, ends} ->
          %{
            starts_at: DateTime.to_iso8601(starts),
            ends_at: DateTime.to_iso8601(ends),
            staff_id: staff.id,
            product_id: product.id,
            branch_id: branch.id,
            duration_minutes: duration,
            buffer_before_minutes: buffer_before,
            buffer_after_minutes: buffer_after,
            deposit_amount: decimal_str(product.deposit_amount)
          }
        end)

      {:ok, slots}
    end
  end

  ## —— Book / cancel / reschedule (SCH-FR-001/002/004, CUS-FR-005, FUT-FR-081) ——

  def book(business_id, owner_id, attrs) do
    with {:ok, business} <- require_enabled(business_id),
         {:ok, product} <-
           fetch_service(business_id, owner_id, attrs[:product_id] || attrs["product_id"]),
         {:ok, staff} <-
           fetch_staff(business_id, owner_id, attrs[:staff_id] || attrs["staff_id"]),
         {:ok, branch} <-
           fetch_branch(business_id, owner_id, attrs[:branch_id] || attrs["branch_id"]),
         {:ok, starts_at} <- parse_dt(attrs[:starts_at] || attrs["starts_at"]),
         {:ok, ends_at} <- resolve_ends_at(starts_at, product, attrs),
         buffer_before <- product.buffer_before_minutes || 0,
         buffer_after <- product.buffer_after_minutes || 0,
         busy_start <- DateTime.add(starts_at, -buffer_before * 60, :second),
         busy_end <- DateTime.add(ends_at, buffer_after * 60, :second),
         :ok <- ensure_no_conflict(staff.id, busy_start, busy_end),
         {:ok, resources} <-
           assign_resources(product, branch.id, business_id, owner_id, starts_at, ends_at,
             buffer_before: buffer_before,
             buffer_after: buffer_after,
             preferred_ids: preferred_resource_ids(attrs)
           ),
         {:ok, customer_id} <- optional_customer(business_id, owner_id, attrs),
         {:ok, package_meta} <-
           maybe_redeem_package(business_id, owner_id, customer_id, product.id, attrs) do
      deposit = product.deposit_amount
      deposit_status = if positive_decimal?(deposit), do: "due", else: "none"

      Repo.transaction(fn ->
        case %Appointment{}
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
               booked_by: blank_to_nil(attrs[:booked_by] || attrs["booked_by"]) || "staff",
               buffer_before_minutes: buffer_before,
               buffer_after_minutes: buffer_after,
               deposit_amount: deposit,
               deposit_status: deposit_status,
               package_purchase_id: package_meta[:package_purchase_id],
               package_session_index: package_meta[:package_session_index]
             })
             |> Repo.insert() do
          {:ok, appt} ->
            Enum.each(resources, fn resource ->
              %AppointmentResource{}
              |> AppointmentResource.changeset(%{
                appointment_id: appt.id,
                bookable_resource_id: resource.id
              })
              |> Repo.insert!()
            end)

            preload(appt)

          {:error, cs} ->
            Repo.rollback(cs)
        end
      end)
      |> case do
        {:ok, appt} -> {:ok, appt}
        {:error, reason} -> {:error, reason}
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
           buffer_before <- appt.buffer_before_minutes || product.buffer_before_minutes || 0,
           buffer_after <- appt.buffer_after_minutes || product.buffer_after_minutes || 0,
           busy_start <- DateTime.add(starts_at, -buffer_before * 60, :second),
           busy_end <- DateTime.add(ends_at, buffer_after * 60, :second),
           :ok <- ensure_no_conflict(staff.id, busy_start, busy_end, exclude_id: appt.id),
           {:ok, resources} <-
             assign_resources(
               product,
               appt.branch_id,
               appt.business_id,
               appt.owner_id,
               starts_at,
               ends_at,
               buffer_before: buffer_before,
               buffer_after: buffer_after,
               preferred_ids: preferred_resource_ids(attrs),
               exclude_appointment_id: appt.id
             ) do
        Repo.transaction(fn ->
          case appt
               |> Appointment.changeset(%{
                 starts_at: starts_at,
                 ends_at: ends_at,
                 staff_id: staff.id,
                 status: "Booked",
                 buffer_before_minutes: buffer_before,
                 buffer_after_minutes: buffer_after
               })
               |> Repo.update() do
            {:ok, updated} ->
              from(ar in AppointmentResource, where: ar.appointment_id == ^updated.id)
              |> Repo.delete_all()

              Enum.each(resources, fn resource ->
                %AppointmentResource{}
                |> AppointmentResource.changeset(%{
                  appointment_id: updated.id,
                  bookable_resource_id: resource.id
                })
                |> Repo.insert!()
              end)

              preload(updated)

            {:error, cs} ->
              Repo.rollback(cs)
          end
        end)
        |> case do
          {:ok, updated} -> {:ok, updated}
          {:error, reason} -> {:error, reason}
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
         {:ok, with_deposit} <- maybe_apply_deposit(updated),
         {:ok, with_sale} <- maybe_create_linked_sale(with_deposit) do
      {:ok, with_sale}
    end
  end

  defp do_transition(appt, "NoShow") do
    with {:ok, updated} <- apply_transition(appt, "NoShow"),
         {:ok, with_fee} <- maybe_create_no_show_fee(updated),
         {:ok, with_deposit} <- maybe_forfeit_deposit(with_fee) do
      {:ok, with_deposit}
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

  ## —— Deposit (FUT-FR-081) ——————————————————————————————————————

  def mark_deposit_paid(%Appointment{} = appt) do
    appt = preload(appt)

    cond do
      appt.deposit_status != "due" ->
        {:error, :invalid_deposit_status}

      not positive_decimal?(appt.deposit_amount) ->
        {:error, :no_deposit_due}

      true ->
        amount = appt.deposit_amount
        cashier_id = (appt.staff && appt.staff.user_id) || appt.owner_id

        branch_price =
          case Repo.get_by(ProductBranchPrice,
                 product_id: appt.product_id,
                 branch_id: appt.branch_id
               ) do
            %{price: p} -> p
            _ -> amount
          end

        # Charge deposit only: discount the branch-priced line down to deposit amount
        discount =
          if Decimal.compare(branch_price, amount) == :lt do
            Decimal.new("0")
          else
            Decimal.sub(branch_price, amount)
          end

        pay_amount =
          if Decimal.compare(branch_price, amount) == :lt, do: branch_price, else: amount

        attrs = %{
          client_txn_id: Ecto.UUID.generate(),
          customer_id: appt.customer_id,
          items: [%{product_id: appt.product_id, quantity: "1"}],
          discount_amount: to_string(discount),
          notes: "Deposit for appointment #{appt.id}",
          payments: [%{method: "cash", amount: to_string(pay_amount)}],
          internal_fee_sale: true
        }

        case Pos.create_sale(appt.branch_id, appt.owner_id, appt.business_id, cashier_id, attrs) do
          {:ok, sale} ->
            appt
            |> Appointment.changeset(%{deposit_status: "paid", deposit_sale_id: sale.id})
            |> Repo.update()
            |> case do
              {:ok, updated} -> {:ok, preload(updated)}
              error -> error
            end

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

  defp maybe_apply_deposit(%Appointment{deposit_status: "paid"} = appt) do
    appt
    |> Appointment.changeset(%{deposit_status: "applied"})
    |> Repo.update()
    |> case do
      {:ok, updated} -> {:ok, preload(updated)}
      error -> error
    end
  end

  defp maybe_apply_deposit(appt), do: {:ok, appt}

  defp maybe_forfeit_deposit(%Appointment{deposit_status: "paid"} = appt) do
    appt
    |> Appointment.changeset(%{deposit_status: "forfeited"})
    |> Repo.update()
    |> case do
      {:ok, updated} -> {:ok, preload(updated)}
      error -> error
    end
  end

  defp maybe_forfeit_deposit(appt), do: {:ok, appt}

  ## —— SCH-FR-005 linked sale + FUT-FR-081 no-show fee ——————————

  defp maybe_create_linked_sale(%Appointment{sale_id: id} = appt) when is_binary(id),
    do: {:ok, appt}

  defp maybe_create_linked_sale(%Appointment{package_purchase_id: id} = appt)
       when is_binary(id),
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

    discount =
      if appt.deposit_status in ~w(paid applied) and positive_decimal?(appt.deposit_amount) do
        deposit = appt.deposit_amount

        if Decimal.compare(price, deposit) == :lt, do: price, else: deposit
      else
        Decimal.new("0")
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

    pay_amount = max_dec(Decimal.sub(price, discount), Decimal.new("0"))

    attrs = %{
      client_txn_id: Ecto.UUID.generate(),
      customer_id: appt.customer_id,
      items: [%{product_id: product.id, quantity: "1"}],
      discount_amount: to_string(discount),
      notes: "Appointment #{appt.id}",
      payments: [%{method: "cash", amount: to_string(pay_amount)}],
      internal_fee_sale: positive_decimal?(discount)
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

  defp maybe_create_no_show_fee(%Appointment{} = appt) do
    appt = preload(appt)
    product = appt.product
    fee = product && product.no_show_fee_amount

    if positive_decimal?(fee) do
      staff = appt.staff
      cashier_id = (staff && staff.user_id) || appt.owner_id

      branch_price =
        case Repo.get_by(ProductBranchPrice,
               product_id: product.id,
               branch_id: appt.branch_id
             ) do
          %{price: p} -> p
          _ -> fee
        end

      discount =
        if Decimal.compare(branch_price, fee) == :lt do
          Decimal.new("0")
        else
          Decimal.sub(branch_price, fee)
        end

      pay_amount = if Decimal.compare(branch_price, fee) == :lt, do: branch_price, else: fee

      attrs = %{
        client_txn_id: Ecto.UUID.generate(),
        customer_id: appt.customer_id,
        items: [%{product_id: product.id, quantity: "1"}],
        discount_amount: to_string(discount),
        notes: "No-show fee for appointment #{appt.id}",
        payments: [%{method: "cash", amount: to_string(pay_amount)}],
        internal_fee_sale: true
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
          {:ok, appt}
      end
    else
      {:ok, appt}
    end
  end

  ## —— Conflict (SCH-FR-002 + FUT-FR-081) ————————————————————————

  def ensure_no_conflict(staff_id, starts_at, ends_at, opts \\ []) do
    exclude_id = Keyword.get(opts, :exclude_id)
    # Widen SQL so buffer snapshots on either side still get loaded
    margin = 3 * 60 * 60
    q_start = DateTime.add(starts_at, -margin, :second)
    q_end = DateTime.add(ends_at, margin, :second)

    query =
      from(a in Appointment,
        where:
          a.staff_id == ^staff_id and a.status in ^@active_statuses and
            a.starts_at < ^q_end and a.ends_at > ^q_start
      )

    conflicting =
      query
      |> then(fn q ->
        if is_binary(exclude_id), do: where(q, [a], a.id != ^exclude_id), else: q
      end)
      |> Repo.all()
      |> Enum.any?(fn appt ->
        overlaps?(starts_at, ends_at, busy_window_start(appt), busy_window_end(appt))
      end)

    if conflicting, do: {:error, :conflict}, else: :ok
  end

  def ensure_no_resource_conflict(resource_id, starts_at, ends_at, opts \\ []) do
    exclude_id = Keyword.get(opts, :exclude_id)
    buffer_before = Keyword.get(opts, :buffer_before, 0)
    buffer_after = Keyword.get(opts, :buffer_after, 0)

    busy_start = DateTime.add(starts_at, -buffer_before * 60, :second)
    busy_end = DateTime.add(ends_at, buffer_after * 60, :second)
    margin = 3 * 60 * 60
    q_start = DateTime.add(busy_start, -margin, :second)
    q_end = DateTime.add(busy_end, margin, :second)

    query =
      from(a in Appointment,
        join: ar in AppointmentResource,
        on: ar.appointment_id == a.id,
        where:
          ar.bookable_resource_id == ^resource_id and a.status in ^@active_statuses and
            a.starts_at < ^q_end and a.ends_at > ^q_start
      )

    conflicting =
      query
      |> then(fn q ->
        if is_binary(exclude_id), do: where(q, [a], a.id != ^exclude_id), else: q
      end)
      |> Repo.all()
      |> Enum.any?(fn appt ->
        overlaps?(
          busy_start,
          busy_end,
          busy_window_start(appt),
          busy_window_end(appt)
        )
      end)

    if conflicting, do: {:error, :resource_conflict}, else: :ok
  end

  defp busy_window_start(%Appointment{} = a),
    do: DateTime.add(a.starts_at, -(a.buffer_before_minutes || 0) * 60, :second)

  defp busy_window_end(%Appointment{} = a),
    do: DateTime.add(a.ends_at, (a.buffer_after_minutes || 0) * 60, :second)

  defp overlaps?(s1, e1, s2, e2) do
    DateTime.compare(s1, e2) == :lt and DateTime.compare(e1, s2) == :gt
  end

  ## —— Resource assignment ———————————————————————————————————————

  defp preferred_resource_ids(attrs) do
    raw = attrs[:bookable_resource_ids] || attrs["bookable_resource_ids"] || []
    single = blank_to_nil(attrs[:bookable_resource_id] || attrs["bookable_resource_id"])

    (List.wrap(raw) ++ List.wrap(single))
    |> Enum.map(&blank_to_nil/1)
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
  end

  defp assign_resources(product, branch_id, business_id, owner_id, starts_at, ends_at, opts) do
    requirements = list_product_resources(product.id)

    if requirements == [] do
      {:ok, []}
    else
      buffer_before = Keyword.get(opts, :buffer_before, product.buffer_before_minutes || 0)
      buffer_after = Keyword.get(opts, :buffer_after, product.buffer_after_minutes || 0)
      preferred = Keyword.get(opts, :preferred_ids, [])
      exclude_id = Keyword.get(opts, :exclude_appointment_id)

      Enum.reduce_while(requirements, {:ok, []}, fn req, {:ok, acc} ->
        case pick_resource(req, branch_id, business_id, owner_id, starts_at, ends_at,
               buffer_before: buffer_before,
               buffer_after: buffer_after,
               preferred_ids: preferred,
               exclude_appointment_id: exclude_id,
               already_picked: Enum.map(acc, & &1.id)
             ) do
          {:ok, resource} -> {:cont, {:ok, [resource | acc]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
      |> case do
        {:ok, list} -> {:ok, Enum.reverse(list)}
        error -> error
      end
    end
  end

  defp pick_resource(req, branch_id, business_id, owner_id, starts_at, ends_at, opts) do
    preferred = Keyword.get(opts, :preferred_ids, [])
    already = MapSet.new(Keyword.get(opts, :already_picked, []))
    exclude_id = Keyword.get(opts, :exclude_appointment_id)
    buffer_before = Keyword.get(opts, :buffer_before, 0)
    buffer_after = Keyword.get(opts, :buffer_after, 0)

    candidates =
      cond do
        is_binary(req.bookable_resource_id) ->
          case get_bookable_resource(req.bookable_resource_id, business_id, owner_id) do
            %BookableResource{is_active: true, branch_id: ^branch_id} = r -> [r]
            _ -> []
          end

        is_binary(req.resource_kind) and req.resource_kind in @resource_kinds ->
          list_bookable_resources(business_id, owner_id,
            branch_id: branch_id,
            kind: req.resource_kind,
            active_only: true
          )

        true ->
          []
      end
      |> Enum.reject(&MapSet.member?(already, &1.id))
      |> Enum.sort_by(fn r ->
        {if(r.id in preferred, do: 0, else: 1), r.name}
      end)

    Enum.find_value(candidates, {:error, :resource_conflict}, fn resource ->
      case ensure_no_resource_conflict(resource.id, starts_at, ends_at,
             buffer_before: buffer_before,
             buffer_after: buffer_after,
             exclude_id: exclude_id
           ) do
        :ok -> {:ok, resource}
        _ -> nil
      end
    end)
  end

  ## —— Package redeem ————————————————————————————————————————————

  defp maybe_redeem_package(business_id, owner_id, customer_id, product_id, attrs) do
    purchase_id = blank_to_nil(attrs[:package_purchase_id] || attrs["package_purchase_id"])

    cond do
      is_nil(purchase_id) ->
        {:ok, %{}}

      is_nil(customer_id) ->
        {:error, :customer_required_for_package}

      true ->
        case Repo.get_by(CustomerPackagePurchase,
               id: purchase_id,
               business_id: business_id,
               owner_id: owner_id,
               customer_id: customer_id,
               status: "active"
             )
             |> then(fn
               nil -> nil
               p -> Repo.preload(p, :package)
             end) do
          nil ->
            {:error, :package_not_found}

          %{remaining_sessions: rem} when rem <= 0 ->
            {:error, :package_exhausted}

          %{package: %{product_id: pid}} when pid != product_id ->
            {:error, :package_service_mismatch}

          purchase ->
            remaining = purchase.remaining_sessions - 1
            used = purchase.used_sessions + 1
            status = if remaining == 0, do: "exhausted", else: "active"
            session_index = used

            case purchase
                 |> CustomerPackagePurchase.changeset(%{
                   remaining_sessions: remaining,
                   used_sessions: used,
                   status: status
                 })
                 |> Repo.update() do
              {:ok, _} ->
                {:ok,
                 %{
                   package_purchase_id: purchase.id,
                   package_session_index: session_index
                 }}

              error ->
                error
            end
        end
    end
  end

  ## —— Helpers ———————————————————————————————————————————————————

  def serialize(%Appointment{} = a) do
    resources =
      case Map.get(a, :appointment_resources) do
        list when is_list(list) ->
          Enum.map(list, fn ar ->
            %{
              id: ar.bookable_resource_id,
              name: ar.bookable_resource && ar.bookable_resource.name,
              kind: ar.bookable_resource && ar.bookable_resource.kind
            }
          end)

        _ ->
          []
      end

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
      buffer_before_minutes: a.buffer_before_minutes,
      buffer_after_minutes: a.buffer_after_minutes,
      deposit_amount: decimal_str(a.deposit_amount),
      deposit_status: a.deposit_status,
      deposit_sale_id: a.deposit_sale_id,
      package_purchase_id: a.package_purchase_id,
      package_session_index: a.package_session_index,
      customer_name: a.customer && a.customer.name,
      product_name: a.product && a.product.name,
      staff_name: a.staff && a.staff.name,
      business_name: a.business && a.business.name,
      duration_minutes: a.product && a.product.duration_minutes,
      resources: resources,
      resource_names: Enum.map(resources, & &1.name) |> Enum.reject(&is_nil/1)
    }
  end

  defp preload(appt),
    do:
      Repo.preload(appt, [
        :customer,
        :product,
        :staff,
        :branch,
        :sale,
        :deposit_sale,
        :business,
        :package_purchase,
        appointment_resources: :bookable_resource
      ])

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
    {DateTime.new!(date, ~T[00:00:00], "Etc/UTC"), DateTime.new!(date, ~T[23:59:59], "Etc/UTC")}
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

  defp parse_int(nil, default), do: default
  defp parse_int("", default), do: default
  defp parse_int(v, _default) when is_integer(v), do: v

  defp parse_int(v, default) when is_binary(v) do
    case Integer.parse(String.trim(v)) do
      {n, _} -> n
      :error -> default
    end
  end

  defp parse_int(_, default), do: default

  defp parse_bool(nil, default), do: default
  defp parse_bool(true, _), do: true
  defp parse_bool(false, _), do: false
  defp parse_bool("true", _), do: true
  defp parse_bool("false", _), do: false
  defp parse_bool("1", _), do: true
  defp parse_bool("0", _), do: false
  defp parse_bool(_, default), do: default

  defp positive_decimal?(nil), do: false

  defp positive_decimal?(%Decimal{} = d), do: Decimal.compare(d, 0) == :gt

  defp positive_decimal?(v) when is_binary(v) do
    case Decimal.parse(v) do
      {d, _} -> positive_decimal?(d)
      :error -> false
    end
  end

  defp positive_decimal?(_), do: false

  defp decimal_str(nil), do: nil
  defp decimal_str(%Decimal{} = d), do: to_string(d)
  defp decimal_str(v), do: to_string(v)

  defp max_dec(%Decimal{} = a, %Decimal{} = b) do
    if Decimal.compare(a, b) == :lt, do: b, else: a
  end
end
