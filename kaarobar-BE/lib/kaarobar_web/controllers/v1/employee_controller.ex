defmodule KaarobarWeb.V1.EmployeeController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Hr

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    data = Hr.list_employees(business_id, owner_id) |> Enum.map(&serialize/1)
    json(conn, %{data: data})
  end

  def show(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.get_employee(id, owner_id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      emp -> json(conn, %{data: serialize(emp)})
    end
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    attrs =
      Map.merge(params, %{
        "business_id" => business_id,
        "owner_id" => owner_id,
        "branch_id" => branch_id
      })

    case Hr.create_employee(attrs) do
      {:ok, emp} -> conn |> put_status(:created) |> json(%{data: serialize(emp)})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Hr.update_employee(id, owner_id, params) do
      {:ok, emp} -> json(conn, %{data: serialize(emp)})
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs)})
    end
  end

  def serialize(emp) do
    %{
      id: emp.id,
      employee_code: emp.employee_code,
      name: emp.name,
      position: emp.position,
      join_date: emp.join_date,
      basic_salary: to_string(emp.basic_salary || 0),
      allowances: emp.allowances || %{},
      status: emp.status,
      phone: emp.phone,
      cnic: emp.cnic,
      bank_iban: emp.bank_iban,
      overtime_rate: to_string(emp.overtime_rate || "1.5"),
      user_id: emp.user_id,
      branch_id: emp.branch_id,
      business_id: emp.business_id
    }
  end
end
