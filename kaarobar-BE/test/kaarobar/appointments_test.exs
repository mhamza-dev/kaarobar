defmodule Kaarobar.AppointmentsTest do
  @moduledoc """
  SCH-FR appointments: booking, conflict, schedule, completion sale hook, tenant isolation.
  FUT-FR-081 salon resource booking, buffers, deposits, packages.
  """
  use Kaarobar.DataCase

  alias Kaarobar.{Accounts, Appointments, Catalog, Hr, Inventory, Tenancy}
  alias Kaarobar.Schemas.Customer
  alias Kaarobar.Repo

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "owner-appt-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Salon Owner"
      })

    {:ok, other_owner} =
      Accounts.register(%{
        email: "owner-appt-b-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Other Owner"
      })

    {:ok, salon} =
      Tenancy.create_business(owner.id, %{name: "Test Salon", industry: "salon"})

    {:ok, retail} =
      Tenancy.create_business(owner.id, %{name: "Test Retail", industry: "retail"})

    {:ok, other_biz} =
      Tenancy.create_business(other_owner.id, %{name: "Other Salon", industry: "salon"})

    {:ok, branch} = Tenancy.create_branch(salon.id, owner, %{name: "Main Chair"})
    {:ok, retail_branch} = Tenancy.create_branch(retail.id, owner, %{name: "Retail Floor"})
    {:ok, other_branch} = Tenancy.create_branch(other_biz.id, other_owner, %{name: "Theirs"})

    assert salon.appointments_enabled == true or Appointments.appointments_enabled?(salon)

    {:ok, service} =
      Catalog.create_product(salon.id, owner.id, %{
        sku: "CUT-#{System.unique_integer()}",
        name: "Haircut",
        product_kind: "service",
        track_inventory: false,
        duration_minutes: 30,
        tax_rate: "0",
        is_active: true
      })

    {:ok, _} = Inventory.set_branch_price(service.id, branch.id, owner.id, salon.id, "500")

    {:ok, goods} =
      Catalog.create_product(retail.id, owner.id, %{
        sku: "SKU-#{System.unique_integer()}",
        name: "Shampoo Bottle",
        product_kind: "goods",
        tax_rate: "0",
        is_active: true
      })

    {:ok, staff} =
      Hr.create_employee(%{
        employee_code: "STY-#{System.unique_integer()}",
        name: "Stylist One",
        join_date: Date.utc_today(),
        business_id: salon.id,
        owner_id: owner.id,
        branch_id: branch.id,
        status: "active",
        basic_salary: "40000"
      })

    {:ok, customer} =
      %Customer{}
      |> Customer.changeset(%{
        name: "Walk-in Guest",
        phone: "03001234567",
        business_id: salon.id,
        owner_id: owner.id
      })
      |> Repo.insert()

    tomorrow = Date.add(Date.utc_today(), 1)
    starts = DateTime.new!(tomorrow, ~T[10:00:00], "Etc/UTC")

    %{
      owner: owner,
      other_owner: other_owner,
      salon: salon,
      retail: retail,
      other_biz: other_biz,
      branch: branch,
      retail_branch: retail_branch,
      other_branch: other_branch,
      service: service,
      goods: goods,
      staff: staff,
      customer: customer,
      starts: starts,
      tomorrow: tomorrow
    }
  end

  test "SCH-FR-001 books appointment for service + staff + slot", %{
    owner: owner,
    salon: salon,
    branch: branch,
    service: service,
    staff: staff,
    customer: customer,
    starts: starts
  } do
    assert {:ok, appt} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               customer_id: customer.id,
               starts_at: DateTime.to_iso8601(starts)
             })

    assert appt.status == "Booked"
    assert appt.staff_id == staff.id
    assert appt.product_id == service.id
    assert appt.ends_at == DateTime.add(starts, 30 * 60, :second)
  end

  test "SCH-FR-002 rejects overlapping booking for same staff", %{
    owner: owner,
    salon: salon,
    branch: branch,
    service: service,
    staff: staff,
    starts: starts
  } do
    assert {:ok, _} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               starts_at: starts
             })

    overlap = DateTime.add(starts, 15 * 60, :second)

    assert {:error, :conflict} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               starts_at: overlap
             })
  end

  test "industry gate blocks retail bookings", %{
    owner: owner,
    retail: retail,
    retail_branch: branch,
    goods: goods,
    starts: starts
  } do
    {:ok, staff} =
      Hr.create_employee(%{
        employee_code: "R-#{System.unique_integer()}",
        name: "Retail Staff",
        join_date: Date.utc_today(),
        business_id: retail.id,
        owner_id: owner.id,
        branch_id: branch.id,
        status: "active"
      })

    refute Appointments.appointments_enabled?(retail)

    assert {:error, :appointments_disabled} =
             Appointments.book(retail.id, owner.id, %{
               product_id: goods.id,
               staff_id: staff.id,
               branch_id: branch.id,
               starts_at: starts
             })
  end

  test "SCH-FR-003 staff day schedule is tenant-scoped", %{
    owner: owner,
    other_owner: other_owner,
    salon: salon,
    other_biz: other_biz,
    branch: branch,
    other_branch: other_branch,
    service: service,
    staff: staff,
    starts: starts,
    tomorrow: tomorrow
  } do
    assert {:ok, appt} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               starts_at: starts
             })

    day = Appointments.staff_day_schedule(salon.id, owner.id, staff.id, tomorrow)
    assert Enum.any?(day, &(&1.id == appt.id))

    # SEC-NFR-001: other owner cannot see this appointment via their schedule query
    other_day =
      Appointments.staff_day_schedule(other_biz.id, other_owner.id, staff.id, tomorrow)

    refute Enum.any?(other_day, &(&1.id == appt.id))

    _ = other_branch
  end

  test "SCH-FR-004 / SCH-FR-005 complete links sale when possible", %{
    owner: owner,
    salon: salon,
    branch: branch,
    service: service,
    staff: staff,
    customer: customer,
    starts: starts
  } do
    assert {:ok, appt} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               customer_id: customer.id,
               starts_at: starts
             })

    assert {:ok, checked} = Appointments.transition(appt, "CheckedIn")
    assert {:ok, in_progress} = Appointments.transition(checked, "InProgress")
    assert {:ok, done} = Appointments.transition(in_progress, "Completed")

    assert done.status == "Completed"
    assert is_binary(done.sale_id)
  end

  test "list_slots omits booked windows", %{
    owner: owner,
    salon: salon,
    branch: branch,
    service: service,
    staff: staff,
    starts: starts,
    tomorrow: tomorrow
  } do
    assert {:ok, _} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               starts_at: starts
             })

    assert {:ok, slots} =
             Appointments.list_slots(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               date: Date.to_iso8601(tomorrow)
             })

    refute Enum.any?(slots, fn s ->
             {:ok, dt, _} = DateTime.from_iso8601(s.starts_at)
             DateTime.compare(dt, starts) == :eq
           end)
  end

  test "cancel and reschedule (CUS-FR-005 / SCH-FR-001)", %{
    owner: owner,
    salon: salon,
    branch: branch,
    service: service,
    staff: staff,
    starts: starts
  } do
    assert {:ok, appt} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               starts_at: starts
             })

    new_start = DateTime.add(starts, 3600, :second)

    assert {:ok, moved} =
             Appointments.reschedule(appt, %{starts_at: DateTime.to_iso8601(new_start)})

    assert moved.starts_at == new_start

    assert {:ok, cancelled} = Appointments.cancel(moved, actor: :customer)
    assert cancelled.status == "Cancelled"
  end

  test "FUT-FR-081 rejects overlapping booking for same resource", %{
    owner: owner,
    salon: salon,
    branch: branch,
    service: service,
    staff: staff,
    starts: starts
  } do
    assert {:ok, chair} =
             Appointments.create_bookable_resource(salon.id, owner.id, %{
               branch_id: branch.id,
               name: "Chair 1",
               kind: "chair"
             })

    assert {:ok, _} =
             Appointments.sync_product_resources(service.id, [
               %{"bookable_resource_id" => chair.id}
             ])

    {:ok, staff2} =
      Hr.create_employee(%{
        employee_code: "STY-#{System.unique_integer()}",
        name: "Stylist Two",
        join_date: Date.utc_today(),
        business_id: salon.id,
        owner_id: owner.id,
        branch_id: branch.id,
        status: "active",
        basic_salary: "40000"
      })

    assert {:ok, _} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               starts_at: starts,
               bookable_resource_id: chair.id
             })

    assert {:error, :resource_conflict} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff2.id,
               branch_id: branch.id,
               starts_at: starts,
               bookable_resource_id: chair.id
             })
  end

  test "FUT-FR-081 auto-assigns free resource of required kind", %{
    owner: owner,
    salon: salon,
    branch: branch,
    service: service,
    staff: staff,
    starts: starts
  } do
    assert {:ok, chair} =
             Appointments.create_bookable_resource(salon.id, owner.id, %{
               branch_id: branch.id,
               name: "Chair A",
               kind: "chair"
             })

    assert {:ok, _} =
             Appointments.sync_product_resources(service.id, [%{"resource_kind" => "chair"}])

    assert {:ok, appt} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               starts_at: starts
             })

    assert appt.buffer_before_minutes == 0
    serialized = Appointments.serialize(appt)
    assert Enum.any?(serialized.resources, &(&1.id == chair.id))
  end

  test "FUT-FR-081 resource conflict is tenant-isolated (SEC-NFR-001)", %{
    owner: owner,
    other_owner: other_owner,
    salon: salon,
    other_biz: other_biz,
    branch: branch,
    other_branch: other_branch,
    service: service,
    staff: staff,
    starts: starts
  } do
    assert {:ok, chair} =
             Appointments.create_bookable_resource(salon.id, owner.id, %{
               branch_id: branch.id,
               name: "Private Chair",
               kind: "chair"
             })

    other_resources =
      Appointments.list_bookable_resources(other_biz.id, other_owner.id,
        branch_id: other_branch.id
      )

    refute Enum.any?(other_resources, &(&1.id == chair.id))

    assert Appointments.get_bookable_resource(chair.id, other_biz.id, other_owner.id) == nil

    assert {:ok, _} =
             Appointments.sync_product_resources(service.id, [
               %{"bookable_resource_id" => chair.id}
             ])

    assert {:ok, appt} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               starts_at: starts
             })

    refute Appointments.get_appointment(appt.id, other_owner.id)
  end

  test "FUT-FR-081 package redeem decrements remaining sessions on book", %{
    owner: owner,
    salon: salon,
    branch: branch,
    service: service,
    staff: staff,
    customer: customer,
    starts: starts
  } do
    assert {:ok, pkg} =
             Appointments.create_service_package(salon.id, owner.id, %{
               product_id: service.id,
               name: "5 Cuts",
               session_count: 5,
               price: "2000"
             })

    {:ok, purchase} =
      %Kaarobar.Schemas.CustomerPackagePurchase{}
      |> Kaarobar.Schemas.CustomerPackagePurchase.changeset(%{
        owner_id: owner.id,
        business_id: salon.id,
        customer_id: customer.id,
        package_id: pkg.id,
        remaining_sessions: 5,
        used_sessions: 0,
        status: "active"
      })
      |> Repo.insert()

    assert {:ok, appt} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               customer_id: customer.id,
               starts_at: starts,
               package_purchase_id: purchase.id
             })

    assert appt.package_purchase_id == purchase.id
    assert appt.package_session_index == 1

    updated = Repo.get!(Kaarobar.Schemas.CustomerPackagePurchase, purchase.id)
    assert updated.remaining_sessions == 4
    assert updated.used_sessions == 1
  end

  test "FUT-FR-081 deposit paid then applied on complete; no-show forfeits", %{
    owner: owner,
    salon: salon,
    branch: branch,
    staff: staff,
    customer: customer,
    starts: starts
  } do
    assert {:ok, service} =
             Catalog.create_product(salon.id, owner.id, %{
               sku: "FACIAL-#{System.unique_integer()}",
               name: "Facial",
               product_kind: "service",
               track_inventory: false,
               duration_minutes: 30,
               deposit_amount: "200",
               no_show_fee_amount: "150",
               tax_rate: "0",
               is_active: true
             })

    {:ok, _} = Inventory.set_branch_price(service.id, branch.id, owner.id, salon.id, "800")

    assert {:ok, appt} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               customer_id: customer.id,
               starts_at: starts
             })

    assert appt.deposit_status == "due"
    assert Decimal.compare(appt.deposit_amount, Decimal.new("200")) == :eq

    assert {:ok, paid} = Appointments.mark_deposit_paid(appt)
    assert paid.deposit_status == "paid"
    assert is_binary(paid.deposit_sale_id)

    assert {:ok, checked} = Appointments.transition(paid, "CheckedIn")
    assert {:ok, in_progress} = Appointments.transition(checked, "InProgress")
    assert {:ok, done} = Appointments.transition(in_progress, "Completed")
    assert done.deposit_status == "applied"

    starts2 = DateTime.add(starts, 7200, :second)

    assert {:ok, appt2} =
             Appointments.book(salon.id, owner.id, %{
               product_id: service.id,
               staff_id: staff.id,
               branch_id: branch.id,
               customer_id: customer.id,
               starts_at: starts2
             })

    assert {:ok, paid2} = Appointments.mark_deposit_paid(appt2)
    assert {:ok, noshow} = Appointments.transition(paid2, "NoShow")
    assert noshow.deposit_status == "forfeited"
    assert is_binary(noshow.sale_id)
  end
end
