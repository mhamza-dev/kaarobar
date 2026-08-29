defmodule KaarobarWeb.CustomerGroupController do
  @moduledoc """
  Classes of customer who buy on different terms.

  Viewing is separate from managing on purpose: a cashier needs to see which
  group a customer is in to understand the price on screen, and must not be
  able to change what that group means.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Customers

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "customer_group:view"] when action in [:index, :show]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "customer_group:manage"] when action in [:create, :update, :delete]

  def index(conn, _params) do
    render(conn, :groups, groups: Customers.list_groups(conn.assigns.scope))
  end

  def show(conn, %{"id" => id}) do
    with {:ok, group} <- Customers.fetch_group(conn.assigns.scope, id) do
      render(conn, :group, group: group)
    end
  end

  def create(conn, params) do
    with {:ok, group} <- Customers.create_group(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:group, group: group)
    end
  end

  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, group} <- Customers.fetch_group(scope, id),
         {:ok, updated} <- Customers.update_group(scope, group, params) do
      render(conn, :group, group: updated)
    end
  end

  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, group} <- Customers.fetch_group(scope, id),
         {:ok, deleted} <- Customers.delete_group(scope, group) do
      render(conn, :group, group: deleted)
    end
  end
end
