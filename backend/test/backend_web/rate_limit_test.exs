defmodule KaarobarWeb.RateLimitTest do
  @moduledoc """
  Throttling is disabled for the rest of the suite — every request comes from
  `127.0.0.1`, so one shared bucket would couple independent async tests. It is
  switched on here deliberately.

  Each test uses its own client address, so it gets its own bucket. That is
  what makes these tests independent of each other and of run order, without
  reaching into the limiter's internal state.
  """

  use KaarobarWeb.ConnCase, async: false

  setup do
    Application.put_env(:backend, :rate_limiting, true)
    on_exit(fn -> Application.put_env(:backend, :rate_limiting, false) end)
    :ok
  end

  # A distinct source address per test, so buckets never overlap.
  defp from_ip(conn, last_octet) do
    %{conn | remote_ip: {10, 0, 0, last_octet}}
  end

  defp attempt_login(last_octet, email, password) do
    build_conn()
    |> from_ip(last_octet)
    |> post(~p"/api/v1/auth/login", %{"email" => email, "password" => password})
  end

  describe "the sign-in endpoint" do
    test "answers normally under the limit", %{conn: conn} do
      user = insert(:user)

      conn =
        conn
        |> from_ip(11)
        |> post(~p"/api/v1/auth/login", %{
          "email" => user.email,
          "password" => valid_password()
        })

      assert json_data(conn, 200)
      assert ["20"] = get_resp_header(conn, "x-ratelimit-limit")
      assert [remaining] = get_resp_header(conn, "x-ratelimit-remaining")
      assert String.to_integer(remaining) == 19
    end

    test "refuses once the limit is passed, and says when to retry" do
      user = insert(:user)

      responses = for _attempt <- 1..25, do: attempt_login(12, user.email, "wrong")

      {allowed, throttled} = Enum.split_with(responses, &(&1.status != 429))

      assert length(allowed) == 20
      assert length(throttled) == 5

      last = List.last(throttled)
      assert %{"code" => "rate_limited"} = json_error(last, 429)
      assert [retry_after] = get_resp_header(last, "retry-after")
      assert String.to_integer(retry_after) > 0
      assert ["0"] = get_resp_header(last, "x-ratelimit-remaining")
    end

    test "one address being throttled does not affect another" do
      user = insert(:user)

      for _attempt <- 1..25, do: attempt_login(13, user.email, "wrong")

      # A different shop, on a different connection, is unaffected.
      assert attempt_login(14, user.email, "wrong").status == 401
    end
  end

  describe "when disabled" do
    test "requests pass through untouched" do
      Application.put_env(:backend, :rate_limiting, false)
      user = insert(:user)

      for _attempt <- 1..30 do
        assert attempt_login(15, user.email, "wrong").status == 401
      end
    end
  end
end
