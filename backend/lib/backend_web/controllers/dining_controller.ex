defmodule KaarobarWeb.DiningController do
  @moduledoc """
  The floor: tables, and who is sitting at them.

  Viewing the plan and rearranging it are separate grants. Every server needs
  to see which tables are free; only a manager should be renaming tables or
  moving them around the room.

  Every action is gated on the `tables` module as well as the permission, so a
  salon whose staff happen to hold `table:view` still gets a 402 rather than an
  empty floor plan that implies the feature is merely unconfigured.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Dining

  # The module check comes first and applies to everything: a salon has no
  # dining tables, and that is not a permissions question.
  plug KaarobarWeb.Plugs.Authorize, module: "tables"

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "table:view"]
       when action in [:floor_plan, :tables, :floors, :sessions, :show_session]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "table:manage"]
       when action in [
              :create_floor,
              :update_floor,
              :delete_floor,
              :create_table,
              :update_table,
              :delete_table
            ]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "order:create"] when action in [:seat, :transfer, :merge]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "order:edit"] when action in [:update_session, :mark_billed, :close_session]

  # --- The plan ---------------------------------------------------------------

  @doc "Every table with whatever is happening on it. The screen left open all service."
  def floor_plan(conn, _params) do
    render(conn, :floor_plan, entries: Dining.floor_plan(conn.assigns.scope))
  end

  def floors(conn, _params) do
    render(conn, :floors, floors: Dining.list_floors(conn.assigns.scope))
  end

  def create_floor(conn, params) do
    with {:ok, floor} <- Dining.create_floor(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:floor, floor: floor)
    end
  end

  def update_floor(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, floor} <- Dining.fetch_floor(scope, id),
         {:ok, updated} <- Dining.update_floor(scope, floor, params) do
      render(conn, :floor, floor: updated)
    end
  end

  def delete_floor(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, floor} <- Dining.fetch_floor(scope, id),
         {:ok, deleted} <- Dining.delete_floor(scope, floor) do
      render(conn, :floor, floor: deleted)
    end
  end

  def tables(conn, _params) do
    render(conn, :tables, tables: Dining.list_tables(conn.assigns.scope))
  end

  def create_table(conn, params) do
    with {:ok, table} <- Dining.create_table(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:table, table: table)
    end
  end

  def update_table(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, table} <- Dining.fetch_table(scope, id),
         {:ok, updated} <- Dining.update_table(scope, table, params) do
      render(conn, :table, table: updated)
    end
  end

  def delete_table(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, table} <- Dining.fetch_table(scope, id),
         {:ok, deleted} <- Dining.delete_table(scope, table) do
      render(conn, :table, table: deleted)
    end
  end

  # --- Sittings ---------------------------------------------------------------

  def sessions(conn, _params) do
    render(conn, :sessions, sessions: Dining.live_sessions(conn.assigns.scope))
  end

  def show_session(conn, %{"id" => id}) do
    with {:ok, session} <- Dining.fetch_session(conn.assigns.scope, id) do
      render(conn, :session, session: session)
    end
  end

  @doc "Seats a party and opens their bill in the same breath."
  def seat(conn, %{"table_id" => table_id} = params) do
    scope = conn.assigns.scope

    with {:ok, table} <- Dining.fetch_table(scope, table_id),
         {:ok, session} <- Dining.seat(scope, table, params) do
      conn |> put_status(:created) |> render(:session, session: session)
    end
  end

  def update_session(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, session} <- Dining.fetch_session(scope, id),
         {:ok, updated} <- Dining.update_session(scope, session, params) do
      render(conn, :session, session: updated)
    end
  end

  @doc "Moves a party to another table, keeping the same bill."
  def transfer(conn, %{"id" => id, "table_id" => table_id}) do
    scope = conn.assigns.scope

    with {:ok, session} <- Dining.fetch_session(scope, id),
         {:ok, target} <- Dining.fetch_table(scope, table_id),
         {:ok, moved} <- Dining.transfer(scope, session, target) do
      render(conn, :session, session: moved)
    end
  end

  @doc "Pushes two tables together: one bill, two sittings."
  def merge(conn, %{"id" => id, "into_session_id" => target_id}) do
    scope = conn.assigns.scope

    with {:ok, source} <- Dining.fetch_session(scope, id),
         {:ok, target} <- Dining.fetch_session(scope, target_id),
         {:ok, merged} <- Dining.merge(scope, source, target) do
      render(conn, :session, session: merged)
    end
  end

  def mark_billed(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, session} <- Dining.fetch_session(scope, id),
         {:ok, billed} <- Dining.mark_billed(scope, session) do
      render(conn, :session, session: billed)
    end
  end

  def close_session(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, session} <- Dining.fetch_session(scope, id),
         {:ok, closed} <- Dining.close_session(scope, session) do
      render(conn, :session, session: closed)
    end
  end
end
