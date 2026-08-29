defmodule Kaarobar.Accounts.User do
  @moduledoc """
  A person's login, independent of any tenant.

  The same human may own one organization, cashier at a friend's shop, and
  audit a third — one account, three memberships. Nothing tenant-specific
  belongs here; that lives on `Kaarobar.Tenancy.Membership`.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User

  @statuses ~w(active suspended deleted)

  # NIST 800-63B: length is what matters, composition rules mostly push people
  # towards "Password1!" and a sticky note on the till. A shop's staff will type
  # this on a tablet several times a day, so the floor is a real minimum rather
  # than theatre.
  @min_password_length 10
  @max_password_length 72

  # Five wrong attempts, then a short cool-off. Long enough to make online
  # guessing pointless, short enough that a cashier who fat-fingered their
  # password is not locked out of the counter for the rest of a shift.
  @max_failed_logins 5
  @lockout_minutes 15

  schema "users" do
    field :email, :string
    field :hashed_password, :string, redact: true
    field :name, :string
    field :phone, :string
    field :avatar_url, :string

    field :locale, :string, default: "en"
    field :timezone, :string, default: "UTC"

    field :confirmed_at, :utc_datetime_usec
    field :totp_secret, Kaarobar.Encrypted.Binary, redact: true
    field :totp_confirmed_at, :utc_datetime_usec

    field :status, :string, default: "active"

    field :last_login_at, :utc_datetime_usec
    field :failed_login_count, :integer, default: 0
    field :locked_until, :utc_datetime_usec

    field :deleted_at, :utc_datetime_usec

    field :password, :string, virtual: true, redact: true
    field :current_password, :string, virtual: true, redact: true

    has_many :memberships, Kaarobar.Tenancy.Membership
    has_many :tokens, Kaarobar.Accounts.UserToken

    timestamps()
  end

  @doc "The statuses a user may hold."
  def statuses, do: @statuses

  @doc "The shortest password accepted."
  def min_password_length, do: @min_password_length

  @doc "How many failed attempts trigger a lockout."
  def max_failed_logins, do: @max_failed_logins

  @doc """
  Changeset for signing up: email, password and name.

  Pass `hash_password: false` to validate without paying the Argon2 cost —
  useful when checking a form before submitting it.
  """
  def registration_changeset(user, attrs, opts \\ []) do
    user
    |> cast(attrs, [:email, :password, :name, :phone, :locale, :timezone])
    |> validate_email()
    |> validate_password(opts)
    |> validate_name()
    |> validate_locale_and_timezone()
  end

  @doc """
  Changeset for a staff member created by an invitation.

  There is no password: the invitee sets one when they accept. Until then the
  account exists but cannot be signed into, which is what makes an unaccepted
  invitation worthless to anyone who intercepts it.
  """
  def invited_user_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :name, :phone, :locale, :timezone])
    |> validate_email()
    |> validate_name()
    |> validate_locale_and_timezone()
  end

  @doc "Changeset for the fields a user may edit about themselves."
  def profile_changeset(user, attrs) do
    user
    |> cast(attrs, [:name, :phone, :avatar_url, :locale, :timezone])
    |> validate_name()
    |> validate_locale_and_timezone()
    |> validate_length(:avatar_url, max: 2048)
  end

  @doc """
  Changeset for changing the email address.

  Errors when the address is unchanged, so "save" on an untouched form does not
  silently start an email re-confirmation cycle.
  """
  def email_changeset(user, attrs) do
    user
    |> cast(attrs, [:email])
    |> validate_email()
    |> case do
      %{changes: %{email: _email}} = changeset -> changeset
      changeset -> add_error(changeset, :email, "did not change")
    end
  end

  @doc "Changeset for setting or replacing the password."
  def password_changeset(user, attrs, opts \\ []) do
    user
    |> cast(attrs, [:password])
    |> validate_confirmation(:password, message: "does not match password")
    |> validate_password(opts)
  end

  @doc "Marks the address confirmed."
  def confirm_changeset(user) do
    change(user, confirmed_at: DateTime.utc_now())
  end

  @doc "Records a successful sign-in and clears any failed-attempt state."
  def successful_login_changeset(user) do
    change(user,
      last_login_at: DateTime.utc_now(),
      failed_login_count: 0,
      locked_until: nil
    )
  end

  @doc """
  Records a failed sign-in, locking the account once the threshold is reached.
  """
  def failed_login_changeset(%User{} = user) do
    count = (user.failed_login_count || 0) + 1

    locked_until =
      if count >= @max_failed_logins do
        DateTime.add(DateTime.utc_now(), @lockout_minutes * 60, :second)
      end

    change(user, failed_login_count: count, locked_until: locked_until)
  end

  @doc "Changeset for enabling or clearing TOTP."
  def totp_changeset(user, attrs) do
    user
    |> cast(attrs, [:totp_secret, :totp_confirmed_at])
  end

  @doc "Changeset for suspending or restoring an account."
  def status_changeset(user, status) when status in @statuses do
    change(user, status: status)
  end

  @doc "Soft-deletes the account, freeing the email address for reuse."
  def soft_delete_changeset(user) do
    change(user, deleted_at: DateTime.utc_now(), status: "deleted")
  end

  # --- Predicates -------------------------------------------------------------

  @doc """
  Verifies a password against the stored hash.

  Runs a dummy hash when the user is missing or has no password so that the
  response time does not reveal whether an address is registered.
  """
  def valid_password?(%User{hashed_password: hashed_password}, password)
      when is_binary(hashed_password) and byte_size(password) > 0 do
    Argon2.verify_pass(password, hashed_password)
  end

  def valid_password?(_user, _password) do
    Argon2.no_user_verify()
    false
  end

  @doc "True when the account is temporarily locked after failed sign-ins."
  def locked?(%User{locked_until: nil}), do: false

  def locked?(%User{locked_until: locked_until}) do
    DateTime.compare(locked_until, DateTime.utc_now()) == :gt
  end

  @doc "True when the account may sign in at all."
  def active?(%User{status: "active", deleted_at: nil} = user), do: not locked?(user)
  def active?(%User{}), do: false

  @doc "True when TOTP is set up and confirmed."
  def totp_enabled?(%User{totp_confirmed_at: nil}), do: false
  def totp_enabled?(%User{}), do: true

  @doc """
  Validates the supplied `current_password` against the stored hash.

  Required before changing an email address or password, so a walked-away
  session cannot be used to take the account over.
  """
  def validate_current_password(changeset, password) do
    changeset = cast(changeset, %{current_password: password}, [:current_password])

    if changed?(changeset, :current_password) and
         not valid_password?(changeset.data, password) do
      add_error(changeset, :current_password, "is not valid")
    else
      changeset
    end
  end

  # --- Validation -------------------------------------------------------------

  defp validate_email(changeset) do
    changeset
    |> validate_required([:email])
    |> update_change(:email, &normalize_email/1)
    |> validate_format(:email, ~r/^[^@,;\s]+@[^@,;\s]+\.[^@,;\s]+$/,
      message: "must be a valid email address"
    )
    |> validate_length(:email, max: 160)
    |> unsafe_validate_unique(:email, Kaarobar.Repo, query: active_users_query())
    |> unique_constraint(:email, name: :users_email_index)
  end

  defp validate_name(changeset) do
    changeset
    |> validate_required([:name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 120)
  end

  defp validate_locale_and_timezone(changeset) do
    changeset
    |> validate_length(:locale, max: 12)
    |> validate_length(:timezone, max: 64)
  end

  defp validate_password(changeset, opts) do
    changeset
    |> validate_required([:password])
    |> validate_length(:password,
      min: @min_password_length,
      max: @max_password_length,
      count: :bytes
    )
    |> validate_not_obvious_password()
    |> maybe_hash_password(opts)
  end

  # A short deny-list, not a policy engine. It stops the handful of passwords
  # that a scripted attack tries first without inflicting composition rules on
  # everyone.
  @obvious_passwords ~w(
    password password1 password123 passw0rd 1234567890 12345678901 123456789012
    qwertyuiop letmeinnow iloveyou123 administrator kaarobar1 welcome123
  )

  defp validate_not_obvious_password(changeset) do
    validate_change(changeset, :password, fn :password, password ->
      if String.downcase(password) in @obvious_passwords do
        [password: "is too easy to guess"]
      else
        []
      end
    end)
  end

  defp maybe_hash_password(changeset, opts) do
    hash? = Keyword.get(opts, :hash_password, true)
    password = get_change(changeset, :password)

    if hash? && password && changeset.valid? do
      changeset
      |> put_change(:hashed_password, Argon2.hash_pwd_salt(password))
      |> delete_change(:password)
    else
      changeset
    end
  end

  defp normalize_email(email) do
    email |> String.trim() |> String.downcase()
  end

  # Soft-deleted accounts release their address, matching the partial unique
  # index on the table.
  defp active_users_query do
    import Ecto.Query, only: [from: 2]
    from user in User, where: is_nil(user.deleted_at)
  end
end
