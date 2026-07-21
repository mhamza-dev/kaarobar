defmodule KaarobarWeb.V1.LeaveController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Hr

  def index(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    opts =
      []
      |> maybe(:status, params["status"])
      |> maybe(:employee_id, params["employee_id"])

    data = Hr.list_leave(business_id, owner_id, opts) |> Enum.map(&serialize/1)
    json(conn, %{data: data})
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    employee_id =
      params["employee_id"] ||
        case Hr.find_employee_for_user(user.id, business_id, owner_id) do
          nil -> nil
          emp -> emp.id
        end

    if is_nil(employee_id) do
      conn |> put_status(:bad_request) |> json(%{error: "employee_required"})
    else
      attrs = %{
        employee_id: employee_id,
        owner_id: owner_id,
        business_id: business_id,
        type: params["type"] || "annual",
        start_date: params["start_date"],
        end_date: params["end_date"],
        reason: params["reason"],
        status: "Pending"
      }

      case Hr.request_leave(attrs) do
        {:ok, leave} ->
          leave = Hr.preload_leave(leave)
          notify_leave_request(business_id, owner_id, user, leave)
          conn |> put_status(:created) |> json(%{data: serialize(leave)})

        {:error, reason} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
      end
    end
  end

  def approve(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.approve_leave(id, user.id, owner_id) do
      {:ok, leave} ->
        leave = Hr.preload_leave(leave)
        notify_leave_decision(leave, "leave.approved", "Your leave request was approved.")
        json(conn, %{data: serialize(leave)})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def reject(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.reject_leave(id, user.id, owner_id) do
      {:ok, leave} ->
        leave = Hr.preload_leave(leave)
        notify_leave_decision(leave, "leave.rejected", "Your leave request was rejected.")
        json(conn, %{data: serialize(leave)})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp serialize(leave) do
    %{
      id: leave.id,
      employee_id: leave.employee_id,
      employee_name: employee_name(leave),
      type: leave.type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      status: leave.status,
      reason: leave.reason,
      approved_by_id: leave.approved_by_id
    }
  end

  defp employee_name(%{employee: %{name: name}}), do: name
  defp employee_name(_), do: nil

  defp notify_leave_request(business_id, owner_id, requester, leave) do
    Kaarobar.Notifications.notify_roles(
      business_id,
      owner_id,
      ["owner", "admin", "hr_manager"],
      "leave_request",
      %{leave_id: leave.id, from_user_id: requester.id},
      title: "Leave request submitted",
      body: "#{requester.name || requester.email} submitted a leave request."
    )
  end

  defp notify_leave_decision(leave, type, body) do
    leave = Kaarobar.Repo.preload(leave, :employee)
    user_id =
      case leave.employee do
        %{user_id: uid} -> uid
        _ -> nil
      end

    if user_id do
      Kaarobar.Notifications.notify(
        user_id,
        leave.owner_id,
        type,
        %{leave_id: leave.id, status: leave.status},
        title: Kaarobar.Notifications.human_title(type),
        body: body
      )
    end
  end

  defp maybe(opts, _k, nil), do: opts
  defp maybe(opts, k, v), do: Keyword.put(opts, k, v)
end
