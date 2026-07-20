defmodule KaarobarWeb.Plugs.EnsureAuthenticated do
  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  def init(opts), do: opts

  def call(conn, _opts) do
    case Guardian.Plug.current_resource(conn) do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Not authenticated"})
        |> halt()

      _user ->
        conn
    end
  end
end
