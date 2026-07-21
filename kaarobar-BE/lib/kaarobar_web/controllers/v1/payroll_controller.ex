defmodule KaarobarWeb.V1.PayrollController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Hr

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    data = Hr.list_payroll_runs(business_id, owner_id) |> Enum.map(&serialize_run/1)
    json(conn, %{data: data})
  end

  def show(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.get_payroll_run(id, owner_id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      run -> json(conn, %{data: serialize_run(run)})
    end
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    from = parse_date(params["period_start"]) || beginning_of_month()
    to = parse_date(params["period_end"]) || Date.utc_today()

    case Hr.create_payroll_run(business_id, owner_id, from, to) do
      {:ok, run} -> conn |> put_status(:created) |> json(%{data: serialize_run(run)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def submit(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.submit_payroll(id, owner_id) do
      {:ok, run} -> json(conn, %{data: serialize_run(Hr.get_payroll_run(run.id, owner_id) || run)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def recalculate(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.recalculate_payroll(id, owner_id) do
      {:ok, run} -> json(conn, %{data: serialize_run(run)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def approve(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.approve_payroll(id, user.id, owner_id) do
      {:ok, run} -> json(conn, %{data: serialize_run(run)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def reject(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.reject_payroll(id, owner_id) do
      {:ok, run} -> json(conn, %{data: serialize_run(run)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp serialize_run(run) do
    %{
      id: run.id,
      period_start: run.period_start,
      period_end: run.period_end,
      status: run.status,
      approved_by_id: run.approved_by_id,
      journal_entry_id: run.journal_entry_id,
      payslips:
        Enum.map(run.payslips || [], fn slip ->
          serialize_payslip(slip, run)
        end)
    }
  end

  def serialize_payslip(slip), do: serialize_payslip(slip, nil)

  def serialize_payslip(slip, run) do
    payroll_run = loaded_assoc(slip.payroll_run) || run
    employee = loaded_assoc(Map.get(slip, :employee))

    %{
      id: slip.id,
      employee_id: slip.employee_id,
      employee_name: employee && employee.name,
      employee_code: employee && employee.employee_code,
      gross_pay: to_string(slip.gross_pay || 0),
      net_pay: to_string(slip.net_pay || 0),
      deductions: slip.deductions || %{},
      earnings: slip.earnings || %{},
      days_worked: to_string(slip.days_worked || 0),
      overtime_hours: to_string(slip.overtime_hours || 0),
      period_start: payroll_run && payroll_run.period_start,
      period_end: payroll_run && payroll_run.period_end,
      status: payroll_run && payroll_run.status
    }
  end

  defp loaded_assoc(%Ecto.Association.NotLoaded{}), do: nil
  defp loaded_assoc(nil), do: nil
  defp loaded_assoc(assoc), do: assoc

  defp beginning_of_month do
    today = Date.utc_today()
    %{today | day: 1}
  end

  defp parse_date(nil), do: nil

  defp parse_date(str) do
    case Date.from_iso8601(str) do
      {:ok, d} -> d
      _ -> nil
    end
  end
end
