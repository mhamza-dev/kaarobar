defmodule KaarobarWeb.V1.ReturnController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Pos

  def index(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = conn.assigns[:branch_id]

    if is_nil(business_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_branch_required"})
    else
      opts =
        case params["status"] do
          nil -> []
          status -> [status: status]
        end

      data =
        branch_id
        |> Pos.list_returns(owner_id, business_id, opts)
        |> Enum.map(&serialize/1)

      json(conn, %{data: data})
    end
  end

  def pending(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = conn.assigns[:branch_id]

    if is_nil(business_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_branch_required"})
    else
      data =
        branch_id
        |> Pos.list_pending_returns(owner_id, business_id)
        |> Enum.map(&serialize/1)

      json(conn, %{data: data})
    end
  end

  def show(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Pos.get_return(id, owner_id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      ret -> json(conn, %{data: serialize(ret)})
    end
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    case Pos.create_return(params["sale_id"], owner_id, business_id, branch_id, user.id, params) do
      {:ok, ret} ->
        conn |> put_status(:created) |> json(%{data: serialize(ret)})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def approve(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Pos.approve_return(id, user.id, owner_id) do
      {:ok, ret} -> json(conn, %{data: serialize(ret)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def reject(conn, %{"id" => id} = params) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Pos.reject_return(id, user.id, owner_id, params["reason"]) do
      {:ok, ret} -> json(conn, %{data: serialize(ret)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp serialize(ret) do
    ret = Kaarobar.Repo.preload(ret, [:items])

    %{
      id: ret.id,
      sale_id: ret.sale_id,
      status: ret.status,
      refund_amount: to_string(ret.refund_amount),
      refund_method: ret.refund_method,
      till_id: ret.till_id,
      reason: ret.reason,
      rejection_reason: ret.rejection_reason,
      items:
        Enum.map(ret.items || [], fn i ->
          %{
            product_id: i.product_id,
            sale_item_id: i.sale_item_id,
            quantity: to_string(i.quantity),
            amount: to_string(i.amount)
          }
        end)
    }
  end
end
