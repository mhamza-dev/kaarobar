defmodule KaarobarWeb.Plugs.DashboardAuth do
  @moduledoc """
  Gates `/admin/dashboard` behind HTTP Basic Auth, or hides it entirely.

  `config :backend, :dashboard_auth` is only set (see `config/runtime.exs`)
  when `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` are both present in the
  environment. Unset, this looks like a route that does not exist rather than
  one that exists but is unreachable — a `404` gives an attacker nothing a
  `401` would not, and "not configured" and "not present" should look
  identical from outside.
  """

  @behaviour Plug

  import Plug.Conn

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    case Application.get_env(:backend, :dashboard_auth) do
      nil ->
        conn |> send_resp(:not_found, "") |> halt()

      credentials ->
        Plug.BasicAuth.basic_auth(conn, credentials)
    end
  end
end
