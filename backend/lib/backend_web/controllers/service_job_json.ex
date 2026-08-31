defmodule KaarobarWeb.ServiceJobJSON do
  @moduledoc false

  alias KaarobarWeb.VerticalSerializers, as: S

  def jobs(%{jobs: jobs}), do: %{data: Enum.map(jobs, &S.job/1)}
  def job(%{job: job}), do: %{data: S.job(job)}
  def item(%{item: item}), do: %{data: S.job_item(item)}
  def event(%{event: event}), do: %{data: S.job_event(event)}
  def history(%{events: events}), do: %{data: Enum.map(events, &S.job_event/1)}
end
