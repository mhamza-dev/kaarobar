defmodule KaarobarWeb.Plugs.RequireAuth do
  @moduledoc """
  Resolves the `Authorization: Bearer <token>` header to a user.

  Halts with `401 unauthorized` when the header is missing, malformed, or names
  a token that is revoked, expired, or belongs to an account that is no longer
  active. All of those produce the same response: distinguishing "no such
  token" from "expired token" tells an attacker which of their guesses was
  close.

  Assigns `:current_user` and `:current_token`. `KaarobarWeb.Plugs.LoadScope`
  turns those into a `%Kaarobar.Scope{}`.
  """

  @behaviour Plug

  import Plug.Conn

  alias Kaarobar.Accounts
  alias KaarobarWeb.ErrorEnvelope

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    with {:ok, presented} <- bearer_token(conn),
         {:ok, user, token} <- Accounts.fetch_user_by_bearer_token(presented) do
      conn
      |> assign(:current_user, user)
      |> assign(:current_token, token)
    else
      _other -> reject(conn)
    end
  end

  defp bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token | _rest] -> non_empty(token)
      ["bearer " <> token | _rest] -> non_empty(token)
      _other -> :error
    end
  end

  defp non_empty(token) do
    case String.trim(token) do
      "" -> :error
      trimmed -> {:ok, trimmed}
    end
  end

  defp reject(conn) do
    {status, body} = ErrorEnvelope.for_reason(:unauthorized)

    conn
    # Tells a well-behaved client this is an auth problem it can fix by
    # re-authenticating, rather than a permanent failure.
    |> put_resp_header("www-authenticate", ~s(Bearer realm="kaarobar"))
    |> put_resp_content_type("application/json")
    |> send_resp(Plug.Conn.Status.code(status), Jason.encode_to_iodata!(body))
    |> halt()
  end
end
