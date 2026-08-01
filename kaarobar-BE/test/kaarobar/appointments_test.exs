defmodule Kaarobar.AppointmentsTest do
  @moduledoc """
  SCH-FR appointments: booking, conflict, schedule, completion sale hook, tenant isolation.
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
end
