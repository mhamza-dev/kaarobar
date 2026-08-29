defmodule KaarobarWeb.HealthControllerTest do
  use KaarobarWeb.ConnCase, async: true

  describe "GET /api/v1/health" do
    test "reports liveness without touching the database", %{conn: conn} do
      conn = get(conn, ~p"/api/v1/health")

      assert %{
               "status" => "ok",
               "service" => "kaarobar-backend",
               "version" => version,
               "time" => time
             } = json_response(conn, 200)

      assert is_binary(version)
      assert {:ok, %DateTime{}, _offset} = DateTime.from_iso8601(time)
    end
  end

  describe "GET /api/v1/ready" do
    test "reports readiness once the database answers", %{conn: conn} do
      conn = get(conn, ~p"/api/v1/ready")

      assert %{"status" => "ok", "checks" => %{"database" => database}} = json_response(conn, 200)
      assert database["status"] == "ok"
      assert is_number(database["latency_ms"])
    end
  end

  describe "unmatched routes" do
    test "return the standard error envelope rather than an HTML page", %{conn: conn} do
      conn = get(conn, "/api/v1/does-not-exist")

      assert %{"error" => %{"code" => "not_found", "message" => _message}} =
               json_response(conn, 404)
    end
  end
end
