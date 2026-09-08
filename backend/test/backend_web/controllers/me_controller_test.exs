defmodule KaarobarWeb.MeControllerTest do
  use KaarobarWeb.ConnCase, async: true

  alias Kaarobar.Accounts
  alias Kaarobar.Accounts.TOTP

  describe "TOTP enrollment" do
    test "enroll returns a QR-ready otpauth URI and confirm turns it on", %{conn: conn} do
      %{user: user} = owner_scope()
      conn = sign_in(conn, user)

      enrolled = post(conn, ~p"/api/v1/me/mfa/enroll")
      assert %{"provisioning_uri" => uri} = json_data(enrolled, 200)
      assert uri =~ "otpauth://totp/"

      pending = Accounts.get_user!(user.id)
      refute pending.totp_confirmed_at
      code = TOTP.generate(pending.totp_secret, div(System.os_time(:second), 30))

      confirmed = post(conn, ~p"/api/v1/me/mfa/confirm", %{"code" => code})
      assert %{"email" => _} = json_data(confirmed, 200)
      assert Accounts.get_user!(user.id).totp_confirmed_at
    end

    test "confirm with the wrong code is refused", %{conn: conn} do
      %{user: user} = owner_scope()
      conn = sign_in(conn, user)

      post(conn, ~p"/api/v1/me/mfa/enroll")
      confirmed = post(conn, ~p"/api/v1/me/mfa/confirm", %{"code" => "000000"})

      assert json_error(confirmed, 422)
      refute Accounts.get_user!(user.id).totp_confirmed_at
    end

    test "disable requires the current password", %{conn: conn} do
      %{user: user} = owner_scope()
      conn = sign_in(conn, user)

      post(conn, ~p"/api/v1/me/mfa/enroll")

      code =
        TOTP.generate(Accounts.get_user!(user.id).totp_secret, div(System.os_time(:second), 30))

      post(conn, ~p"/api/v1/me/mfa/confirm", %{"code" => code})

      refused = post(conn, ~p"/api/v1/me/mfa/disable", %{"current_password" => "wrong-password"})
      assert %{"code" => "invalid_credentials"} = json_error(refused, 401)
      assert Accounts.get_user!(user.id).totp_confirmed_at

      ok = post(conn, ~p"/api/v1/me/mfa/disable", %{"current_password" => valid_password()})
      assert json_data(ok, 200)
      refute Accounts.get_user!(user.id).totp_confirmed_at
    end
  end

  describe "GET /api/v1/me/export" do
    test "returns the caller's own profile, memberships and recent actions", %{conn: conn} do
      %{scope: scope, user: user, organization: organization} = owner_scope()
      conn = sign_in(conn, user)

      Kaarobar.Audit.log(scope, "product.created", nil, entity_type: "product")

      conn = get(conn, ~p"/api/v1/me/export")

      assert %{
               "profile" => %{"email" => email},
               "memberships" => [%{"organization_id" => org_id}],
               "actions" => actions
             } = json_data(conn, 200)

      assert email == user.email
      assert org_id == organization.id
      assert Enum.any?(actions, &(&1["action"] == "product.created"))
    end
  end

  describe "POST /api/v1/me/erase" do
    test "scrubs the account and signs every device out", %{conn: conn} do
      %{user: user} = owner_scope()
      conn = sign_in(conn, user)

      erased = post(conn, ~p"/api/v1/me/erase", %{"current_password" => valid_password()})
      assert json_data(erased, 200)

      reloaded = Kaarobar.Repo.get!(Kaarobar.Accounts.User, user.id)
      assert reloaded.status == "deleted"
      assert reloaded.deleted_at
      assert reloaded.name == "Deleted user"
      refute reloaded.phone
      assert reloaded.email =~ "erased.kaarobar.invalid"

      # The very token used to erase the account no longer works — erasure
      # revokes every device, itself included. `conn` still carries the same
      # `authorization` header it signed in with.
      after_erasure = get(conn, ~p"/api/v1/me")
      assert json_error(after_erasure, 401)
    end

    test "refuses without the right password", %{conn: conn} do
      %{user: user} = owner_scope()
      conn = sign_in(conn, user)

      refused = post(conn, ~p"/api/v1/me/erase", %{"current_password" => "wrong"})
      assert %{"code" => "invalid_credentials"} = json_error(refused, 401)

      assert Kaarobar.Repo.get!(Kaarobar.Accounts.User, user.id).status == "active"
    end
  end
end
