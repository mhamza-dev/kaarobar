defmodule Kaarobar.Accounts do
  @moduledoc """
  User identity: registration, sign-in, bearer tokens and account recovery.

  This context knows nothing about tenants. A user is a person; the link
  between a person and an organization lives in `Kaarobar.Tenancy`.

  ## Sign-in

  `authenticate/3` is deliberately uniform in what it reveals. A missing
  account, a wrong password and a soft-deleted account all return
  `{:error, :invalid_credentials}` and all pay the Argon2 cost, so response
  timing and error text give an attacker no way to enumerate which addresses
  are registered.

  The exceptions are states the *legitimate* user needs explained:
  `:account_locked` after repeated failures, and `:account_suspended` when an
  owner has switched them off. Telling someone "you are locked out" is only
  useful to a person who already proved they know the password, so those are
  returned only after the password verifies.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Accounts.Notifier
  alias Kaarobar.Accounts.User
  alias Kaarobar.Accounts.UserToken
  alias Kaarobar.Repo

  # --- Lookup -----------------------------------------------------------------

  @doc "Fetches a user by id."
  @spec fetch_user(Ecto.UUID.t()) :: {:ok, User.t()} | {:error, :not_found}
  def fetch_user(id) do
    case Repo.one(from user in active_users(), where: user.id == ^id) do
      nil -> {:error, :not_found}
      user -> {:ok, user}
    end
  end

  @doc "Fetches a user by id, raising if absent."
  @spec get_user!(Ecto.UUID.t()) :: User.t()
  def get_user!(id), do: Repo.one!(from user in active_users(), where: user.id == ^id)

  @doc "Fetches a user by email address, case-insensitively."
  @spec get_user_by_email(String.t()) :: User.t() | nil
  def get_user_by_email(email) when is_binary(email) do
    Repo.one(from user in active_users(), where: user.email == ^String.downcase(String.trim(email)))
  end

  def get_user_by_email(_email), do: nil

  # --- Registration -----------------------------------------------------------

  @doc """
  Registers a user with a password.

  Returns the user unconfirmed; `deliver_confirmation_instructions/2` starts
  the email flow. The account works before confirmation — a shop owner
  signing up at 11pm should be able to set up their catalog immediately, not
  wait on an email — but unconfirmed addresses are excluded from anything that
  sends mail to customers.
  """
  @spec register_user(map()) :: {:ok, User.t()} | {:error, Ecto.Changeset.t()}
  def register_user(attrs) do
    %User{}
    |> User.registration_changeset(attrs)
    |> Repo.insert()
  end

  @doc "A registration changeset for validating a form without inserting."
  @spec change_user_registration(User.t(), map()) :: Ecto.Changeset.t()
  def change_user_registration(%User{} = user \\ %User{}, attrs \\ %{}) do
    User.registration_changeset(user, attrs, hash_password: false)
  end

  @doc """
  Finds or creates the user behind an accepted invitation.

  An invitee who already has an account joins with it rather than being forced
  to keep a second login for every shop they work at.
  """
  @spec fetch_or_create_invited_user(map()) :: {:ok, User.t()} | {:error, Ecto.Changeset.t()}
  def fetch_or_create_invited_user(attrs) do
    email = attrs["email"] || attrs[:email]

    case get_user_by_email(email) do
      %User{} = user -> {:ok, user}
      nil -> %User{} |> User.invited_user_changeset(attrs) |> Repo.insert()
    end
  end

  # --- Authentication ---------------------------------------------------------

  @type auth_error :: :invalid_credentials | :account_locked | :account_suspended

  @doc """
  Verifies an email and password.

  Records the attempt either way: a success clears the failure counter, a
  failure increments it and locks the account once the threshold is reached.
  """
  @spec authenticate(String.t(), String.t()) :: {:ok, User.t()} | {:error, auth_error()}
  def authenticate(email, password) do
    user = get_user_by_email(email)

    cond do
      is_nil(user) ->
        # Burn the same time as a real verification so that a missing account
        # is indistinguishable from a wrong password.
        Argon2.no_user_verify()
        {:error, :invalid_credentials}

      not User.valid_password?(user, password) ->
        record_failed_login(user)
        {:error, :invalid_credentials}

      User.locked?(user) ->
        {:error, :account_locked}

      user.status != "active" ->
        {:error, :account_suspended}

      true ->
        record_successful_login(user)
    end
  end

  defp record_successful_login(%User{} = user) do
    user |> User.successful_login_changeset() |> Repo.update()
  end

  defp record_failed_login(%User{} = user) do
    user |> User.failed_login_changeset() |> Repo.update()
    :ok
  end

  # --- Bearer tokens ----------------------------------------------------------

  @doc """
  Issues a bearer token for a device and returns the plaintext.

  The plaintext is returned exactly once. Nothing can recover it afterwards,
  including us.

  ## Options

    * `:context` — `"api"` (default, one year) or `"session"` (sixty days)
    * `:device_name`, `:user_agent`, `:ip_address` — shown on the user's device
      list so they can tell which one to revoke
  """
  @spec create_bearer_token(User.t(), keyword()) :: {String.t(), UserToken.t()}
  def create_bearer_token(%User{} = user, opts \\ []) do
    {plaintext, token} = UserToken.build_bearer_token(user, opts)
    {plaintext, Repo.insert!(token)}
  end

  @doc """
  Resolves a bearer token to its user, touching `last_used_at`.

  Returns `{:ok, user, token}` or `{:error, :unauthorized}`. Revoked tokens,
  expired tokens and tokens belonging to a suspended or deleted account all
  fail — a dismissed employee's tablet stops working on their next request,
  not at their next sign-in.
  """
  @spec fetch_user_by_bearer_token(String.t()) ::
          {:ok, User.t(), UserToken.t()} | {:error, :unauthorized}
  def fetch_user_by_bearer_token(plaintext) when is_binary(plaintext) do
    with {:ok, query} <- UserToken.verify_bearer_token_query(plaintext),
         {%User{} = user, %UserToken{} = token} <- Repo.one(query) do
      {:ok, user, touch_token(token)}
    else
      _other -> {:error, :unauthorized}
    end
  end

  def fetch_user_by_bearer_token(_plaintext), do: {:error, :unauthorized}

  # Coarse to avoid a write on every single request: a token used a minute ago
  # is "in use" for any purpose this timestamp serves.
  @touch_interval_seconds 60

  defp touch_token(%UserToken{} = token) do
    now = DateTime.utc_now()

    if stale?(token.last_used_at, now) do
      {:ok, touched} = token |> Ecto.Changeset.change(last_used_at: now) |> Repo.update()
      touched
    else
      token
    end
  end

  defp stale?(nil, _now), do: true

  defp stale?(last_used_at, now) do
    DateTime.diff(now, last_used_at, :second) >= @touch_interval_seconds
  end

  @doc "Lists a user's active sign-in tokens, newest first."
  @spec list_bearer_tokens(User.t()) :: [UserToken.t()]
  def list_bearer_tokens(%User{} = user) do
    Repo.all(
      from token in UserToken.by_user_and_contexts_query(user, ["api", "session"]),
        where: is_nil(token.revoked_at),
        order_by: [desc: token.inserted_at]
    )
  end

  @doc "Revokes one device's token."
  @spec revoke_bearer_token(User.t(), Ecto.UUID.t()) :: :ok | {:error, :not_found}
  def revoke_bearer_token(%User{} = user, token_id) do
    query = UserToken.by_user_and_id_query(user, token_id)

    case Repo.update_all(query, set: [revoked_at: DateTime.utc_now()]) do
      {0, _returning} -> {:error, :not_found}
      {_count, _returning} -> :ok
    end
  end

  @doc """
  Signs the user out everywhere.

  Deletes rather than marks revoked: this is the "my phone was stolen" button
  and should leave nothing behind that could be un-revoked.
  """
  @spec revoke_all_bearer_tokens(User.t()) :: :ok
  def revoke_all_bearer_tokens(%User{} = user) do
    Repo.delete_all(UserToken.by_user_and_contexts_query(user, ["api", "session"]))
    :ok
  end

  @doc "Deletes tokens that have expired or been revoked. Run on a schedule."
  @spec prune_expired_tokens() :: {non_neg_integer(), nil}
  def prune_expired_tokens do
    Repo.delete_all(UserToken.expired_query())
  end

  # --- Profile ----------------------------------------------------------------

  @doc "Updates the fields a user may edit about themselves."
  @spec update_profile(User.t(), map()) :: {:ok, User.t()} | {:error, Ecto.Changeset.t()}
  def update_profile(%User{} = user, attrs) do
    user |> User.profile_changeset(attrs) |> Repo.update()
  end

  @doc """
  Changes the password, after checking the current one.

  Every other session is signed out. Changing a password is what someone does
  when they think it has been compromised, and leaving other sessions alive
  would defeat the point.
  """
  @spec update_password(User.t(), String.t(), map()) ::
          {:ok, User.t()} | {:error, Ecto.Changeset.t()}
  def update_password(%User{} = user, current_password, attrs) do
    changeset =
      user
      |> User.password_changeset(attrs)
      |> User.validate_current_password(current_password)

    case Repo.update(changeset) do
      {:ok, updated} ->
        revoke_all_bearer_tokens(updated)
        {:ok, updated}

      {:error, failed} ->
        {:error, failed}
    end
  end

  @doc """
  Changes the email address, after checking the password.

  The new address starts unconfirmed, so a mistyped address cannot silently
  become the one that receives password resets.
  """
  @spec update_email(User.t(), String.t(), map()) :: {:ok, User.t()} | {:error, Ecto.Changeset.t()}
  def update_email(%User{} = user, current_password, attrs) do
    user
    |> User.email_changeset(attrs)
    |> User.validate_current_password(current_password)
    |> Ecto.Changeset.put_change(:confirmed_at, nil)
    |> Repo.update()
  end

  # --- Password reset ---------------------------------------------------------

  @doc """
  Emails a password reset link.

  Always returns `:ok`, whether or not the address is registered. Reporting
  "no such account" here would turn the reset form into an address checker.
  """
  @spec deliver_reset_password_instructions(String.t(), (String.t() -> String.t())) :: :ok
  def deliver_reset_password_instructions(email, url_fun) when is_function(url_fun, 1) do
    case get_user_by_email(email) do
      %User{} = user ->
        {plaintext, token} = UserToken.build_email_token(user, "reset_password")
        Repo.insert!(token)
        Notifier.deliver_reset_password_instructions(user, url_fun.(plaintext))
        :ok

      nil ->
        :ok
    end
  end

  @doc """
  Resets a password from a valid token.

  The token and every existing session are destroyed: whoever triggered the
  reset gets a fresh sign-in, and anyone already holding a session loses it.
  """
  @spec reset_password(String.t(), map()) ::
          {:ok, User.t()} | {:error, Ecto.Changeset.t() | :invalid_token}
  def reset_password(plaintext_token, attrs) do
    case fetch_user_by_email_token(plaintext_token, "reset_password") do
      {:ok, user} ->
        Repo.transaction(fn ->
          case user |> User.password_changeset(attrs) |> Repo.update() do
            {:ok, updated} ->
              Repo.delete_all(UserToken.by_user_and_contexts_query(updated, :all))
              updated

            {:error, failed} ->
              Repo.rollback(failed)
          end
        end)

      :error ->
        {:error, :invalid_token}
    end
  end

  # --- Email confirmation -----------------------------------------------------

  @doc "Emails a confirmation link. No-op for an already-confirmed address."
  @spec deliver_confirmation_instructions(User.t(), (String.t() -> String.t())) ::
          :ok | {:error, :already_confirmed}
  def deliver_confirmation_instructions(%User{confirmed_at: nil} = user, url_fun)
      when is_function(url_fun, 1) do
    {plaintext, token} = UserToken.build_email_token(user, "confirm")
    Repo.insert!(token)
    Notifier.deliver_confirmation_instructions(user, url_fun.(plaintext))
    :ok
  end

  def deliver_confirmation_instructions(%User{}, _url_fun), do: {:error, :already_confirmed}

  @doc "Confirms an address from a valid token."
  @spec confirm_user(String.t()) :: {:ok, User.t()} | {:error, :invalid_token}
  def confirm_user(plaintext_token) do
    case fetch_user_by_email_token(plaintext_token, "confirm") do
      {:ok, user} ->
        Repo.transaction(fn ->
          {:ok, confirmed} = user |> User.confirm_changeset() |> Repo.update()
          Repo.delete_all(UserToken.by_user_and_contexts_query(confirmed, ["confirm"]))
          confirmed
        end)

      :error ->
        {:error, :invalid_token}
    end
  end

  defp fetch_user_by_email_token(plaintext, context) do
    with {:ok, query} <- UserToken.verify_email_token_query(plaintext, context),
         %User{} = user <- Repo.one(query) do
      {:ok, user}
    else
      _other -> :error
    end
  end

  # --- Administration ---------------------------------------------------------

  @doc "Suspends or restores an account across every organization it belongs to."
  @spec set_user_status(User.t(), String.t()) :: {:ok, User.t()} | {:error, Ecto.Changeset.t()}
  def set_user_status(%User{} = user, status) do
    case user |> User.status_changeset(status) |> Repo.update() do
      {:ok, updated} ->
        if status != "active", do: revoke_all_bearer_tokens(updated)
        {:ok, updated}

      {:error, failed} ->
        {:error, failed}
    end
  end

  defp active_users do
    from user in User, where: is_nil(user.deleted_at)
  end
end
