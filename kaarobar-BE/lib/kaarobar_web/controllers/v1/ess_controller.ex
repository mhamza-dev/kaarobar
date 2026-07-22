defmodule KaarobarWeb.V1.EssController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Hr
  alias Kaarobar.Profiles
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

  def upload_profile_pic(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.find_employee_for_user(user.id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "no_employee_profile"})

      emp ->
        case extract_upload(params) do
          {:ok, upload} ->
            case Profiles.upload_employee_pic(emp, upload) do
              {:ok, updated} -> json(conn, %{data: EmployeeController.serialize(updated)})
              {:error, reason} -> profile_pic_error(conn, reason)
            end

          {:error, reason} ->
            profile_pic_error(conn, reason)
        end
    end
  end

  def delete_profile_pic(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.find_employee_for_user(user.id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "no_employee_profile"})

      emp ->
        case Profiles.clear_employee_pic(emp) do
          {:ok, updated} -> json(conn, %{data: EmployeeController.serialize(updated)})
          {:error, reason} -> profile_pic_error(conn, reason)
        end
    end
  end

  defp extract_upload(%{"file" => %Plug.Upload{} = upload}), do: {:ok, upload}
  defp extract_upload(%{"image" => %Plug.Upload{} = upload}), do: {:ok, upload}
  defp extract_upload(%{"profile_pic" => %Plug.Upload{} = upload}), do: {:ok, upload}
  defp extract_upload(_), do: {:error, :missing_file}

  defp profile_pic_error(conn, reason) do
    error =
      case reason do
        :missing_file -> "missing_file"
        :invalid_upload -> "invalid_upload"
        :unsupported_type -> "unsupported_type"
        :too_large -> "too_large"
        :empty -> "empty"
        other -> inspect(other)
      end

    conn |> put_status(:unprocessable_entity) |> json(%{error: error})
  end
end
