defmodule KaarobarWeb.Plugs.RequestContext do
  @moduledoc """
  Establishes the per-request diagnostic context.

  Captures the caller's address and the request id, assigns both, and puts them
  into `Logger` metadata so every line emitted while handling the request — and
  every `audit_logs` row written by it — can be traced back to one HTTP call.

  The client address is taken from `X-Forwarded-For` when the request arrives
  through a trusted proxy. Because a client can forge that header, it is only
  honoured when `:trust_proxy_headers` is enabled, which production sets and
  development does not.
  """

  @behaviour Plug

  import Plug.Conn

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    request_id = request_id(conn)
    remote_ip = remote_ip(conn)

    Logger.metadata(request_id: request_id)

    conn
    |> assign(:request_id, request_id)
    |> assign(:remote_ip, remote_ip)
  end

  defp request_id(conn) do
    case get_resp_header(conn, "x-request-id") do
      [request_id | _rest] -> request_id
      [] -> Logger.metadata()[:request_id]
    end
  end

  defp remote_ip(conn) do
    if trust_proxy_headers?() do
      forwarded_for(conn) || format_ip(conn.remote_ip)
    else
      format_ip(conn.remote_ip)
    end
  end

  defp forwarded_for(conn) do
    with [value | _rest] <- get_req_header(conn, "x-forwarded-for"),
         [client | _rest] <- String.split(value, ",", trim: true) do
      String.trim(client)
    else
      _other -> nil
    end
  end

  defp format_ip(nil), do: nil
  defp format_ip(ip) when is_tuple(ip), do: ip |> :inet.ntoa() |> to_string()
  defp format_ip(ip) when is_binary(ip), do: ip

  defp trust_proxy_headers? do
    Application.get_env(:backend, :trust_proxy_headers, Application.get_env(:backend, :env) == :prod)
  end
end
