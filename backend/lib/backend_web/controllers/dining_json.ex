defmodule KaarobarWeb.DiningJSON do
  @moduledoc false

  alias KaarobarWeb.DiningSerializers, as: S

  # `floor/1` here is a render target named after the resource, not
  # `Kernel.floor/1`. See the same note in `KaarobarWeb.DiningSerializers`.
  import Kernel, except: [floor: 1]

  def floor_plan(%{entries: entries}),
    do: %{data: Enum.map(entries, &S.floor_plan_entry/1)}

  def floors(%{floors: floors}), do: %{data: Enum.map(floors, &S.floor/1)}
  def floor(%{floor: floor}), do: %{data: S.floor(floor)}

  def tables(%{tables: tables}), do: %{data: Enum.map(tables, &S.dining_table/1)}
  def table(%{table: table}), do: %{data: S.dining_table(table)}

  def sessions(%{sessions: sessions}),
    do: %{data: Enum.map(sessions, &S.table_session/1)}

  def session(%{session: session}), do: %{data: S.table_session(session)}
end
