defmodule KaarobarWeb.AuthControllerTest do
  use KaarobarWeb.ConnCase, async: true

  alias Kaarobar.Accounts

  describe "POST /api/v1/auth/register" do
    @valid_registration %{
      "user" => %{
        "email" => "owner@shop.pk",
        "password" => "a-good-long-password",
        "name" => "Ali"
      },
      "organization" => %{"name" => "Ali Traders", "country_code" => "PK"},
      "business" => %{"name" => "Ali Kiryana", "business_type" => "grocery"}
    }

    test "creates the account and returns a working token", %{conn: conn} do
      conn = post(conn, ~p"/api/v1/auth/register", @valid_registration)

      assert %{
               "token" => token,
               "token_type" => "Bearer",
               "user" => %{"email" => "owner@shop.pk"},
               "organization" => %{"name" => "Ali Traders"},
               "business" => %{"business_type" => "grocery"},
               "branch" => %{"is_main" => true}
             } = json_data(conn, 201)

      # The token works immediately — signing up lands on a working till.
      me =
        build_conn()
        |> put_req_header("authorization", "Bearer #{token}")
        |> get(~p"/api/v1/me")

      assert %{"user" => %{"email" => "owner@shop.pk"}, "is_owner" => true} = json_data(me, 200)
    end

    test "never returns the password hash", %{conn: conn} do
      conn = post(conn, ~p"/api/v1/auth/register", @valid_registration)

      body = json_response(conn, 201)
      refute body |> inspect() |> String.contains?("hashed_password")
      refute get_in(body, ["data", "user", "hashed_password"])
    end

    test "reports validation errors per field", %{conn: conn} do
      conn =
        post(conn, ~p"/api/v1/auth/register", %{
          "user" => %{"email" => "nope", "password" => "x", "name" => ""},
          "organization" => %{"name" => "Ali Traders"}
        })

      assert %{"code" => "validation_failed", "details" => details} = json_error(conn, 422)
      assert details["email"]
      assert details["password"]
    end

    test "refuses a duplicate address", %{conn: conn} do
      insert(:user, email: "owner@shop.pk")

      conn = post(conn, ~p"/api/v1/auth/register", @valid_registration)

      assert %{"details" => %{"email" => ["has already been taken"]}} = json_error(conn, 422)
    end
  end

  describe "POST /api/v1/auth/login" do
    setup do
      %{user: insert(:user, email: "cashier@shop.pk")}
    end

    test "returns a token for the right password", %{conn: conn, user: user} do
      conn =
        post(conn, ~p"/api/v1/auth/login", %{
          "email" => user.email,
          "password" => valid_password()
        })

      assert %{"token" => token, "user" => %{"email" => "cashier@shop.pk"}} = json_data(conn, 200)
      assert {:ok, _user, _token} = Accounts.fetch_user_by_bearer_token(token)
    end

    test "is case-insensitive about the address", %{conn: conn} do
      conn =
        post(conn, ~p"/api/v1/auth/login", %{
          "email" => "CASHIER@SHOP.PK",
          "password" => valid_password()
        })

      assert %{"token" => _token} = json_data(conn, 200)
    end

    test "gives the same answer for a wrong password and a missing account", %{
      conn: conn,
      user: user
    } do
      wrong =
        post(conn, ~p"/api/v1/auth/login", %{"email" => user.email, "password" => "wrong"})

      missing =
        build_conn()
        |> post(~p"/api/v1/auth/login", %{
          "email" => "nobody@shop.pk",
          "password" => valid_password()
        })

      assert json_error(wrong, 401) == json_error(missing, 401)
      assert json_error(wrong, 401)["code"] == "invalid_credentials"
    end

    test "refuses a suspended account", %{conn: conn} do
      user = insert(:user, status: "suspended")

      conn =
        post(conn, ~p"/api/v1/auth/login", %{
          "email" => user.email,
          "password" => valid_password()
        })

      assert %{"code" => "account_suspended"} = json_error(conn, 403)
    end

    test "reports a lockout after repeated failures", %{conn: conn, user: user} do
      for _attempt <- 1..5 do
        build_conn()
        |> post(~p"/api/v1/auth/login", %{"email" => user.email, "password" => "wrong"})
      end

      conn =
        post(conn, ~p"/api/v1/auth/login", %{
          "email" => user.email,
          "password" => valid_password()
        })

      assert %{"code" => "account_locked"} = json_error(conn, 423)
    end

    test "requires both fields", %{conn: conn} do
      conn = post(conn, ~p"/api/v1/auth/login", %{"email" => "cashier@shop.pk"})

      assert json_error(conn, 401)["code"] == "invalid_credentials"
    end
  end

  describe "authentication on protected routes" do
    test "no header is rejected", %{conn: conn} do
      conn = get(conn, ~p"/api/v1/me")

      assert %{"code" => "unauthorized"} = json_error(conn, 401)
      assert ["Bearer realm=\"kaarobar\""] = get_resp_header(conn, "www-authenticate")
    end

    test "a malformed header is rejected", %{conn: conn} do
      conn =
        conn
        |> put_req_header("authorization", "Basic abc123")
        |> get(~p"/api/v1/me")

      assert json_error(conn, 401)
    end

    test "a made-up token is rejected", %{conn: conn} do
      conn =
        conn
        |> put_req_header("authorization", "Bearer not-a-real-token")
        |> get(~p"/api/v1/me")

      assert json_error(conn, 401)
    end

    test "a revoked token is rejected on the very next request", %{conn: conn} do
      user = insert(:user)
      {token, record} = Accounts.create_bearer_token(user)

      authed = put_req_header(conn, "authorization", "Bearer #{token}")
      assert json_data(get(authed, ~p"/api/v1/me"), 200)

      :ok = Accounts.revoke_bearer_token(user, record.id)

      retried =
        build_conn()
        |> put_req_header("authorization", "Bearer #{token}")
        |> get(~p"/api/v1/me")

      assert json_error(retried, 401)
    end
  end

  describe "POST /api/v1/auth/logout" do
    test "revokes only the calling device", %{conn: conn} do
      user = insert(:user)
      {keep, _record} = Accounts.create_bearer_token(user)
      {lose, _record} = Accounts.create_bearer_token(user)

      conn
      |> put_req_header("authorization", "Bearer #{lose}")
      |> post(~p"/api/v1/auth/logout")
      |> response(204)

      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token(lose)
      assert {:ok, _user, _token} = Accounts.fetch_user_by_bearer_token(keep)
    end
  end

  describe "POST /api/v1/auth/logout-all" do
    test "revokes every device", %{conn: conn} do
      user = insert(:user)
      {first, _record} = Accounts.create_bearer_token(user)
      {second, _record} = Accounts.create_bearer_token(user)

      conn
      |> put_req_header("authorization", "Bearer #{first}")
      |> post(~p"/api/v1/auth/logout-all")
      |> response(204)

      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token(first)
      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token(second)
    end
  end

  describe "password reset" do
    test "accepts any address without revealing whether it exists", %{conn: conn} do
      registered = insert(:user)

      known = post(conn, ~p"/api/v1/auth/forgot-password", %{"email" => registered.email})

      unknown =
        build_conn()
        |> post(~p"/api/v1/auth/forgot-password", %{"email" => "nobody@shop.pk"})

      assert json_response(known, 202) == json_response(unknown, 202)
    end

    test "completes with a valid token", %{conn: conn} do
      user = insert(:user)

      post(conn, ~p"/api/v1/auth/forgot-password", %{"email" => user.email})

      assert_receive {:email, %Swoosh.Email{text_body: body}}
      [_whole, token] = Regex.run(~r{/reset-password/([\w\-]+)}, body)

      reset =
        build_conn()
        |> post(~p"/api/v1/auth/reset-password", %{
          "token" => token,
          "password" => "brand-new-password"
        })

      assert json_response(reset, 200)
      assert {:ok, _user} = Accounts.authenticate(user.email, "brand-new-password")
    end

    test "refuses an unknown token", %{conn: conn} do
      conn =
        post(conn, ~p"/api/v1/auth/reset-password", %{
          "token" => "nonsense",
          "password" => "brand-new-password"
        })

      assert %{"code" => "invalid_token"} = json_error(conn, 401)
    end
  end
end
