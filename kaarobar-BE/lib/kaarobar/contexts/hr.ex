defmodule Kaarobar.Hr do
  import Ecto.Query
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{Employee, AttendanceRecord, LeaveRequest, PayrollRun, Payslip}

  def create_employee(attrs) do
    %Employee{}
    |> Employee.changeset(attrs)
    |> Repo.insert()
  end

  def list_employees(business_id, owner_id) do
    Employee
    |> where([e], e.business_id == ^business_id and e.owner_id == ^owner_id)
    |> Repo.all()
  end

  def clock_in(attrs) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    %AttendanceRecord{}
    |> AttendanceRecord.changeset(Map.put(attrs, :clock_in, now))
    |> Repo.insert()
  end

  def clock_out(attendance_id) do
    case Repo.get(AttendanceRecord, attendance_id) do
      nil ->
        {:error, :not_found}

      record ->
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        record
        |> AttendanceRecord.changeset(%{clock_out: now})
        |> Repo.update()
    end
  end

  def request_leave(attrs) do
    %LeaveRequest{}
    |> LeaveRequest.changeset(Map.put_new(attrs, :status, "Pending"))
    |> Repo.insert()
  end

  def approve_leave(leave_id, approver_id) do
    case Repo.get(LeaveRequest, leave_id) do
      nil ->
        {:error, :not_found}

      leave ->
        leave
        |> LeaveRequest.changeset(%{status: "Approved", approved_by_id: approver_id})
        |> Repo.update()
    end
  end

  def create_payroll_run(business_id, owner_id, period_start, period_end) do
    employees = list_employees(business_id, owner_id)

    multi =
      Ecto.Multi.new()
      |> Ecto.Multi.insert(:run, fn _ ->
        %PayrollRun{}
        |> PayrollRun.changeset(%{
          business_id: business_id,
          owner_id: owner_id,
          period_start: period_start,
          period_end: period_end,
          status: "Draft"
        })
      end)
      |> Ecto.Multi.run(:payslips, fn _repo, %{run: run} ->
        slips =
          Enum.map(employees, fn emp ->
            basic = emp.basic_salary || Decimal.new(0)

            allowances =
              case emp.allowances do
                map when is_map(map) ->
                  Enum.reduce(Map.values(map), Decimal.new(0), fn v, acc ->
                    Decimal.add(acc, to_decimal(v))
                  end)

                _ ->
                  Decimal.new(0)
              end

            gross = Decimal.add(basic, allowances)
            tax = Decimal.mult(gross, Decimal.new("0.05")) |> Decimal.round(2)
            eobi = Decimal.new("100.00")
            deductions = %{"income_tax" => to_string(tax), "eobi" => to_string(eobi)}
            net = gross |> Decimal.sub(tax) |> Decimal.sub(eobi)

            %Payslip{}
            |> Payslip.changeset(%{
              payroll_run_id: run.id,
              employee_id: emp.id,
              gross_pay: gross,
              deductions: deductions,
              net_pay: net
            })
            |> Repo.insert()
          end)

        if Enum.all?(slips, &match?({:ok, _}, &1)) do
          {:ok, Enum.map(slips, fn {:ok, s} -> s end)}
        else
          {:error, :payslip_failed}
        end
      end)

    case Repo.transaction(multi) do
      {:ok, %{run: run}} -> {:ok, Repo.preload(run, :payslips)}
      {:error, _op, reason, _} -> {:error, reason}
    end
  end

  def submit_payroll(run_id), do: update_payroll_status(run_id, "PendingApproval")

  def approve_payroll(run_id, approver_id) do
    case update_payroll_status(run_id, "Approved", %{approved_by_id: approver_id}) do
      {:ok, run} ->
        %{
          payroll_run_id: run.id,
          business_id: run.business_id,
          owner_id: run.owner_id,
          approved_by_id: approver_id
        }
        |> Kaarobar.Workers.PostPayrollJournalWorker.new()
        |> Oban.insert()

        {:ok, run}

      error ->
        error
    end
  end

  def reject_payroll(run_id), do: update_payroll_status(run_id, "Rejected")

  defp update_payroll_status(run_id, status, extra \\ %{}) do
    case Repo.get(PayrollRun, run_id) do
      nil ->
        {:error, :not_found}

      run ->
        run
        |> PayrollRun.changeset(Map.merge(extra, %{status: status}))
        |> Repo.update()
    end
  end

  defp to_decimal(%Decimal{} = d), do: d
  defp to_decimal(v), do: Decimal.new("#{v}")
end
