defmodule KaarobarWeb.V1.HealthController do
  use KaarobarWeb, :controller

  def index(conn, _params) do
    conn
    |> json(%{status: "ok", timestamp: DateTime.utc_now()})
  end
end
