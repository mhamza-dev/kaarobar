defmodule KaarobarWeb.RegisterController do
  @moduledoc """
  Tills, shifts and the cash in the drawer.

  The X report reads the shift's running totals and costs one row. The
  reconciliation endpoint recomputes the same figures from the sales
  themselves, because the only honest answer to "are you sure?" is a number
  derived a second way.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Registers

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "register:view"] when action in [:index, :show, :current_shift]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "register:manage"] when action in [:create, :update, :delete]

  plug KaarobarWeb.Plugs.Authorize, [permission: "shift:open"] when action in [:open_shift]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "shift:close"] when action in [:close_shift, :reconcile]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "shift:view"] when action in [:index_shifts, :show_shift, :x_report]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "cash:movement"] when action in [:cash_movement, :cash_movements]

  # --- Registers --------------------------------------------------------------

  def index(conn, params) do
    registers = Registers.list_registers(conn.assigns.scope, Map.take(params, ~w(branch_id)))

    render(conn, :registers, registers: registers)
  end

  def show(conn, %{"id" => id}) do
    with {:ok, register} <- Registers.fetch_register(conn.assigns.scope, id) do
      render(conn, :register, register: register)
    end
  end

  def create(conn, params) do
    with {:ok, register} <- Registers.create_register(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:register, register: register)
    end
  end

  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, register} <- Registers.fetch_register(scope, id),
         {:ok, updated} <- Registers.update_register(scope, register, params) do
      render(conn, :register, register: updated)
    end
  end

  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, register} <- Registers.fetch_register(scope, id),
         {:ok, deleted} <- Registers.delete_register(scope, register) do
      render(conn, :register, register: deleted)
    end
  end

  # --- Shifts -----------------------------------------------------------------

  @doc "The shift currently running on a till, if any."
  def current_shift(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, register} <- Registers.fetch_register(scope, id) do
      case Registers.current_shift(scope, register.id) do
        nil -> {:error, :not_found}
        shift -> render(conn, :shift, shift: shift)
      end
    end
  end

  def open_shift(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, register} <- Registers.fetch_register(scope, id),
         {:ok, shift} <- Registers.open_shift(scope, register, params) do
      conn |> put_status(:created) |> render(:shift, shift: shift)
    end
  end

  def index_shifts(conn, params) do
    filters = Map.take(params, ~w(branch_id register_id status))
    shifts = Registers.list_shifts(conn.assigns.scope, filters)

    render(conn, :shifts, shifts: shifts)
  end

  def show_shift(conn, %{"id" => id}) do
    with {:ok, shift} <- Registers.fetch_shift(conn.assigns.scope, id) do
      render(conn, :shift, shift: shift)
    end
  end

  def close_shift(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, shift} <- Registers.fetch_shift(scope, id),
         {:ok, closed} <- Registers.close_shift(scope, shift, params) do
      render(conn, :shift, shift: closed)
    end
  end

  @doc "Where the shift stands right now, without closing it."
  def x_report(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, shift} <- Registers.fetch_shift(scope, id) do
      render(conn, :x_report, report: Registers.x_report(scope, shift))
    end
  end

  @doc "The same figures, recomputed from the sales rather than the totals."
  def reconcile(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, shift} <- Registers.fetch_shift(scope, id) do
      render(conn, :reconciliation, report: Registers.reconcile_shift(scope, shift))
    end
  end

  # --- Cash -------------------------------------------------------------------

  def cash_movement(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, shift} <- Registers.fetch_shift(scope, id),
         {:ok, movement} <- Registers.record_cash_movement(scope, shift, params) do
      conn |> put_status(:created) |> render(:cash_movement, cash_movement: movement)
    end
  end

  def cash_movements(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, shift} <- Registers.fetch_shift(scope, id) do
      movements = Registers.list_cash_movements(scope, shift)

      render(conn, :cash_movements, cash_movements: movements)
    end
  end
end
