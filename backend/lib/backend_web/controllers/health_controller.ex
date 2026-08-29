defmodule KaarobarWeb.HealthController do
  @moduledoc """
  Liveness and readiness probes.

  The two are deliberately different. `/health` answers "is this process
  running?" and touches nothing external, so a database blip never causes an
  orchestrator to kill and restart otherwise-healthy nodes. `/ready` answers
  "should traffic be routed here?" and does check the database, so a node whose
  connection pool is exhausted is taken out of rotation instead of failing
  every request it receives.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Repo

  @doc "Liveness. Never touches the database."
  def show(conn, _params) do
    json(conn, %{
      status: "ok",
      service: "kaarobar-backend",
      version: version(),
      time: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end

  @doc "Readiness. Verifies the database is reachable."
  def ready(conn, _params) do
    checks = %{database: database_check()}
    ok? = Enum.all?(checks, fn {_name, check} -> check.status == "ok" end)

    conn
    |> put_status(if ok?, do: :ok, else: :service_unavailable)
    |> json(%{
      status: if(ok?, do: "ok", else: "degraded"),
      version: version(),
      checks: checks,
      time: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end

  defp database_check do
    started = System.monotonic_time(:microsecond)

    case Ecto.Adapters.SQL.query(Repo, "SELECT 1", [], timeout: 2_000) do
      {:ok, _result} ->
        %{status: "ok", latency_ms: elapsed_ms(started)}

      {:error, error} ->
        %{status: "error", latency_ms: elapsed_ms(started), reason: inspect(error)}
    end
  rescue
    error -> %{status: "error", reason: inspect(error)}
  end

  defp elapsed_ms(started) do
    (System.monotonic_time(:microsecond) - started) / 1000
  end

  defp version do
    case Application.spec(:backend, :vsn) do
      nil -> "unknown"
      vsn -> to_string(vsn)
    end
  end
end
