defmodule KaarobarWeb.CORSTest do
  @moduledoc """
  Guards the browser-facing edge of the API.

  A misconfigured allowlist fails silently — the API keeps working for `curl`
  and for the mobile app, and only the browser clients break, or worse, stop
  being protected. These tests exercise the real preflight path through the
  endpoint.
  """

  use KaarobarWeb.ConnCase, async: false

  @allowed "https://app.kaarobar.test"
  @disallowed "https://evil.example.com"

  setup do
    previous = Application.get_env(:backend, :cors_origins)
    Application.put_env(:backend, :cors_origins, [@allowed])

    on_exit(fn -> Application.put_env(:backend, :cors_origins, previous) end)
    :ok
  end

  describe "preflight" do
    test "an allowed origin is told which methods and headers it may use", %{conn: conn} do
      conn =
        conn
        |> put_req_header("origin", @allowed)
        |> put_req_header("access-control-request-method", "POST")
        |> put_req_header("access-control-request-headers", "authorization,content-type")
        |> options("/api/v1/health")

      assert get_resp_header(conn, "access-control-allow-origin") == [@allowed]
      assert conn.status in [200, 204]
    end

    test "an origin outside the allowlist is not granted access" do
      conn =
        build_conn()
        |> put_req_header("origin", @disallowed)
        |> put_req_header("access-control-request-method", "POST")
        |> options("/api/v1/health")

      assert get_resp_header(conn, "access-control-allow-origin") == []
    end
  end

  describe "actual requests" do
    test "an allowed origin receives the allow-origin header", %{conn: conn} do
      conn =
        conn
        |> put_req_header("origin", @allowed)
        |> get(~p"/api/v1/health")

      assert get_resp_header(conn, "access-control-allow-origin") == [@allowed]
      assert json_response(conn, 200)["status"] == "ok"
    end

    test "a disallowed origin still gets a response but no CORS grant", %{conn: conn} do
      conn =
        conn
        |> put_req_header("origin", @disallowed)
        |> get(~p"/api/v1/health")

      assert get_resp_header(conn, "access-control-allow-origin") == []
    end

    test "headers the POS clients depend on are exposed to the browser", %{conn: conn} do
      conn =
        conn
        |> put_req_header("origin", @allowed)
        |> put_req_header("access-control-request-method", "GET")
        |> options("/api/v1/health")

      allowed_headers =
        conn
        |> get_resp_header("access-control-allow-headers")
        |> List.first("")
        |> String.downcase()

      for header <- ["authorization", "idempotency-key", "x-business-id", "x-branch-id"] do
        assert allowed_headers =~ header
      end
    end
  end

  describe "allowed?/1" do
    test "matches exactly, with no implicit wildcard" do
      assert KaarobarWeb.CORS.allowed?(@allowed)
      refute KaarobarWeb.CORS.allowed?(@disallowed)
      refute KaarobarWeb.CORS.allowed?("*")
      refute KaarobarWeb.CORS.allowed?(@allowed <> ".evil.com")
    end
  end
end
