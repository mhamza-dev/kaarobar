defmodule Kaarobar.AccountsTest do
  use Kaarobar.DataCase, async: true

  alias Kaarobar.Accounts
  alias Kaarobar.Accounts.User
  alias Kaarobar.Accounts.UserToken

  describe "register_user/1" do
    test "creates a user with a hashed password" do
      assert {:ok, user} =
               Accounts.register_user(%{
                 "email" => "owner@shop.pk",
                 "password" => "a-good-long-password",
                 "name" => "Ali"
               })

      assert user.email == "owner@shop.pk"
      assert user.hashed_password
      # The plaintext never survives the changeset.
      assert is_nil(user.password)
      assert User.valid_password?(user, "a-good-long-password")
    end

    test "normalises the email address" do
      {:ok, user} =
        Accounts.register_user(%{
          "email" => "  Owner@Shop.PK  ",
          "password" => "a-good-long-password",
          "name" => "Ali"
        })

      assert user.email == "owner@shop.pk"
    end

    test "rejects a duplicate address regardless of case" do
      insert(:user, email: "owner@shop.pk")

      assert {:error, changeset} =
               Accounts.register_user(%{
                 "email" => "OWNER@SHOP.PK",
                 "password" => "a-good-long-password",
                 "name" => "Ali"
               })

      assert "has already been taken" in errors_on(changeset).email
    end

    test "requires a plausible email address" do
      assert {:error, changeset} =
               Accounts.register_user(%{
                 "email" => "not-an-address",
                 "password" => "a-good-long-password",
                 "name" => "Ali"
               })

      assert errors_on(changeset).email != []
    end

    test "enforces a minimum password length" do
      assert {:error, changeset} =
               Accounts.register_user(%{
                 "email" => "owner@shop.pk",
                 "password" => "short",
                 "name" => "Ali"
               })

      assert Enum.any?(errors_on(changeset).password, &(&1 =~ "at least"))
    end

    test "refuses passwords that a scripted attack tries first" do
      assert {:error, changeset} =
               Accounts.register_user(%{
                 "email" => "owner@shop.pk",
                 "password" => "password123",
                 "name" => "Ali"
               })

      assert "is too easy to guess" in errors_on(changeset).password
    end

    test "requires a name" do
      assert {:error, changeset} =
               Accounts.register_user(%{
                 "email" => "owner@shop.pk",
                 "password" => "a-good-long-password"
               })

      assert errors_on(changeset).name != []
    end
  end

  describe "authenticate/2" do
    setup do
      %{user: insert(:user, email: "cashier@shop.pk")}
    end

    test "succeeds with the right password", %{user: user} do
      assert {:ok, authenticated} = Accounts.authenticate(user.email, valid_password())
      assert authenticated.id == user.id
      assert authenticated.last_login_at
    end

    test "fails with the wrong password", %{user: user} do
      assert {:error, :invalid_credentials} = Accounts.authenticate(user.email, "wrong-password")
    end

    test "gives the same answer for an address that does not exist" do
      assert {:error, :invalid_credentials} =
               Accounts.authenticate("nobody@shop.pk", valid_password())
    end

    test "counts failures and locks the account at the threshold", %{user: user} do
      for _attempt <- 1..User.max_failed_logins() do
        assert {:error, :invalid_credentials} = Accounts.authenticate(user.email, "wrong")
      end

      # The password is now right, but the account is locked — and the caller
      # is told so, because they have proved they know the password.
      assert {:error, :account_locked} = Accounts.authenticate(user.email, valid_password())
    end

    test "a successful sign-in clears the failure count", %{user: user} do
      assert {:error, :invalid_credentials} = Accounts.authenticate(user.email, "wrong")
      assert {:ok, _user} = Accounts.authenticate(user.email, valid_password())

      assert Repo.get!(User, user.id).failed_login_count == 0
    end

    test "a suspended account cannot sign in" do
      user = insert(:user, status: "suspended")

      assert {:error, :account_suspended} = Accounts.authenticate(user.email, valid_password())
    end

    test "a soft-deleted account is indistinguishable from a missing one" do
      user = insert(:user, deleted_at: DateTime.utc_now())

      assert {:error, :invalid_credentials} = Accounts.authenticate(user.email, valid_password())
    end
  end

  describe "bearer tokens" do
    setup do
      %{user: insert(:user)}
    end

    test "issue and resolve", %{user: user} do
      {plaintext, token} = Accounts.create_bearer_token(user, device_name: "Counter tablet")

      assert is_binary(plaintext)
      # Only the hash is stored — the plaintext must not be recoverable.
      refute token.token == plaintext
      assert {:ok, resolved, _token} = Accounts.fetch_user_by_bearer_token(plaintext)
      assert resolved.id == user.id
    end

    test "a garbage token resolves to nothing", %{user: _user} do
      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token("not-a-token")
      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token("")
    end

    test "a revoked token stops working", %{user: user} do
      {plaintext, token} = Accounts.create_bearer_token(user)

      :ok = Accounts.revoke_bearer_token(user, token.id)

      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token(plaintext)
    end

    test "an expired token stops working", %{user: user} do
      {plaintext, token} = Accounts.create_bearer_token(user)

      token
      |> Ecto.Changeset.change(expires_at: DateTime.add(DateTime.utc_now(), -60, :second))
      |> Repo.update!()

      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token(plaintext)
    end

    test "suspending the account invalidates the token immediately", %{user: user} do
      {plaintext, _token} = Accounts.create_bearer_token(user)

      {:ok, _suspended} = Accounts.set_user_status(user, "suspended")

      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token(plaintext)
    end

    test "revoking everything signs every device out", %{user: user} do
      {first, _token} = Accounts.create_bearer_token(user)
      {second, _token} = Accounts.create_bearer_token(user)

      :ok = Accounts.revoke_all_bearer_tokens(user)

      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token(first)
      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token(second)
    end

    test "one device's token is independent of another's", %{user: user} do
      {keep, _token} = Accounts.create_bearer_token(user, device_name: "Counter")
      {lose, lost_token} = Accounts.create_bearer_token(user, device_name: "Stolen tablet")

      :ok = Accounts.revoke_bearer_token(user, lost_token.id)

      assert {:ok, _user, _token} = Accounts.fetch_user_by_bearer_token(keep)
      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token(lose)
    end

    test "a token belonging to someone else cannot be revoked", %{user: user} do
      other = insert(:user)
      {_plaintext, token} = Accounts.create_bearer_token(other)

      assert {:error, :not_found} = Accounts.revoke_bearer_token(user, token.id)
    end

    test "listing shows devices, not secrets", %{user: user} do
      Accounts.create_bearer_token(user, device_name: "Counter tablet")

      assert [device] = Accounts.list_bearer_tokens(user)
      assert device.device_name == "Counter tablet"
    end

    test "pruning removes expired rows", %{user: user} do
      {_plaintext, token} = Accounts.create_bearer_token(user)

      token
      |> Ecto.Changeset.change(expires_at: DateTime.add(DateTime.utc_now(), -60, :second))
      |> Repo.update!()

      assert {1, nil} = Accounts.prune_expired_tokens()
      assert Repo.aggregate(UserToken, :count) == 0
    end
  end

  describe "update_password/3" do
    setup do
      %{user: insert(:user)}
    end

    test "requires the current password", %{user: user} do
      assert {:error, changeset} =
               Accounts.update_password(user, "wrong", %{"password" => "another-good-password"})

      assert "is not valid" in errors_on(changeset).current_password
    end

    test "changes the password and signs other devices out", %{user: user} do
      {plaintext, _token} = Accounts.create_bearer_token(user)

      assert {:ok, updated} =
               Accounts.update_password(user, valid_password(), %{
                 "password" => "another-good-password"
               })

      assert User.valid_password?(updated, "another-good-password")
      refute User.valid_password?(updated, valid_password())
      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token(plaintext)
    end

    test "rejects a confirmation that does not match", %{user: user} do
      assert {:error, changeset} =
               Accounts.update_password(user, valid_password(), %{
                 "password" => "another-good-password",
                 "password_confirmation" => "something-else"
               })

      assert errors_on(changeset).password_confirmation != []
    end
  end

  describe "update_email/3" do
    setup do
      %{user: insert(:user)}
    end

    test "changes the address and marks it unconfirmed again", %{user: user} do
      assert {:ok, updated} =
               Accounts.update_email(user, valid_password(), %{"email" => "new@shop.pk"})

      assert updated.email == "new@shop.pk"
      assert is_nil(updated.confirmed_at)
    end

    test "requires the current password", %{user: user} do
      assert {:error, changeset} =
               Accounts.update_email(user, "wrong", %{"email" => "new@shop.pk"})

      assert "is not valid" in errors_on(changeset).current_password
    end

    test "errors when the address is unchanged", %{user: user} do
      assert {:error, changeset} =
               Accounts.update_email(user, valid_password(), %{"email" => user.email})

      assert "did not change" in errors_on(changeset).email
    end
  end

  describe "password reset" do
    setup do
      %{user: insert(:user)}
    end

    test "sends a link to a registered address", %{user: user} do
      :ok =
        Accounts.deliver_reset_password_instructions(user.email, &"http://app.test/reset/#{&1}")

      assert_receive {:email, %Swoosh.Email{} = email}
      assert email.to == [{user.name, user.email}]
      assert email.text_body =~ "http://app.test/reset/"
    end

    test "says nothing about an unregistered address" do
      :ok =
        Accounts.deliver_reset_password_instructions(
          "nobody@shop.pk",
          &"http://app.test/reset/#{&1}"
        )

      # No email, and no error either — the caller cannot tell the difference,
      # which is the point.
      refute_receive {:email, _email}, 50
    end

    test "a valid token sets the new password and clears every session", %{user: user} do
      {session, _token} = Accounts.create_bearer_token(user)
      token = capture_reset_token(user)

      assert {:ok, updated} = Accounts.reset_password(token, %{"password" => "brand-new-password"})

      assert User.valid_password?(updated, "brand-new-password")
      assert {:error, :unauthorized} = Accounts.fetch_user_by_bearer_token(session)
    end

    test "a token works only once", %{user: user} do
      token = capture_reset_token(user)

      assert {:ok, _user} = Accounts.reset_password(token, %{"password" => "brand-new-password"})

      assert {:error, :invalid_token} =
               Accounts.reset_password(token, %{"password" => "another-new-password"})
    end

    test "a made-up token is refused" do
      assert {:error, :invalid_token} =
               Accounts.reset_password("nonsense", %{"password" => "brand-new-password"})
    end

    test "a weak new password is refused", %{user: user} do
      token = capture_reset_token(user)

      assert {:error, changeset} = Accounts.reset_password(token, %{"password" => "short"})
      assert errors_on(changeset).password != []
    end
  end

  describe "email confirmation" do
    test "confirms an address from a valid token" do
      user = insert(:user, confirmed_at: nil)
      :ok = Accounts.deliver_confirmation_instructions(user, &"http://app.test/confirm/#{&1}")
      token = capture_token_from_email("http://app.test/confirm/")

      assert {:ok, confirmed} = Accounts.confirm_user(token)
      assert confirmed.confirmed_at
    end

    test "does not resend for an already-confirmed address" do
      user = insert(:user, confirmed_at: DateTime.utc_now())

      assert {:error, :already_confirmed} =
               Accounts.deliver_confirmation_instructions(user, &"http://app.test/confirm/#{&1}")
    end
  end

  # --- Helpers ---------------------------------------------------------------

  defp capture_reset_token(user) do
    :ok = Accounts.deliver_reset_password_instructions(user.email, &"http://app.test/reset/#{&1}")
    capture_token_from_email("http://app.test/reset/")
  end

  # Swoosh's test adapter posts {:email, email} to the calling process, so the
  # link can be read out of the message the way a person reads it out of their
  # inbox — which is the only way a token is ever meant to travel.
  defp capture_token_from_email(prefix) do
    assert_receive {:email, %Swoosh.Email{text_body: body}}

    case Regex.run(~r/#{Regex.escape(prefix)}([\w\-]+)/, body) do
      [_whole, token] -> token
      nil -> flunk("no #{prefix} link was sent")
    end
  end
end
