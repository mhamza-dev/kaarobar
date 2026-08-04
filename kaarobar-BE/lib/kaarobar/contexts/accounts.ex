defmodule Kaarobar.Accounts do
  @moduledoc """
  Identity & MFA (TEN-FR-006).
  """
  @compile {:no_warn_undefined, NimbleTOTP}

  import Ecto.Query

  alias Kaarobar.{Audit, Guardian, Repo}
  alias Kaarobar.Schemas.{RefreshSession, User}

  def register(attrs) do
    result =
      %User{}
      |> User.registration_changeset(attrs)
      |> Repo.insert()

    case result do
      {:ok, user} ->
        _ =
          Audit.log(%{
            owner_id: user.id,
            user_id: user.id,
            action: "user.register",
            entity_type: "user",
            entity_id: user.id,
            metadata: %{email: user.email}
          })

        {:ok, user}

      error ->
        error
    end
  end

  def authenticate(email, password) do
    user = Repo.get_by(User, email: email)

    cond do
      user && user.status != "active" ->
        {:error, :inactive}

      user && User.verify_password(user, password) ->
        {:ok, user}

      user ->
        {:error, :invalid_credentials}

      true ->
        Argon2.no_user_verify()
        {:error, :invalid_credentials}
    end
  end

  def get_user(id), do: Repo.get(User, id)
  def get_user!(id), do: Repo.get!(User, id)
  def get_user_by_email(email), do: Repo.get_by(User, email: email)

  def update_user(%User{} = user, attrs) do
    user
    |> User.changeset(attrs)
    |> Repo.update()
  end

  def update_profile(%User{} = user, attrs) do
    user
    |> User.profile_changeset(attrs)
    |> Repo.update()
  end

  def mfa_enabled?(%User{} = user), do: User.mfa_enabled?(user)

  def begin_mfa_setup(%User{} = user) do
    secret = NimbleTOTP.secret()
    {:ok, updated} = update_user(user, %{totp_secret: Base.encode32(secret, padding: false)})

    uri =
      NimbleTOTP.otpauth_uri("Kaarobar:#{user.email}", secret, issuer: "Kaarobar")

    {:ok, %{secret: Base.encode32(secret, padding: false), otpauth_uri: uri, user: updated}}
  end

  def confirm_mfa(%User{} = user, code) do
    with {:ok, secret} <- decode_secret(user.totp_secret),
         true <- NimbleTOTP.valid?(secret, code) do
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      case update_user(user, %{totp_enabled_at: now, mfa_required: true}) do
        {:ok, updated} ->
          Audit.log(%{
            owner_id: user.id,
            user_id: user.id,
            action: "user.mfa_enable",
            entity_type: "user",
            entity_id: user.id,
            metadata: %{}
          })

          {:ok, updated}

        error ->
          error
      end
    else
      false -> {:error, :invalid_code}
      {:error, _} = err -> err
    end
  end

  def verify_totp(%User{} = user, code) do
    with {:ok, secret} <- decode_secret(user.totp_secret),
         true <- NimbleTOTP.valid?(secret, code) do
      :ok
    else
      false -> {:error, :invalid_code}
      {:error, _} = err -> err
    end
  end

  def issue_access_token(%User{} = user, opts \\ []) do
    ttl =
      if Keyword.get(opts, :remember_me, false) do
        # Remember me: 10 days
        {10, :day}
      else
        # Default session: 1 day
        {1, :day}
      end

    Guardian.encode_and_sign(user, %{}, token_type: "access", ttl: ttl)
  end

  def create_refresh_session(%User{} = user, user_agent \\ nil) do
    raw = random_token()

    expires_at =
      DateTime.utc_now() |> DateTime.add(14 * 86_400, :second) |> DateTime.truncate(:second)

    params = %{
      user_id: user.id,
      token_hash: hash_token(raw),
      expires_at: expires_at,
      user_agent: user_agent
    }

    case %RefreshSession{} |> RefreshSession.changeset(params) |> Repo.insert() do
      {:ok, _session} -> {:ok, raw}
      {:error, _} = error -> error
    end
  end

  def issue_access_token_from_refresh(raw_token) when is_binary(raw_token) do
    now = DateTime.utc_now()

    with %RefreshSession{} = session <-
           from(rs in RefreshSession,
             where: rs.token_hash == ^hash_token(raw_token),
             where: is_nil(rs.revoked_at),
             where: rs.expires_at > ^now
           )
           |> Repo.one(),
         %User{} = user <- Repo.get(User, session.user_id),
         {:ok, token, _claims} <- issue_access_token(user) do
      {:ok, token}
    else
      nil -> {:error, :invalid_refresh_token}
      {:error, _} = error -> error
    end
  end

  def revoke_refresh_session_for_user(raw_token, user_id)
      when is_binary(raw_token) and is_binary(user_id) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    token_hash = hash_token(raw_token)

    case Repo.get_by(RefreshSession, token_hash: token_hash, user_id: user_id) do
      nil ->
        {:error, :not_found}

      %RefreshSession{} = session ->
        session
        |> RefreshSession.changeset(%{revoked_at: now})
        |> Repo.update()
    end
  end

  def issue_mfa_challenge_token(%User{} = user) do
    Guardian.encode_and_sign(user, %{"mfa" => true}, token_type: "mfa", ttl: {5, :minute})
  end

  def user_from_mfa_token(token) do
    with {:ok, claims} <- Guardian.decode_and_verify(token, %{"typ" => "mfa"}),
         {:ok, user} <- Guardian.resource_from_claims(claims) do
      {:ok, user}
    else
      _ -> {:error, :invalid_mfa_token}
    end
  end

  defp decode_secret(nil), do: {:error, :mfa_not_configured}

  defp decode_secret(encoded) when is_binary(encoded) do
    case Base.decode32(encoded, padding: false) do
      {:ok, secret} ->
        {:ok, secret}

      :error ->
        case Base.decode32(encoded, padding: true) do
          {:ok, secret} -> {:ok, secret}
          :error -> {:error, :invalid_secret}
        end
    end
  end

  defp random_token do
    :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)
  end

  defp hash_token(token), do: :crypto.hash(:sha256, token) |> Base.encode16(case: :lower)
end
