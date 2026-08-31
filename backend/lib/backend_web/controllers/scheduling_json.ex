defmodule KaarobarWeb.SchedulingJSON do
  @moduledoc false

  alias KaarobarWeb.VerticalSerializers, as: S

  def resources(%{resources: resources}), do: %{data: Enum.map(resources, &S.resource/1)}
  def resource(%{resource: resource}), do: %{data: S.resource(resource)}

  def availability(%{slots: slots}), do: %{data: Enum.map(slots, &S.slot/1)}

  def diary(%{columns: columns}), do: %{data: Enum.map(columns, &S.diary_column/1)}

  def appointments(%{appointments: appointments}),
    do: %{data: Enum.map(appointments, &S.appointment/1)}

  def appointment(%{appointment: appointment}), do: %{data: S.appointment(appointment)}

  def queue(%{entries: entries}), do: %{data: Enum.map(entries, &S.queue_entry/1)}
  def queue_entry(%{entry: entry}), do: %{data: S.queue_entry(entry)}
end
