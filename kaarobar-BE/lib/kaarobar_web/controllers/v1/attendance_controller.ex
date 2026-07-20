defmodule KaarobarWeb.V1.AttendanceController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Hr

  def index(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    opts =
      []
      |> maybe_kw(:employee_id, params["employee_id"])
      |> maybe_date(:from, params["from"])
      |> maybe_date(:to, params["to"])

    data =
      Hr.list_attendance(business_id, owner_id, opts)
      |> Enum.map(&serialize/1)

    json(conn, %{data: data})
  end

  def clock_in(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    employee_id =
      params["employee_id"] ||
        case Hr.find_employee_for_user(user.id, business_id, owner_id) do
          nil -> nil
          emp -> emp.id
        end

    if is_nil(employee_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "employee_and_branch_required"})
    else
      attrs = %{
        employee_id: employee_id,
        branch_id: branch_id,
        owner_id: owner_id,
        business_id: business_id,
        date: Date.utc_today(),
        source: params["source"] || "mobile"
      }

      case Hr.clock_in(attrs) do
        {:ok, rec} -> conn |> put_status(:created) |> json(%{data: serialize(rec)})
        {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
      end
    end
  end

  def clock_out(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.clock_out(id, owner_id) do
      {:ok, rec} -> json(conn, %{data: serialize(rec)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp serialize(rec) do
    %{
      id: rec.id,
      employee_id: rec.employee_id,
      employee_name: rec.employee && rec.employee.name,
      branch_id: rec.branch_id,
      date: rec.date,
      clock_in: rec.clock_in,
      clock_out: rec.clock_out,
      source: rec.source
    }
  end

  defp maybe_kw(opts, _k, nil), do: opts
  defp maybe_kw(opts, k, v), do: Keyword.put(opts, k, v)

  defp maybe_date(opts, _k, nil), do: opts

  defp maybe_date(opts, k, str) do
    case Date.from_iso8601(str) do
      {:ok, d} -> Keyword.put(opts, k, d)
      _ -> opts
    end
  end
end
