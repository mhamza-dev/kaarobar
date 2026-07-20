defmodule KaarobarWeb.V1.TillController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Pos

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
