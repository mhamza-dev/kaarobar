defmodule Kaarobar.HrPayrollTest do
  use Kaarobar.DataCase

  alias Kaarobar.{Accounts, Accounting, Hr, PayrollDeductions, Tenancy}
  alias Kaarobar.Schemas.{JournalEntry, PayrollRun}
  alias Kaarobar.Repo

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "owner-p5-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner"
      })

    {:ok, staff} =
      Accounts.register(%{
        email: "staff-p5-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Staff"
      })

    {:ok, business} = Tenancy.create_business(owner.id, %{name: "People Co"})
    {:ok, branch} = Tenancy.create_branch(business.id, owner, %{name: "HQ"})

    {:ok, emp} =
      Hr.create_employee(%{
        employee_code: "E-100",
        name: "Ayesha",
        position: "Cashier",
        join_date: ~D[2025-01-01],
        basic_salary: "50000",
        allowances: %{"transport" => "5000"},
        overtime_rate: "1.5",
        status: "active",
        business_id: business.id,
        owner_id: owner.id,
        branch_id: branch.id,
        user_id: staff.id
      })

    %{
      owner: owner,
      staff: staff,
      business: business,
      branch: branch,
      emp: emp
    }
  end

  test "HR-FR-001 employee master create and list", %{
    business: business,
    owner: owner,
    emp: emp
  } do
    list = Hr.list_employees(business.id, owner.id)
    assert Enum.any?(list, &(&1.id == emp.id))
    assert emp.basic_salary
    assert emp.phone == nil

    assert {:ok, updated} =
             Hr.update_employee(emp.id, owner.id, %{phone: "03001234567", position: "Senior Cashier"})

    assert updated.phone == "03001234567"
    assert updated.position == "Senior Cashier"
  end

  test "HR-FR-002 clock in/out", %{emp: emp, business: business, owner: owner, branch: branch} do
    assert {:ok, rec} =
             Hr.clock_in(%{
               employee_id: emp.id,
               business_id: business.id,
               owner_id: owner.id,
               branch_id: branch.id,
               source: "mobile"
             })

    assert rec.clock_in
    assert {:ok, out} = Hr.clock_out(rec.id, owner.id)
    assert out.clock_out

    rows = Hr.list_attendance(business.id, owner.id, employee_id: emp.id)
    assert length(rows) == 1
  end

  test "HR-FR-005 leave request approve/reject", %{
    emp: emp,
    business: business,
    owner: owner
  } do
    assert {:ok, leave} =
             Hr.request_leave(%{
               employee_id: emp.id,
               business_id: business.id,
               owner_id: owner.id,
               type: "annual",
               start_date: Date.utc_today(),
               end_date: Date.add(Date.utc_today(), 1),
               reason: "Family"
             })

    assert leave.status == "Pending"
    assert {:ok, approved} = Hr.approve_leave(leave.id, owner.id, owner.id)
    assert approved.status == "Approved"

    assert {:ok, leave2} =
             Hr.request_leave(%{
               employee_id: emp.id,
               business_id: business.id,
               owner_id: owner.id,
               type: "sick",
               start_date: Date.add(Date.utc_today(), 10),
               end_date: Date.add(Date.utc_today(), 11)
             })

    assert {:ok, rejected} = Hr.reject_leave(leave2.id, owner.id, owner.id)
    assert rejected.status == "Rejected"
  end

  test "HR-FR-008 tax slabs and eobi", %{} do
    # Below first slab threshold → 0 tax, eobi floor
    d = PayrollDeductions.compute(Decimal.new("40000"), Decimal.new("35000"))
    assert Decimal.eq?(d.income_tax, Decimal.new("0.00"))
    assert Decimal.compare(d.eobi, Decimal.new("100")) != :lt

    # Mid slab
    d2 = PayrollDeductions.compute(Decimal.new("150000"), Decimal.new("140000"))
    assert Decimal.compare(d2.income_tax, Decimal.new("0")) == :gt
  end

  test "HR-FR-006/009/010 payroll calc, approve, journal post", %{
    emp: emp,
    business: business,
    owner: owner,
    branch: branch
  } do
    # Partial attendance day with OT (>8h)
    cin = ~U[2026-07-01 03:00:00Z]
    cout = ~U[2026-07-01 14:00:00Z]

    {:ok, _} =
      %Kaarobar.Schemas.AttendanceRecord{}
      |> Kaarobar.Schemas.AttendanceRecord.changeset(%{
        employee_id: emp.id,
        business_id: business.id,
        owner_id: owner.id,
        branch_id: branch.id,
        date: ~D[2026-07-01],
        clock_in: cin,
        clock_out: cout,
        source: "pos"
      })
      |> Repo.insert()

    assert {:ok, run} =
             Hr.create_payroll_run(business.id, owner.id, ~D[2026-07-01], ~D[2026-07-31])

    assert run.status == "Draft"
    assert length(run.payslips) == 1
    slip = hd(run.payslips)
    assert Decimal.compare(slip.gross_pay, Decimal.new(0)) == :gt
    assert Map.has_key?(slip.deductions, "income_tax")
    assert Map.has_key?(slip.deductions, "eobi")
    assert Decimal.compare(slip.overtime_hours, Decimal.new(0)) == :gt

    assert {:ok, submitted} = Hr.submit_payroll(run.id, owner.id)
    assert submitted.status == "PendingApproval"

    assert {:ok, approved} = Hr.approve_payroll(run.id, owner.id, owner.id)
    assert approved.status == "Approved"

    assert %{success: 1, failure: 0} = Oban.drain_queue(queue: :default)

    posted = Repo.get!(PayrollRun, run.id)
    assert posted.status == "Posted"
    assert posted.journal_entry_id

    journal = Repo.get!(JournalEntry, posted.journal_entry_id) |> Repo.preload(:lines)
    assert journal.is_locked
    assert journal.source_type == "payroll"

    debit =
      Enum.reduce(journal.lines, Decimal.new(0), fn l, acc -> Decimal.add(acc, l.debit) end)

    credit =
      Enum.reduce(journal.lines, Decimal.new(0), fn l, acc -> Decimal.add(acc, l.credit) end)

    assert Decimal.eq?(debit, credit)

    eobi_acct = Accounting.get_account_by_code(business.id, "2210")
    assert Enum.any?(journal.lines, &(&1.account_id == eobi_acct.id))

    # employee unused warning silence
    assert emp.id
  end

  test "HR-FR-011 ESS summary", %{staff: staff, business: business, owner: owner} do
    assert {:ok, summary} = Hr.ess_summary(staff.id, business.id, owner.id)
    assert summary.employee.name == "Ayesha"
    assert is_list(summary.attendance)
    assert is_list(summary.leave)
    assert is_list(summary.payslips)
  end

  test "payroll status machine rejects invalid transitions", %{
    business: business,
    owner: owner
  } do
    {:ok, run} = Hr.create_payroll_run(business.id, owner.id, ~D[2026-06-01], ~D[2026-06-30])
    assert {:error, {:invalid_status, "Draft"}} = Hr.approve_payroll(run.id, owner.id, owner.id)
  end
end
