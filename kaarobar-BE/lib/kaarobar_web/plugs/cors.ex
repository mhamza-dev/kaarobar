defmodule KaarobarWeb.CORS do
  @moduledoc false
  @behaviour Plug

  def init(opts), do: opts

  def call(conn, _opts) do
    conn
    |> Plug.Conn.put_resp_header("access-control-allow-origin", "*")
    |> Plug.Conn.put_resp_header(
      "access-control-allow-methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    )
    |> Plug.Conn.put_resp_header(
      "access-control-allow-headers",
      "authorization, content-type, x-business-id, x-branch-id"
    )
    |> maybe_halt_options()
  end

  defp maybe_halt_options(%{method: "OPTIONS"} = conn) do
    conn
    |> Plug.Conn.send_resp(204, "")
    |> Plug.Conn.halt()
  end

  defp maybe_halt_options(conn), do: conn
end
