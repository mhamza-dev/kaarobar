defmodule KaarobarWeb.ModifierGroupController do
  @moduledoc """
  Modifier groups — the choices made at the counter rather than in the catalog.

  Groups are reusable and attach to many products, so "Spice level" is defined
  once and every curry on the menu gets it.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Audit
  alias Kaarobar.Catalog

  plug KaarobarWeb.Plugs.Authorize, [permission: "product:view"] when action in [:index, :show]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "modifier:manage"]
       when action in [:create, :update, :delete, :create_modifier, :attach, :detach]

  def index(conn, _params) do
    render(conn, :index, modifier_groups: Catalog.list_modifier_groups(conn.assigns.scope))
  end

  def show(conn, %{"id" => id}) do
    with {:ok, group} <- Catalog.fetch_modifier_group(conn.assigns.scope, id) do
      render(conn, :show, modifier_group: group)
    end
  end

  @doc "Creates a group, optionally with its options in the same call."
  def create(conn, params) do
    scope = conn.assigns.scope

    with {:ok, group} <- Catalog.create_modifier_group(scope, params) do
      Audit.log(scope, "modifier_group.created", group)

      conn
      |> put_status(:created)
      |> render(:show, modifier_group: group)
    end
  end

  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, group} <- Catalog.fetch_modifier_group(scope, id),
         {:ok, updated} <- Catalog.update_modifier_group(scope, group, params) do
      Audit.log(scope, "modifier_group.updated", updated)
      render(conn, :show, modifier_group: updated)
    end
  end

  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, group} <- Catalog.fetch_modifier_group(scope, id),
         {:ok, archived} <- Catalog.archive_modifier_group(scope, group) do
      Audit.log(scope, "modifier_group.archived", archived)
      send_resp(conn, :no_content, "")
    end
  end

  @doc "Adds an option to a group."
  def create_modifier(conn, %{"modifier_group_id" => group_id} = params) do
    scope = conn.assigns.scope

    with {:ok, group} <- Catalog.fetch_modifier_group(scope, group_id),
         {:ok, _modifier} <- Catalog.create_modifier(scope, group, params),
         {:ok, reloaded} <- Catalog.fetch_modifier_group(scope, group_id) do
      conn
      |> put_status(:created)
      |> render(:show, modifier_group: reloaded)
    end
  end

  @doc "Attaches a group to a product."
  def attach(conn, %{"product_id" => product_id, "modifier_group_id" => group_id} = params) do
    scope = conn.assigns.scope

    with {:ok, product} <- Catalog.fetch_product(scope, product_id),
         {:ok, group} <- Catalog.fetch_modifier_group(scope, group_id),
         {:ok, _attachment} <- Catalog.attach_modifier_group(scope, product, group, params) do
      send_resp(conn, :no_content, "")
    end
  end

  @doc "Detaches a group from a product."
  def detach(conn, %{"product_id" => product_id, "modifier_group_id" => group_id}) do
    scope = conn.assigns.scope

    with {:ok, product} <- Catalog.fetch_product(scope, product_id) do
      :ok = Catalog.detach_modifier_group(scope, product, group_id)
      send_resp(conn, :no_content, "")
    end
  end
end
