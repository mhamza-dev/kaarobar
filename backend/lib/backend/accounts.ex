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
  alias Kaarobar.Accounts.TOTP
  alias Kaarobar.Accounts.User
  alias Kaarobar.Accounts.UserToken
  alias Kaarobar.Repo

  @mfa_challenge_salt "mfa challenge"

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
    Repo.one(
      from user in active_users(), where: user.email == ^String.downcase(String.trim(email))
    )
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

  # --- Multi-factor authentication ---------------------------------------------
  #
  # Three states a user moves through in order: no secret at all; a secret
  # generated but not yet confirmed (`start_totp_enrollment/1` was called, the
  # QR code was shown, but the app has not proven it can produce a matching
  # code yet); confirmed, at which point `login/2` starts asking for one. The
  # middle state is what stops a client that shows the QR code but is
  # abandoned before scanning from silently locking the account out — nothing
  # is required until `confirm_totp_enrollment/2` succeeds.

  @doc """
  Starts TOTP enrollment: generates a secret and returns it unconfirmed.

  Calling this again before confirming replaces the pending secret rather than
  accumulating one per attempt — there is only ever one QR code worth showing.
  """
  @spec start_totp_enrollment(User.t()) :: {:ok, User.t(), secret_uri :: String.t()}
  def start_totp_enrollment(%User{} = user) do
    secret = TOTP.generate_secret()

    {:ok, updated} =
      user
      |> User.totp_changeset(%{totp_secret: secret, totp_confirmed_at: nil})
      |> Repo.update()

    {:ok, updated, TOTP.provisioning_uri(secret, user.email)}
  end

  @doc """
  Confirms enrollment with a code from the app, turning it on.

  The one place a code is checked against a *pending* secret rather than a
  confirmed one — proving the app was set up correctly is the whole point of
  this step.
  """
  @spec confirm_totp_enrollment(User.t(), String.t()) ::
          {:ok, User.t()} | {:error, :no_pending_enrollment | :invalid_code}
  def confirm_totp_enrollment(%User{totp_secret: nil}, _code),
    do: {:error, :no_pending_enrollment}

  def confirm_totp_enrollment(%User{totp_secret: secret} = user, code) do
    if TOTP.valid?(secret, code) do
      user |> User.totp_changeset(%{totp_confirmed_at: DateTime.utc_now()}) |> Repo.update()
    else
      {:error, :invalid_code}
    end
  end

  @doc "Turns MFA off, after confirming the password."
  @spec disable_totp(User.t(), String.t()) :: {:ok, User.t()} | {:error, :invalid_credentials}
  def disable_totp(%User{} = user, current_password) do
    if User.valid_password?(user, current_password) do
      user |> User.totp_changeset(%{totp_secret: nil, totp_confirmed_at: nil}) |> Repo.update()
    else
      {:error, :invalid_credentials}
    end
  end

  @doc """
  Signs a short-lived challenge naming a user who has passed their password
  check but still owes a TOTP code.

  `Phoenix.Token`, not `Kaarobar.Accounts.UserToken`: this is never presented
  as a bearer token, never grants API access on its own, and five minutes
  from now it is worthless — a database row with its own expiry and revocation
  machinery would be doing that job with a bigger hammer than it needs.
  """
  @spec sign_mfa_challenge(User.t()) :: String.t()
  def sign_mfa_challenge(%User{} = user) do
    Phoenix.Token.sign(KaarobarWeb.Endpoint, @mfa_challenge_salt, user.id)
  end

  # --- GDPR: export and erasure ------------------------------------------------

  @doc """
  Everything this application holds about one person, for a data export
  request.

  Deliberately scoped to *personal* data: the profile, the tenants they
  belong to, the devices signed in as them, and the actions they themselves
  took (an audit trail is data *about* them as its actor, even though the
  entities it names — a sale, a business — are not). It does not include
  those entities' own data: a cashier's export lists that they rang up a
  sale, not the sale's line items, because the sale belongs to the business,
  not to the cashier.

  Reads across every organization the person has ever touched, which is why
  the audit read runs `as_system` rather than through the usual per-tenant
  scope — there is no one tenant this request is scoped to.
  """
  @spec export_personal_data(User.t()) :: map()
  def export_personal_data(%User{} = user) do
    # `memberships` is one of the tables RLS leaves unprotected (see
    # priv/repo/migrations/20260909000000_enable_row_level_security.exs) for
    # exactly this shape of query: a user's own memberships, across every
    # organization, filtered by identity rather than by tenant.
    memberships =
      Repo.all(
        from membership in Kaarobar.Tenancy.Membership,
          where: membership.user_id == ^user.id,
          order_by: [asc: membership.inserted_at]
      )

    audit_entries =
      Repo.as_system(fn ->
        Repo.all(
          from entry in Kaarobar.Audit.Entry,
            where: entry.actor_user_id == ^user.id,
            order_by: [desc: entry.inserted_at],
            limit: 500
        )
      end)

    %{
      profile: %{
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        locale: user.locale,
        timezone: user.timezone,
        confirmed_at: user.confirmed_at,
        mfa_enabled: User.totp_enabled?(user),
        created_at: user.inserted_at
      },
      memberships:
        Enum.map(memberships, fn membership ->
          %{
            organization_id: membership.organization_id,
            business_id: membership.business_id,
            job_title: membership.job_title,
            status: membership.status,
            since: membership.inserted_at
          }
        end),
      devices:
        Enum.map(
          list_bearer_tokens(user),
          &%{device_name: &1.device_name, last_used_at: &1.last_used_at}
        ),
      actions:
        Enum.map(
          audit_entries,
          &%{action: &1.action, entity_type: &1.entity_type, at: &1.inserted_at}
        )
    }
  end

  @doc """
  Erases a person's personal data, after confirming their password.

  Scrubs rather than deletes the row: `sales`, `audit_logs` and every other
  table with a foreign key to this user must survive for tax and financial
  retention law, and every one of those laws is the reason erasure means
  "stop identifying this person", not "make the row disappear". The email is
  replaced rather than blanked so it stays unique and stays freed for someone
  else to register, which blank strings colliding with each other would not.
  """
  @spec erase_personal_data(User.t(), String.t()) ::
          {:ok, User.t()} | {:error, :invalid_credentials}
  def erase_personal_data(%User{} = user, current_password) do
    if User.valid_password?(user, current_password) do
      revoke_all_bearer_tokens(user)

      user
      |> Ecto.Changeset.change(
        name: "Deleted user",
        email: "deleted-#{user.id}@erased.kaarobar.invalid",
        phone: nil,
        avatar_url: nil,
        totp_secret: nil,
        totp_confirmed_at: nil,
        hashed_password: Argon2.hash_pwd_salt(:crypto.strong_rand_bytes(32) |> Base.encode64()),
        deleted_at: DateTime.utc_now(),
        status: "deleted"
      )
      |> Repo.update()
    else
      {:error, :invalid_credentials}
    end
  end

  @doc """
  Verifies an MFA challenge and the code presented against it.

  `{:error, :invalid_challenge}` covers an expired, tampered-with or already
  malformed token — the client's answer either way is "sign in again", so
  there is no reason to tell those apart.
  """
  @spec verify_mfa_challenge(String.t(), String.t()) ::
          {:ok, User.t()} | {:error, :invalid_challenge | :invalid_code}
  def verify_mfa_challenge(challenge, code) do
    with {:ok, user_id} <-
           Phoenix.Token.verify(KaarobarWeb.Endpoint, @mfa_challenge_salt, challenge,
             max_age: 300
           ),
         %User{} = user <- Repo.get(User, user_id),
         true <- User.totp_enabled?(user),
         true <- TOTP.valid?(user.totp_secret, code) do
      {:ok, user}
    else
      {:error, _reason} -> {:error, :invalid_challenge}
      nil -> {:error, :invalid_challenge}
      false -> {:error, :invalid_code}
    end
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
  @spec update_email(User.t(), String.t(), map()) ::
          {:ok, User.t()} | {:error, Ecto.Changeset.t()}
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
