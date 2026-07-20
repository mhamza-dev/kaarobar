defmodule KaarobarWeb.V1.EssController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Hr
  alias KaarobarWeb.V1.{EmployeeController, PayrollController}

  def me(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.ess_summary(user.id, business_id, owner_id) do
      {:ok, summary} ->
        json(conn, %{
          data: %{
            employee: EmployeeController.serialize(summary.employee),
            open_attendance:
              summary.open_attendance &&
                %{
                  id: summary.open_attendance.id,
                  date: summary.open_attendance.date,
                  clock_in: summary.open_attendance.clock_in
                },
            attendance:
              Enum.map(summary.attendance, fn a ->
                %{
                  id: a.id,
                  date: a.date,
                  clock_in: a.clock_in,
                  clock_out: a.clock_out,
                  source: a.source
                }
              end),
            leave:
              Enum.map(summary.leave, fn l ->
                %{
                  id: l.id,
                  type: l.type,
                  start_date: l.start_date,
                  end_date: l.end_date,
                  status: l.status,
                  reason: l.reason
                }
              end),
            payslips: Enum.map(summary.payslips, &PayrollController.serialize_payslip/1)
          }
        })

      {:error, :no_employee_profile} ->
        conn |> put_status(:not_found) |> json(%{error: "no_employee_profile"})
    end
  end
end
