defmodule KaarobarWeb.V1.EmployeeController do
  use KaarobarWeb, :controller
  alias Kaarobar.Hr
  alias Kaarobar.Guardian

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    json(conn, %{data: Hr.list_employees(business_id, owner_id)})
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:current_branch_id]

    attrs =
      Map.merge(params, %{
        "business_id" => business_id,
        "owner_id" => owner_id,
        "branch_id" => branch_id
      })

    # atomize for changeset via string keys - schemas use cast so string keys OK if we pass map with string keys
    case Hr.create_employee(atomize(attrs)) do
      {:ok, emp} -> conn |> put_status(:created) |> json(%{data: emp})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  defp atomize(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) -> {String.to_existing_atom(k), v}
      {k, v} -> {k, v}
    end)
  rescue
    ArgumentError ->
      Map.new(map, fn
        {k, v} when is_binary(k) -> {String.to_atom(k), v}
        {k, v} -> {k, v}
      end)
  end
end
