defmodule Kaarobar.Accounts do
  @moduledoc """
  Identity & MFA (TEN-FR-006).
  """

  alias Kaarobar.{Audit, Guardian, Repo}
  alias Kaarobar.Schemas.User

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

  def issue_access_token(%User{} = user) do
    Guardian.encode_and_sign(user, %{}, token_type: "access", ttl: {15, :minute})
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
end
