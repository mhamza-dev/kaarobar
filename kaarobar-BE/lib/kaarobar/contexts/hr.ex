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
    normalized = normalize_attrs(attrs)
    date = normalize_date(normalized[:date] || Date.utc_today())
    employee_id = normalized[:employee_id]

    case get_attendance_for_day(employee_id, date) do
      %{clock_out: nil} = existing ->
        # Already clocked in today — return the open record (idempotent).
        {:ok, existing}

      %{clock_out: %DateTime{}} = existing ->
        # Same-day re-entry: reopen the existing unique row.
        existing
        |> AttendanceRecord.changeset(%{
          clock_in: now,
          source: normalized[:source] || existing.source,
          branch_id: normalized[:branch_id] || existing.branch_id
        })
        |> Ecto.Changeset.put_change(:clock_out, nil)
        |> Ecto.Changeset.put_change(:hours_worked, nil)
        |> Repo.update()

      nil ->
        %AttendanceRecord{}
        |> AttendanceRecord.changeset(
          Map.merge(normalized, %{clock_in: now, date: date, hours_worked: nil})
        )
        |> Repo.insert()
    end
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
        hours = compute_shift_hours(record.clock_in, now)

        record
        |> AttendanceRecord.changeset(%{clock_out: now, hours_worked: hours})
        |> Repo.update()
    end
  end

  @doc """
  Hours between two timestamps, rounded to 2 decimals. Nil/invalid → 0.
  """
  def compute_shift_hours(nil, _), do: Decimal.new(0)
  def compute_shift_hours(_, nil), do: Decimal.new(0)

  def compute_shift_hours(%DateTime{} = cin, %DateTime{} = cout) do
    secs = DateTime.diff(cout, cin, :second)

    Decimal.div(Decimal.new(max(secs, 0)), Decimal.new(3600))
    |> Decimal.round(2)
  end

  def compute_shift_hours(_, _), do: Decimal.new(0)
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

  def get_attendance_for_day(nil, _date), do: nil

  def get_attendance_for_day(employee_id, date) do
    from(a in AttendanceRecord,
      where: a.employee_id == ^employee_id and a.date == ^date
    )
    |> Repo.one()
  end

  def preload_attendance(%AttendanceRecord{} = record) do
    Repo.preload(record, :employee)
  end

  def preload_attendance(record), do: record

  ## —— Leave (HR-FR-005) ———————————————————————————————————————

  def request_leave(attrs) do
    %LeaveRequest{}
    |> LeaveRequest.changeset(Map.put_new(normalize_attrs(attrs), :status, "Pending"))
    |> Repo.insert()
  end

  def preload_leave(%LeaveRequest{} = leave), do: Repo.preload(leave, :employee)
  def preload_leave(leave), do: leave

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
         :ok <- require_status(run, ["Draft", "Rejected"]),
         {:ok, _recalc} <- recalculate_payroll(run.id, owner_id),
         {:ok, fresh} <- fetch_run(run.id, owner_id),
         {:ok, updated} <- update_payroll_status(fresh, "PendingApproval", %{}) do
      Kaarobar.Notifications.notify_roles(
        updated.business_id,
        updated.owner_id,
        ["owner", "admin", "accountant"],
        "payroll.pending",
        %{payroll_run_id: updated.id},
        title: "Payroll awaiting approval",
        body: "Payroll #{updated.period_start}–#{updated.period_end} was submitted for approval."
      )

      {:ok, updated}
    end
  end

  @doc """
  Rebuild payslips for a Draft/Rejected run from latest attendance and leave.
  """
  def recalculate_payroll(run_id, owner_id \\ nil) do
    with {:ok, run} <- fetch_run(run_id, owner_id),
         :ok <- require_status(run, ["Draft", "Rejected"]) do
      employees = list_employees(run.business_id, run.owner_id, status: "active")

      Multi.new()
      |> Multi.delete_all(
        :clear_slips,
        from(p in Payslip, where: p.payroll_run_id == ^run.id)
      )
      |> Multi.run(:payslips, fn _repo, _ ->
        slips =
          Enum.map(employees, fn emp ->
            calc = calculate_payslip(emp, run.period_start, run.period_end)

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
      |> Multi.run(:audit, fn _repo, _ ->
        Audit.log(%{
          owner_id: run.owner_id,
          user_id: run.owner_id,
          action: "payroll.recalculate",
          entity_type: "payroll_run",
          entity_id: run.id,
          metadata: %{period_start: run.period_start, period_end: run.period_end}
        })
      end)
      |> Repo.transaction()
      |> case do
        {:ok, _} -> {:ok, get_payroll_run!(run.id)}
        {:error, _op, reason, _} -> {:error, reason}
      end
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

          Kaarobar.Notifications.notify_roles(
            approved.business_id,
            approved.owner_id,
            ["owner", "admin", "accountant"],
            "payroll.approved",
            %{payroll_run_id: approved.id, period_start: approved.period_start, period_end: approved.period_end},
            title: "Payroll approved",
            body: "Payroll #{approved.period_start}–#{approved.period_end} was approved and is posting to the ledger."
          )

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
  Hours-based payroll for the period (Mon-Sat x 8h expected).

  - Only completed shifts (clock_in + clock_out) count toward worked hours / OT.
  - Approved leave credits 8h per overlapping calendar day.
  - Zero clocks and zero leave -> zero base pay (no full-month fallback).
  """
  def calculate_payslip(%Employee{} = emp, period_start, period_end) do
    basic = to_dec(emp.basic_salary)
    allowances = sum_allowances(emp.allowances)
    salary = Decimal.add(basic, allowances)

    expected_hours = expected_working_hours(period_start, period_end)

    {days_present, worked_hours, ot_hours} =
      attendance_hours_summary(emp.id, period_start, period_end)

    leave_days = approved_leave_days(emp.id, period_start, period_end)
    leave_hours = Decimal.mult(leave_days, Decimal.new(8))

    credited_hours =
      Decimal.add(worked_hours, leave_hours)
      |> Decimal.min(expected_hours)

    factor =
      if Decimal.compare(expected_hours, 0) == :eq do
        Decimal.new(0)
      else
        Decimal.div(credited_hours, expected_hours)
        |> Decimal.min(Decimal.new(1))
      end

    base_pay = Decimal.mult(salary, factor) |> Decimal.round(2)

    hourly =
      if Decimal.compare(expected_hours, 0) == :eq do
        Decimal.new(0)
      else
        Decimal.div(salary, expected_hours)
      end

    ot_mult = to_dec(emp.overtime_rate || "1.5")
    overtime_pay = Decimal.mult(Decimal.mult(hourly, ot_hours), ot_mult) |> Decimal.round(2)

    gross = Decimal.add(base_pay, overtime_pay) |> Decimal.round(2)

    deductions =
      if Decimal.compare(gross, 0) == :eq do
        %{income_tax: Decimal.new("0.00"), eobi: Decimal.new("0.00"), total: Decimal.new("0.00")}
      else
        PayrollDeductions.compute(gross, basic)
      end

    net = Decimal.sub(gross, deductions.total) |> Decimal.round(2)

    %{
      gross_pay: gross,
      net_pay: net,
      days_worked: days_present,
      overtime_hours: ot_hours,
      earnings: %{
        "basic" => to_string(basic),
        "allowances" => to_string(allowances),
        "worked_hours" => to_string(worked_hours),
        "leave_hours" => to_string(leave_hours),
        "expected_hours" => to_string(expected_hours),
        "credited_hours" => to_string(credited_hours),
        "attendance_factor" => to_string(factor),
        "base_pay" => to_string(base_pay),
        "overtime_pay" => to_string(overtime_pay),
        "ot_hours" => to_string(ot_hours)
      },
      deductions: %{
        "income_tax" => to_string(deductions.income_tax),
        "eobi" => to_string(deductions.eobi)
      }
    }
  end

  @doc """
  Count Mon-Sat days in [from, to] inclusive x 8 hours.
  """
  def expected_working_hours(from_date, to_date) do
    days = count_working_days(from_date, to_date)
    Decimal.mult(Decimal.new(days), Decimal.new(8))
  end

  def count_working_days(from_date, to_date) do
    if Date.compare(from_date, to_date) == :gt do
      0
    else
      from_date
      |> Date.range(to_date)
      |> Enum.count(fn d -> Date.day_of_week(d) != 7 end)
    end
  end

  defp attendance_hours_summary(employee_id, from_date, to_date) do
    records =
      from(a in AttendanceRecord,
        where:
          a.employee_id == ^employee_id and a.date >= ^from_date and a.date <= ^to_date and
            not is_nil(a.clock_in) and not is_nil(a.clock_out)
      )
      |> Repo.all()

    days = Decimal.new(length(records))

    {worked, ot} =
      Enum.reduce(records, {Decimal.new(0), Decimal.new(0)}, fn rec, {w_acc, ot_acc} ->
        hours =
          cond do
            match?(%Decimal{}, rec.hours_worked) ->
              rec.hours_worked

            true ->
              compute_shift_hours(rec.clock_in, rec.clock_out)
          end

        day_ot = Decimal.sub(hours, Decimal.new(8)) |> Decimal.max(Decimal.new(0))
        {Decimal.add(w_acc, hours), Decimal.add(ot_acc, day_ot)}
      end)

    {days, Decimal.round(worked, 2), Decimal.round(ot, 2)}
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
            preload: [:payroll_run, :employee],
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

  defp normalize_date(%Date{} = date), do: date

  defp normalize_date(str) when is_binary(str) do
    case Date.from_iso8601(str) do
      {:ok, date} -> date
      _ -> Date.utc_today()
    end
  end

  defp normalize_date(_), do: Date.utc_today()
end
