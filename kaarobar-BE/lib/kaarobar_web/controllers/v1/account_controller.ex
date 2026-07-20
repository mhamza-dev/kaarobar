defmodule KaarobarWeb.V1.AccountController do
  use KaarobarWeb, :controller

  alias Kaarobar.Accounting
  alias Kaarobar.Guardian

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_required"})
    else
      data =
        Accounting.list_accounts(business_id, owner_id)
        |> Enum.map(&serialize/1)

      json(conn, %{data: data})
    end
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    case Accounting.create_account(business_id, owner_id, params) do
      {:ok, account} -> conn |> put_status(:created) |> json(%{data: serialize(account)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Accounting.update_account(id, owner_id, params) do
      {:ok, account} -> json(conn, %{data: serialize(account)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp serialize(a) do
    %{
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      parent_account_id: a.parent_account_id
    }
  end
end
