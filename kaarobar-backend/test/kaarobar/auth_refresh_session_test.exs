defmodule Kaarobar.AuthRefreshSessionTest do
  use KaarobarWeb.ConnCase
  import Ecto.Query

  alias Kaarobar.{Accounts, Repo, Tenancy}
  alias Kaarobar.Schemas.RefreshSession

  setup do
    email = "refresh-#{System.unique_integer([:positive])}@test.local"

    {:ok, user} =
      Accounts.register(%{
        email: email,
        password: "Password@123",
        name: "Refresh Owner"
      })

    {:ok, business} = Tenancy.create_business(user.id, %{name: "Refresh Biz"})
    {:ok, branch} = Tenancy.create_branch(business.id, user, %{name: "Main"})

    %{email: email, password: "Password@123", business: business, branch: branch}
  end

  test "signin issues access and refresh tokens", %{conn: conn, email: email, password: password} do
    conn =
      post(conn, "/api/v1/auth/login", %{
        "actor" => "business",
        "email" => email,
        "password" => password
      })

    body = json_response(conn, 200)
    assert is_binary(body["access_token"])
    assert is_binary(body["refresh_token"])
    assert body["token_type"] == "Bearer"
  end

  test "refresh issues new access token", %{conn: conn, email: email, password: password} do
    login =
      conn
      |> post("/api/v1/auth/login", %{
        "actor" => "business",
        "email" => email,
        "password" => password
      })
      |> json_response(200)

    conn =
      post(build_conn(), "/api/v1/auth/refresh", %{"refresh_token" => login["refresh_token"]})

    refreshed = json_response(conn, 200)
    assert is_binary(refreshed["access_token"])
    assert refreshed["expires_in"] == 24 * 60 * 60
  end

  test "revoked refresh token is rejected", %{
    conn: conn,
    email: email,
    password: password,
    business: business,
    branch: branch
  } do
    login =
      conn
      |> post("/api/v1/auth/login", %{
        "actor" => "business",
        "email" => email,
        "password" => password
      })
      |> json_response(200)

    logout_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{login["access_token"]}")
      |> put_req_header("x-business-id", business.id)
      |> put_req_header("x-branch-id", branch.id)
      |> post("/api/v1/auth/logout", %{"refresh_token" => login["refresh_token"]})

    assert %{"ok" => true} = json_response(logout_conn, 200)

    refresh_conn =
      post(build_conn(), "/api/v1/auth/refresh", %{"refresh_token" => login["refresh_token"]})

    assert %{"error" => "invalid_refresh_token"} = json_response(refresh_conn, 401)
  end

  test "expired refresh token is rejected", %{conn: conn, email: email, password: password} do
    login =
      conn
      |> post("/api/v1/auth/login", %{
        "actor" => "business",
        "email" => email,
        "password" => password
      })
      |> json_response(200)

    hash = :crypto.hash(:sha256, login["refresh_token"]) |> Base.encode16(case: :lower)

    from(rs in RefreshSession, where: rs.token_hash == ^hash)
    |> Repo.update_all(set: [expires_at: DateTime.utc_now() |> DateTime.add(-60, :second)])

    refresh_conn =
      post(build_conn(), "/api/v1/auth/refresh", %{"refresh_token" => login["refresh_token"]})

    assert %{"error" => "invalid_refresh_token"} = json_response(refresh_conn, 401)
  end

  test "logout revokes refresh token row", %{
    conn: conn,
    email: email,
    password: password,
    business: business,
    branch: branch
  } do
    login =
      conn
      |> post("/api/v1/auth/login", %{
        "actor" => "business",
        "email" => email,
        "password" => password
      })
      |> json_response(200)

    hash = :crypto.hash(:sha256, login["refresh_token"]) |> Base.encode16(case: :lower)

    build_conn()
    |> put_req_header("authorization", "Bearer #{login["access_token"]}")
    |> put_req_header("x-business-id", business.id)
    |> put_req_header("x-branch-id", branch.id)
    |> post("/api/v1/auth/logout", %{"refresh_token" => login["refresh_token"]})
    |> json_response(200)

    session = Repo.get_by!(RefreshSession, token_hash: hash)
    assert session.revoked_at != nil
  end
end
