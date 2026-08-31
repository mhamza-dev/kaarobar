defmodule KaarobarWeb.KitchenJSON do
  @moduledoc false

  alias KaarobarWeb.DiningSerializers, as: S

  def stations(%{stations: stations}), do: %{data: Enum.map(stations, &S.station/1)}
  def station(%{station: station}), do: %{data: S.station(station)}

  @doc "The kitchen display's payload: each card with its clock already computed."
  def board(%{entries: entries}), do: %{data: Enum.map(entries, &S.board_entry/1)}

  def tickets(%{tickets: tickets}), do: %{data: Enum.map(tickets, &S.ticket/1)}
  def ticket(%{ticket: ticket}), do: %{data: S.ticket(ticket)}
end
