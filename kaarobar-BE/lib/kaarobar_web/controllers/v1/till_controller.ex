defmodule KaarobarWeb.V1.TillController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Pos

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = conn.assigns[:branch_id]

    if is_nil(business_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_branch_required"})
    else
      data =
        branch_id
        |> Pos.list_tills(owner_id, business_id)
        |> Enum.map(&serialize/1)

      json(conn, %{data: data})
    end
  end

  def show(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Pos.get_till(id, owner_id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      till -> json(conn, %{data: serialize(till)})
    end
  end

  def open(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    case Pos.open_till(branch_id, owner_id, business_id, user.id, params["opening_cash"] || "0") do
      {:ok, till} -> conn |> put_status(:created) |> json(%{data: serialize(till)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def close(conn, %{"id" => id} = params) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Pos.close_till(id, owner_id, params["closing_cash"] || "0") do
      {:ok, till} -> json(conn, %{data: serialize(till)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def current(conn, _params) do
    branch_id = conn.assigns[:branch_id]

    case Pos.open_till_for_branch(branch_id) do
      nil -> json(conn, %{data: nil})
      till -> json(conn, %{data: serialize(till)})
    end
  end

  defp serialize(till) do
    %{
      id: till.id,
      branch_id: till.branch_id,
      status: till.status,
      opening_cash: to_string(till.opening_cash || 0),
      closing_cash: till.closing_cash && to_string(till.closing_cash),
      expected_cash: till.expected_cash && to_string(till.expected_cash),
      over_short: till.over_short && to_string(till.over_short),
      opened_at: till.opened_at,
      closed_at: till.closed_at
    }
  end
end
