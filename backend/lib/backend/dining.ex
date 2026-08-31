defmodule Kaarobar.Dining do
  @moduledoc """
  The floor: tables, who is sitting at them, and what they are running up.

  ## The bill is an ordinary order

  Seating a party opens a `Kaarobar.Sales.Order` and points the session at it.
  Everything a ticket can already do — hold, add items, split, bill — works
  here with no new machinery, and a table's bill goes through the same checkout
  as every other sale. A second, parallel notion of an unpaid restaurant bill
  would have to reimplement all of it and would drift.

  ## Merging and transferring move sessions, not orders

  Pushing two tables together is one bill covering two sittings; moving a party
  is one sitting changing table. Neither rewrites the order, so nothing that
  has already been sent to the kitchen is disturbed.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Dining.DiningTable
  alias Kaarobar.Dining.Floor
  alias Kaarobar.Dining.TableSession
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Sales
  alias Kaarobar.Scope

  # ===========================================================================
  # Floors and tables
  # ===========================================================================

  @doc "The branch's floors, in display order."
  @spec list_floors(Scope.t()) :: [Floor.t()]
  def list_floors(%Scope{} = scope) do
    Floor
    |> Scoped.for_branch(scope)
    |> Scoped.active()
    |> order_by([floor], asc: floor.position, asc: floor.name)
    |> Repo.all()
  end

  @doc "Creates a floor."
  @spec create_floor(Scope.t(), map()) :: {:ok, Floor.t()} | {:error, Ecto.Changeset.t()}
  def create_floor(%Scope{} = scope, attrs) do
    %Floor{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> Floor.changeset(put_branch(scope, attrs))
    |> Repo.insert()
  end

  @doc "Updates a floor."
  @spec update_floor(Scope.t(), Floor.t(), map()) ::
          {:ok, Floor.t()} | {:error, Ecto.Changeset.t()}
  def update_floor(%Scope{}, %Floor{} = floor, attrs),
    do: floor |> Floor.changeset(attrs) |> Repo.update()

  @doc "Soft-deletes a floor. Its tables stay, unfloored."
  @spec delete_floor(Scope.t(), Floor.t()) :: {:ok, Floor.t()} | {:error, Ecto.Changeset.t()}
  def delete_floor(%Scope{}, %Floor{} = floor),
    do: floor |> Floor.soft_delete_changeset() |> Repo.update()

  @doc "Fetches a floor."
  @spec fetch_floor(Scope.t(), Ecto.UUID.t()) :: {:ok, Floor.t()} | {:error, :not_found}
  def fetch_floor(%Scope{} = scope, id), do: fetch_scoped(scope, Floor, id)

  @doc "The branch's tables."
  @spec list_tables(Scope.t()) :: [DiningTable.t()]
  def list_tables(%Scope{} = scope) do
    DiningTable
    |> Scoped.for_branch(scope)
    |> Scoped.active()
    |> order_by([table], asc: table.name)
    |> preload(:floor)
    |> Repo.all()
  end

  @doc "Fetches a table."
  @spec fetch_table(Scope.t(), Ecto.UUID.t()) ::
          {:ok, DiningTable.t()} | {:error, :not_found}
  def fetch_table(%Scope{} = scope, id), do: fetch_scoped(scope, DiningTable, id)

  @doc "Creates a table."
  @spec create_table(Scope.t(), map()) ::
          {:ok, DiningTable.t()} | {:error, Ecto.Changeset.t()}
  def create_table(%Scope{} = scope, attrs) do
    %DiningTable{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> DiningTable.changeset(put_branch(scope, attrs))
    |> Repo.insert()
  end

  @doc "Updates a table — its name, seats, or where it sits on the plan."
  @spec update_table(Scope.t(), DiningTable.t(), map()) ::
          {:ok, DiningTable.t()} | {:error, Ecto.Changeset.t()}
  def update_table(%Scope{}, %DiningTable{} = table, attrs),
    do: table |> DiningTable.changeset(attrs) |> Repo.update()

  @doc """
  Soft-deletes a table.

  Refused while someone is sitting at it: a table that vanishes mid-service
  takes an open bill with it.
  """
  @spec delete_table(Scope.t(), DiningTable.t()) ::
          {:ok, DiningTable.t()} | {:error, :occupied | Ecto.Changeset.t()}
  def delete_table(%Scope{} = scope, %DiningTable{} = table) do
    if open_session_for(scope, table.id) do
      {:error, :occupied}
    else
      table |> DiningTable.soft_delete_changeset() |> Repo.update()
    end
  end

  @doc """
  The floor plan: every table with whatever is happening on it.

  One query for the tables and one for the live sittings, joined in memory.
  A left join would repeat every table row per session and still need the same
  work to shape, and this is the screen a restaurant leaves open all service.
  """
  @spec floor_plan(Scope.t()) :: [map()]
  def floor_plan(%Scope{} = scope) do
    now = DateTime.utc_now()
    tables = list_tables(scope)

    sessions =
      scope
      |> live_sessions()
      |> Map.new(&{&1.dining_table_id, &1})

    Enum.map(tables, fn table ->
      session = Map.get(sessions, table.id)

      %{
        table: table,
        session: session,
        occupied: not is_nil(session),
        minutes_seated: session && TableSession.minutes_seated(session, now)
      }
    end)
  end

  # ===========================================================================
  # Sittings
  # ===========================================================================

  @doc "Every party currently seated at this branch."
  @spec live_sessions(Scope.t()) :: [TableSession.t()]
  def live_sessions(%Scope{} = scope) do
    TableSession
    |> Scoped.for_branch(scope)
    |> where([session], session.status in ["open", "billed"])
    |> order_by([session], asc: session.opened_at)
    |> preload([:dining_table, :order])
    |> Repo.all()
  end

  @doc "Fetches a sitting, with its table and bill."
  @spec fetch_session(Scope.t(), Ecto.UUID.t()) ::
          {:ok, TableSession.t()} | {:error, :not_found}
  def fetch_session(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      TableSession
      |> Scoped.for_business(scope)
      |> where([session], session.id == ^id)
      |> preload([:dining_table, order: :items])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        session -> {:ok, session}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Seats a party, opening the bill with them.

  The order and the sitting are created together: a table showing as occupied
  with no bill behind it is a table nobody can ring up.
  """
  @spec seat(Scope.t(), DiningTable.t(), map()) :: {:ok, TableSession.t()} | {:error, term()}
  def seat(%Scope{} = scope, %DiningTable{} = table, attrs \\ %{}) do
    if DiningTable.seatable?(table) do
      Repo.transaction(fn ->
        with {:ok, order} <- open_order_for(scope, table, attrs),
             {:ok, session} <- insert_session(scope, table, order, attrs),
             {:ok, _order} <- Sales.attach_order_to_session(scope, order, session) do
          Audit.log(scope, "table_session.opened", session,
            entity_type: "table_session",
            label: table.name,
            summary: "#{Map.get(attrs, "covers", 1)} cover(s) seated at #{table.name}"
          )

          Repo.preload(session, [:dining_table, :order])
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, :table_unavailable}
    end
  end

  @doc "Edits a live sitting — covers, server, notes."
  @spec update_session(Scope.t(), TableSession.t(), map()) ::
          {:ok, TableSession.t()} | {:error, term()}
  def update_session(%Scope{}, %TableSession{} = session, attrs) do
    if TableSession.live?(session) do
      session |> TableSession.changeset(attrs) |> Repo.update()
    else
      {:error, :session_closed}
    end
  end

  @doc """
  Moves a party to another table, keeping the same bill.

  The order is untouched, so anything already with the kitchen is undisturbed.
  """
  @spec transfer(Scope.t(), TableSession.t(), DiningTable.t()) ::
          {:ok, TableSession.t()} | {:error, term()}
  def transfer(%Scope{} = scope, %TableSession{} = session, %DiningTable{} = target) do
    cond do
      not TableSession.live?(session) ->
        {:error, :session_closed}

      not DiningTable.seatable?(target) ->
        {:error, :table_unavailable}

      open_session_for(scope, target.id) ->
        {:error, :table_occupied}

      true ->
        with {:ok, moved} <- session |> TableSession.transfer_changeset(target) |> Repo.update() do
          Audit.log(scope, "table_session.transferred", moved,
            entity_type: "table_session",
            label: target.name,
            summary: "Party moved to #{target.name}"
          )

          {:ok, Repo.preload(moved, [:dining_table, :order], force: true)}
        end
    end
  end

  @doc """
  Folds one sitting into another: two tables pushed together.

  The absorbed session's lines move to the surviving bill and its row stays,
  marked merged, so the covers are still counted at the table they sat at.
  """
  @spec merge(Scope.t(), TableSession.t(), TableSession.t()) ::
          {:ok, TableSession.t()} | {:error, term()}
  def merge(%Scope{} = scope, %TableSession{} = source, %TableSession{} = target) do
    cond do
      source.id == target.id -> {:error, :cannot_merge_into_itself}
      not TableSession.live?(source) -> {:error, :session_closed}
      not TableSession.live?(target) -> {:error, :session_closed}
      true -> do_merge(scope, source, target)
    end
  end

  @doc "Marks the bill as printed. The party is still sitting there."
  @spec mark_billed(Scope.t(), TableSession.t()) ::
          {:ok, TableSession.t()} | {:error, Ecto.Changeset.t()}
  def mark_billed(%Scope{}, %TableSession{} = session),
    do: session |> TableSession.bill_changeset() |> Repo.update()

  @doc """
  Clears the table.

  Refused while the bill still has unpaid lines — a table cleared with food on
  it that nobody paid for is how a night's takings go missing.
  """
  @spec close_session(Scope.t(), TableSession.t()) ::
          {:ok, TableSession.t()} | {:error, term()}
  def close_session(%Scope{} = scope, %TableSession{} = session) do
    if unbilled?(scope, session) do
      {:error, :bill_outstanding}
    else
      with {:ok, closed} <- session |> TableSession.close_changeset() |> Repo.update() do
        Audit.log(scope, "table_session.closed", closed,
          entity_type: "table_session",
          summary: "Table cleared after #{TableSession.minutes_seated(closed, DateTime.utc_now())} min"
        )

        {:ok, closed}
      end
    end
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp do_merge(%Scope{} = scope, source, target) do
    Repo.transaction(fn ->
      with :ok <- Sales.move_order_items(scope, source.order_id, target.order_id),
           {:ok, merged} <- source |> TableSession.merge_changeset(target) |> Repo.update() do
        Audit.log(scope, "table_session.merged", merged,
          entity_type: "table_session",
          summary: "Merged into another table"
        )

        Repo.preload(target, [:dining_table, :order], force: true)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp open_order_for(%Scope{} = scope, %DiningTable{} = table, attrs) do
    Sales.create_order(scope, %{
      "branch_id" => Scope.branch_id(scope),
      "label" => Map.get(attrs, "label") || table.name,
      "service_mode" => "dine_in",
      "served_by_user_id" => Map.get(attrs, "server_id"),
      "customer_id" => Map.get(attrs, "customer_id")
    })
  end

  defp insert_session(%Scope{} = scope, table, order, attrs) do
    %TableSession{}
    |> TableSession.open_changeset(%{
      "organization_id" => Scope.organization_id(scope),
      "business_id" => Scope.business_id(scope),
      "branch_id" => Scope.branch_id(scope),
      "dining_table_id" => table.id,
      "order_id" => order.id,
      "covers" => Map.get(attrs, "covers", 1),
      "label" => Map.get(attrs, "label"),
      "server_id" => Map.get(attrs, "server_id") || Scope.user_id(scope),
      "opened_by_id" => Scope.user_id(scope),
      "notes" => Map.get(attrs, "notes")
    })
    |> Repo.insert()
  end

  defp open_session_for(%Scope{} = scope, table_id) do
    TableSession
    |> Scoped.for_business(scope)
    |> where([session], session.dining_table_id == ^table_id and session.status == "open")
    |> Repo.one()
  end

  # A sitting with no bill attached has nothing outstanding on it.
  defp unbilled?(_scope, %TableSession{order_id: nil}), do: false

  defp unbilled?(%Scope{} = scope, %TableSession{} = session) do
    case Sales.fetch_order(scope, session.order_id) do
      {:ok, order} -> Enum.any?(order.items, &(not Kaarobar.Sales.OrderItem.fully_billed?(&1)))
      {:error, :not_found} -> false
    end
  end

  defp put_branch(%Scope{} = scope, attrs) do
    Map.put_new(stringify(attrs), "branch_id", Scope.branch_id(scope))
  end

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} ->
      {if(is_atom(key), do: Atom.to_string(key), else: key), value}
    end)
  end

  defp fetch_scoped(%Scope{} = scope, schema, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      schema
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([record], record.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        record -> {:ok, record}
      end
    else
      {:error, :not_found}
    end
  end
end
