defmodule KaarobarWeb.ConnCase do
  @moduledoc """
  Setup for tests that exercise the HTTP layer.

  `sign_in/2` and `sign_in/3` build a request the way a real client does —
  a bearer token in the `Authorization` header and the tenant in
  `X-Business-Id` — rather than reaching past the plugs to assign a scope
  directly. Tests that skip the plugs cannot catch a route left off the
  authenticated pipeline, which is the mistake worth catching.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      # The default endpoint for testing
      @endpoint KaarobarWeb.Endpoint

      use KaarobarWeb, :verified_routes

      alias Kaarobar.Repo

      # Import conveniences for testing with connections
      import Plug.Conn
      import Phoenix.ConnTest
      import KaarobarWeb.ConnCase
      import Kaarobar.Factory
    end
  end

  setup tags do
    Kaarobar.DataCase.setup_sandbox(tags)
    {:ok, conn: Phoenix.ConnTest.build_conn() |> Plug.Conn.put_req_header("accept", "application/json")}
  end

  @doc """
  Signs a connection in as `user`, exactly as a client would.
  """
  def sign_in(conn, user) do
    Plug.Conn.put_req_header(conn, "authorization", "Bearer " <> Kaarobar.Factory.bearer_token(user))
  end

  @doc """
  Signs in and selects a business, the normal state of a POS client.
  """
  def sign_in(conn, user, business) do
    conn
    |> sign_in(user)
    |> Plug.Conn.put_req_header("x-business-id", business.id)
  end

  @doc "Selects a branch on an already signed-in connection."
  def with_branch(conn, branch) do
    Plug.Conn.put_req_header(conn, "x-branch-id", branch.id)
  end

  @doc "Sets an idempotency key on the request."
  def with_idempotency_key(conn, key) do
    Plug.Conn.put_req_header(conn, "idempotency-key", key)
  end

  @doc """
  The `data` member of a successful JSON response.

      assert %{"name" => "Shop"} = json_data(conn, 200)
  """
  def json_data(conn, status) do
    conn |> Phoenix.ConnTest.json_response(status) |> Map.fetch!("data")
  end

  @doc """
  The `error` member of a failed JSON response.

      assert %{"code" => "forbidden"} = json_error(conn, 403)
  """
  def json_error(conn, status) do
    conn |> Phoenix.ConnTest.json_response(status) |> Map.fetch!("error")
  end
end
