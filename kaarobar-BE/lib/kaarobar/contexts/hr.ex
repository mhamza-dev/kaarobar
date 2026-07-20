defmodule Kaarobar.Hr do
  @moduledoc """
  HR & payroll (HR-FR Must): employees, attendance, leave, payroll calc/approve/post, ESS.
  """

  import Ecto.Query
  alias Ecto.Multi
  alias Kaarobar.{Audit, PayrollDeductions, Repo}
  alias Kaarobar.Schemas.{
    AttendanceRecord,
    Employee,
    LeaveRequest,
    PayrollRun,
    Payslip
  }

  ## —— Employees (HR-FR-001) ————————————————————————————————————

  def create_employee(attrs) do
    result =
      %Employee{}
      |> Employee.changeset(normalize_attrs(attrs))
      |> Repo.insert()

    with {:ok, emp} <- result do
      Audit.log(%{
        owner_id: emp.owner_id,
        user_id: emp.owner_id,
        action: "employee.create",
        entity_type: "employee",
        entity_id: emp.id,
        metadata: %{employee_code: emp.employee_code}
      })

      {:ok, emp}
    end
  end

  def update_employee(employee_id, owner_id, attrs) do
    case Repo.get_by(Employee, id: employee_id, owner_id: owner_id) do
      nil ->
        {:error, :not_found}

      emp ->
        emp
        |> Employee.changeset(normalize_attrs(attrs))
        |> Repo.update()
        |> tap(fn
          {:ok, updated} ->
            Audit.log(%{
              owner_id: owner_id,
              user_id: owner_id,
              action: "employee.update",
              entity_type: "employee",
              entity_id: updated.id,
              metadata: %{}
            })

          _ ->
            :ok
        end)
    end
  end

  def get_employee(employee_id, owner_id) do
    Repo.get_by(Employee, id: employee_id, owner_id: owner_id)
  end

  def list_employees(business_id, owner_id, opts \\ []) do
    status = Keyword.get(opts, :status)

    q =
      Employee
      |> where([e], e.business_id == ^business_id and e.owner_id == ^owner_id)
      |> order_by([e], asc: e.employee_code)

    q = if status, do: where(q, [e], e.status == ^status), else: q
    Repo.all(q)
  end

  def find_employee_for_user(user_id, business_id, owner_id) do
    Repo.get_by(Employee,
      user_id: user_id,
      business_id: business_id,
      owner_id: owner_id,
      status: "active"
    )
  end

  ## —— Attendance (HR-FR-002) ——————————————————————————————————

  def clock_in(attrs) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    date = attrs[:date] || attrs["date"] || Date.utc_today()

    %AttendanceRecord{}
    |> AttendanceRecord.changeset(
      Map.merge(normalize_attrs(attrs), %{clock_in: now, date: date})
    )
    |> Repo.insert()
  end

  def clock_out(attendance_id, owner_id \\ nil) do
    query =
      if owner_id do
        from(a in AttendanceRecord, where: a.id == ^attendance_id and a.owner_id == ^owner_id)
      else
        from(a in AttendanceRecord, where: a.id == ^attendance_id)
      end

    case Repo.one(query) do
      nil ->
        {:error, :not_found}

      %{clock_out: %DateTime{}} ->
        {:error, :already_clocked_out}

      record ->
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        record
        |> AttendanceRecord.changeset(%{clock_out: now})
        |> Repo.update()
    end
  end

  def list_attendance(business_id, owner_id, opts \\ []) do
    employee_id = Keyword.get(opts, :employee_id)
    from_date = Keyword.get(opts, :from)
    to_date = Keyword.get(opts, :to)
    limit = Keyword.get(opts, :limit, 200)

    q =
      from(a in AttendanceRecord,
        where: a.business_id == ^business_id and a.owner_id == ^owner_id,
        order_by: [desc: a.date, desc: a.inserted_at],
        limit: ^limit,
        preload: [:employee]
      )

    q = if employee_id, do: where(q, [a], a.employee_id == ^employee_id), else: q
    q = if from_date, do: where(q, [a], a.date >= ^from_date), else: q
    q = if to_date, do: where(q, [a], a.date <= ^to_date), else: q
    Repo.all(q)
  end

  def open_attendance_for_employee(employee_id, date \\ Date.utc_today()) do
    from(a in AttendanceRecord,
      where: a.employee_id == ^employee_id and a.date == ^date and is_nil(a.clock_out)
    )
    |> Repo.one()
  end

  ## —— Leave (HR-FR-005) ———————————————————————————————————————

  def request_leave(attrs) do
    %LeaveRequest{}
    |> LeaveRequest.changeset(Map.put_new(normalize_attrs(attrs), :status, "Pending"))
    |> Repo.insert()
  end

  def list_leave(business_id, owner_id, opts \\ []) do
    status = Keyword.get(opts, :status)
    employee_id = Keyword.get(opts, :employee_id)

    q =
      from(l in LeaveRequest,
        where: l.business_id == ^business_id and l.owner_id == ^owner_id,
        order_by: [desc: l.inserted_at],
        preload: [:employee]
      )

    q = if status, do: where(q, [l], l.status == ^status), else: q
    q = if employee_id, do: where(q, [l], l.employee_id == ^employee_id), else: q
    Repo.all(q)
  end

  def approve_leave(leave_id, approver_id, owner_id \\ nil) do
    update_leave_status(leave_id, "Approved", approver_id, owner_id)
  end

  def reject_leave(leave_id, approver_id, owner_id \\ nil) do
    update_leave_status(leave_id, "Rejected", approver_id, owner_id)
  end

  defp update_leave_status(leave_id, status, approver_id, owner_id) do
    query =
      if owner_id do
        from(l in LeaveRequest, where: l.id == ^leave_id and l.owner_id == ^owner_id)
      else
        from(l in LeaveRequest, where: l.id == ^leave_id)
      end

    case Repo.one(query) do
      nil ->
        {:error, :not_found}

      %{status: "Pending"} = leave ->
        leave
        |> LeaveRequest.changeset(%{status: status, approved_by_id: approver_id})
        |> Repo.update()
        |> tap(fn
          {:ok, updated} ->
            Audit.log(%{
              owner_id: updated.owner_id,
              user_id: approver_id,
              action: "leave.#{String.downcase(status)}",
              entity_type: "leave_request",
              entity_id: updated.id,
              metadata: %{type: updated.type}
            })

          _ ->
            :ok
        end)

      _ ->
        {:error, :not_pending}
    end
  end

  ## —— Payroll (HR-FR-006/008/009/010) —————————————————————————

  def create_payroll_run(business_id, owner_id, period_start, period_end) do
    employees = list_employees(business_id, owner_id, status: "active")

    if employees == [] do
      {:error, :no_employees}
    else
      Multi.new()
      |> Multi.insert(:run, fn _ ->
        %PayrollRun{}
        |> PayrollRun.changeset(%{
          business_id: business_id,
          owner_id: owner_id,
          period_start: period_start,
          period_end: period_end,
          status: "Draft"
        })
      end)
      |> Multi.run(:payslips, fn _repo, %{run: run} ->
        slips =
          Enum.map(employees, fn emp ->
            calc = calculate_payslip(emp, period_start, period_end)

            %Payslip{}
            |> Payslip.changeset(
              Map.merge(calc, %{
                payroll_run_id: run.id,
                employee_id: emp.id
              })
            )
            |> Repo.insert()
          end)

        if Enum.all?(slips, &match?({:ok, _}, &1)) do
          {:ok, Enum.map(slips, fn {:ok, s} -> s end)}
        else
          {:error, :payslip_failed}
        end
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{run: run}} ->
          Audit.log(%{
            owner_id: owner_id,
            user_id: owner_id,
            action: "payroll.create",
            entity_type: "payroll_run",
            entity_id: run.id,
            metadata: %{period_start: period_start, period_end: period_end}
          })

          {:ok, get_payroll_run!(run.id)}

        {:error, _op, reason, _} ->
          {:error, reason}
      end
    end
  end

  def list_payroll_runs(business_id, owner_id) do
    from(r in PayrollRun,
      where: r.business_id == ^business_id and r.owner_id == ^owner_id,
      order_by: [desc: r.period_end, desc: r.inserted_at],
      preload: [payslips: :employee]
    )
    |> Repo.all()
  end

  def get_payroll_run(run_id, owner_id) do
    from(r in PayrollRun,
      where: r.id == ^run_id and r.owner_id == ^owner_id,
      preload: [payslips: :employee]
    )
    |> Repo.one()
  end

  defp get_payroll_run!(run_id) do
    from(r in PayrollRun, where: r.id == ^run_id, preload: [payslips: :employee])
    |> Repo.one!()
  end

  def submit_payroll(run_id, owner_id \\ nil) do
    with {:ok, run} <- fetch_run(run_id, owner_id),
         :ok <- require_status(run, ["Draft", "Rejected"]) do
      update_payroll_status(run, "PendingApproval", %{})
    end
  end

  def approve_payroll(run_id, approver_id, owner_id \\ nil) do
    with {:ok, run} <- fetch_run(run_id, owner_id),
         :ok <- require_status(run, ["PendingApproval"]) do
      case update_payroll_status(run, "Approved", %{approved_by_id: approver_id}) do
        {:ok, approved} ->
          %{
            "payroll_run_id" => approved.id,
            "business_id" => approved.business_id,
            "owner_id" => approved.owner_id,
            "posted_by_id" => approver_id
          }
          |> Kaarobar.Workers.PostPayrollJournalWorker.new()
          |> Oban.insert()

          Audit.log(%{
            owner_id: approved.owner_id,
            user_id: approver_id,
            action: "payroll.approve",
            entity_type: "payroll_run",
            entity_id: approved.id,
            metadata: %{}
          })

          {:ok, get_payroll_run!(approved.id)}

        error ->
          error
      end
    end
  end

  def reject_payroll(run_id, owner_id \\ nil) do
    with {:ok, run} <- fetch_run(run_id, owner_id),
         :ok <- require_status(run, ["PendingApproval", "Draft"]) do
      update_payroll_status(run, "Rejected", %{})
    end
  end

  def mark_payroll_posted(run_id, journal_entry_id) do
    case Repo.get(PayrollRun, run_id) do
      nil ->
        {:error, :not_found}

      run ->
        run
        |> PayrollRun.changeset(%{status: "Posted", journal_entry_id: journal_entry_id})
        |> Repo.update()
    end
  end

  defp fetch_run(run_id, nil), do: fetch_run(run_id, :any)

  defp fetch_run(run_id, :any) do
    case Repo.get(PayrollRun, run_id) do
      nil -> {:error, :not_found}
      run -> {:ok, run}
    end
  end

  defp fetch_run(run_id, owner_id) do
    case Repo.get_by(PayrollRun, id: run_id, owner_id: owner_id) do
      nil -> {:error, :not_found}
      run -> {:ok, run}
    end
  end

  defp require_status(%{status: status}, allowed) do
    if status in allowed, do: :ok, else: {:error, {:invalid_status, status}}
  end

  defp update_payroll_status(run, status, extra) do
    run
    |> PayrollRun.changeset(Map.merge(extra, %{status: status}))
    |> Repo.update()
  end

  @doc """
  Gross = (basic + allowances) × attendance factor + overtime.
  Attendance factor = (worked days + approved leave days) / period calendar days.
  OT hours = sum of (clock hours − 8) for days over 8h.
  """
  def calculate_payslip(%Employee{} = emp, period_start, period_end) do
    period_days = max(Date.diff(period_end, period_start) + 1, 1)
    basic = to_dec(emp.basic_salary)
    allowances = sum_allowances(emp.allowances)
    salary = Decimal.add(basic, allowances)

    {days_present, ot_hours} = attendance_summary(emp.id, period_start, period_end)
    leave_days = approved_leave_days(emp.id, period_start, period_end)

    # If no attendance clocked yet in the period, treat as full-month salary (common for salaried staff).
    # Once clocks exist, pay is prorated by present + approved leave days.
    credited_days =
      if Decimal.compare(days_present, 0) == :eq and Decimal.compare(leave_days, 0) == :eq do
        Decimal.new(period_days)
      else
        Decimal.add(days_present, leave_days)
        |> Decimal.min(Decimal.new(period_days))
      end

    factor =
      Decimal.div(credited_days, Decimal.new(period_days))
      |> Decimal.min(Decimal.new(1))

    base_pay = Decimal.mult(salary, factor) |> Decimal.round(2)

    hourly =
      salary
      |> Decimal.div(Decimal.new(period_days))
      |> Decimal.div(Decimal.new(8))

    ot_mult = to_dec(emp.overtime_rate || "1.5")
    overtime_pay = Decimal.mult(Decimal.mult(hourly, ot_hours), ot_mult) |> Decimal.round(2)

    gross = Decimal.add(base_pay, overtime_pay) |> Decimal.round(2)
    deductions = PayrollDeductions.compute(gross, basic)
    net = Decimal.sub(gross, deductions.total) |> Decimal.round(2)

    %{
      gross_pay: gross,
      net_pay: net,
      days_worked: credited_days,
      overtime_hours: ot_hours,
      earnings: %{
        "basic" => to_string(basic),
        "allowances" => to_string(allowances),
        "attendance_factor" => to_string(factor),
        "base_pay" => to_string(base_pay),
        "overtime_pay" => to_string(overtime_pay)
      },
      deductions: %{
        "income_tax" => to_string(deductions.income_tax),
        "eobi" => to_string(deductions.eobi)
      }
    }
  end

  defp attendance_summary(employee_id, from_date, to_date) do
    records =
      from(a in AttendanceRecord,
        where:
          a.employee_id == ^employee_id and a.date >= ^from_date and a.date <= ^to_date and
            not is_nil(a.clock_in)
      )
      |> Repo.all()

    days = Decimal.new(length(records))

    ot =
      Enum.reduce(records, Decimal.new(0), fn rec, acc ->
        hours = hours_worked(rec)
        ot = Decimal.sub(hours, Decimal.new(8)) |> Decimal.max(Decimal.new(0))
        Decimal.add(acc, ot)
      end)

    {days, Decimal.round(ot, 2)}
  end

  defp hours_worked(%{clock_in: nil}), do: Decimal.new(0)

  defp hours_worked(%{clock_in: _cin, clock_out: nil}) do
    # Open shift: count at least standard day if still open
    Decimal.new(8)
  end

  defp hours_worked(%{clock_in: cin, clock_out: cout}) do
    secs = DateTime.diff(cout, cin, :second)
    Decimal.div(Decimal.new(max(secs, 0)), Decimal.new(3600)) |> Decimal.round(2)
  end

  defp approved_leave_days(employee_id, from_date, to_date) do
    leaves =
      from(l in LeaveRequest,
        where:
          l.employee_id == ^employee_id and l.status == "Approved" and
            l.start_date <= ^to_date and l.end_date >= ^from_date
      )
      |> Repo.all()

    Enum.reduce(leaves, Decimal.new(0), fn leave, acc ->
      overlap_start = Enum.max([leave.start_date, from_date], Date)
      overlap_end = Enum.min([leave.end_date, to_date], Date)
      days = Date.diff(overlap_end, overlap_start) + 1
      Decimal.add(acc, Decimal.new(max(days, 0)))
    end)
  end

  ## —— ESS (HR-FR-011) —————————————————————————————————————————

  def ess_summary(user_id, business_id, owner_id) do
    case find_employee_for_user(user_id, business_id, owner_id) do
      nil ->
        {:error, :no_employee_profile}

      emp ->
        attendance = list_attendance(business_id, owner_id, employee_id: emp.id, limit: 60)
        leave = list_leave(business_id, owner_id, employee_id: emp.id)

        payslips =
          from(p in Payslip,
            join: r in PayrollRun,
            on: p.payroll_run_id == r.id,
            where: p.employee_id == ^emp.id and r.status in ["Approved", "Posted", "Disbursed"],
            order_by: [desc: r.period_end],
            preload: [:payroll_run],
            limit: 24
          )
          |> Repo.all()

        open = open_attendance_for_employee(emp.id)

        {:ok,
         %{
           employee: emp,
           open_attendance: open,
           attendance: attendance,
           leave: leave,
           payslips: payslips
         }}
    end
  end

  def list_payslips_for_employee(employee_id, owner_id) do
    from(p in Payslip,
      join: r in PayrollRun,
      on: p.payroll_run_id == r.id,
      where: p.employee_id == ^employee_id and r.owner_id == ^owner_id,
      order_by: [desc: r.period_end],
      preload: [:payroll_run, :employee]
    )
    |> Repo.all()
  end

  ## —— helpers ————————————————————————————————————————————————

  defp sum_allowances(map) when is_map(map) do
    Enum.reduce(Map.values(map), Decimal.new(0), fn v, acc ->
      Decimal.add(acc, to_dec(v))
    end)
  end

  defp sum_allowances(_), do: Decimal.new(0)

  defp to_dec(%Decimal{} = d), do: d
  defp to_dec(nil), do: Decimal.new(0)
  defp to_dec(v) when is_binary(v), do: Decimal.new(String.replace(v, ~r/[,\s]/, ""))
  defp to_dec(v), do: Decimal.new("#{v}")

  defp normalize_attrs(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_binary(k) ->
        key =
          try do
            String.to_existing_atom(k)
          rescue
            ArgumentError -> String.to_atom(k)
          end

        {key, v}

      {k, v} ->
        {k, v}
    end)
  end
end
