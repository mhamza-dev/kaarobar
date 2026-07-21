defmodule KaarobarWeb.V1.AuthController do
  use KaarobarWeb, :controller

  alias Kaarobar.{Accounts, Audit, Tenancy, Billing}

  def register(conn, params) do
    attrs = %{
      email: params["email"],
      password: params["password"],
      name: params["name"],
      phone: params["phone"]
    }

    with {:ok, user} <- Accounts.register(attrs),
         {:ok, _sub} <- Billing.ensure_subscription(user.id),
         :ok <- maybe_create_business(user, params["business_name"]),
         {:ok, token, _claims} <- Accounts.issue_access_token(user) do
      conn
      |> put_status(:created)
      |> json(%{
        access_token: token,
        token_type: "Bearer",
        mfa_required: user.mfa_required,
        mfa_enabled: Accounts.mfa_enabled?(user),
        user: serialize_user(user)
      })
    else
      {:error, %Ecto.Changeset{} = changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "validation_failed", details: translate_errors(changeset)})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: inspect(reason)})
    end
  end

  def login(conn, params) do
    email = params["email"]
    password = params["password"]
    totp_code = params["totp_code"]

    case Accounts.authenticate(email, password) do
      {:ok, user} ->
        cond do
          Accounts.mfa_enabled?(user) and is_binary(totp_code) and totp_code != "" ->
            case Accounts.verify_totp(user, totp_code) do
              :ok -> issue_login(conn, user)
              {:error, _} -> unauthorized(conn, "invalid_mfa_code")
            end

          Accounts.mfa_enabled?(user) ->
            {:ok, challenge, _} = Accounts.issue_mfa_challenge_token(user)

            conn
            |> put_status(:unauthorized)
            |> json(%{
              error: "mfa_required",
              mfa_token: challenge
            })

          user.mfa_required and not Accounts.mfa_enabled?(user) ->
            # Password OK but MFA enrollment still required (Owner/Accountant default)
            issue_login(conn, user, mfa_setup_required: true)

          true ->
            issue_login(conn, user)
        end

      {:error, :inactive} ->
        unauthorized(conn, "inactive")

      {:error, _} ->
        unauthorized(conn, "invalid_credentials")
    end
  end

  def verify_mfa(conn, %{"mfa_token" => mfa_token, "totp_code" => code}) do
    with {:ok, user} <- Accounts.user_from_mfa_token(mfa_token),
         :ok <- Accounts.verify_totp(user, code) do
      issue_login(conn, user)
    else
      {:error, :invalid_mfa_token} -> unauthorized(conn, "invalid_mfa_token")
      {:error, _} -> unauthorized(conn, "invalid_mfa_code")
    end
  end

  def me(conn, _params) do
    user = Guardian.Plug.current_resource(conn)

    json(conn, %{
      user: serialize_user(user),
      memberships:
        user.id
        |> Tenancy.list_memberships_for_user()
        |> Enum.map(&serialize_membership/1)
    })
  end

  def update_me(conn, params) do
    user = Guardian.Plug.current_resource(conn)

    attrs =
      %{}
      |> maybe_put(params, "name")
      |> maybe_put(params, "phone")
      |> maybe_put(params, "locale")
      |> maybe_put(params, "password")

    case Accounts.update_profile(user, attrs) do
      {:ok, updated} ->
        _ =
          Audit.log(%{
            owner_id: updated.id,
            user_id: updated.id,
            action: "user.profile_update",
            entity_type: "user",
            entity_id: updated.id,
            metadata: %{locale: updated.locale}
          })

        json(conn, %{user: serialize_user(updated)})

      {:error, %Ecto.Changeset{} = changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "validation_failed", details: translate_errors(changeset)})
    end
  end

  def mfa_setup(conn, _params) do
    user = Guardian.Plug.current_resource(conn)

    case Accounts.begin_mfa_setup(user) do
      {:ok, %{secret: secret, otpauth_uri: uri}} ->
        json(conn, %{data: %{secret: secret, otpauth_uri: uri}})
    end
  end

  def mfa_confirm(conn, %{"totp_code" => code}) do
    user = Guardian.Plug.current_resource(conn)

    case Accounts.confirm_mfa(user, code) do
      {:ok, updated} ->
        json(conn, %{data: serialize_user(updated)})

      {:error, :invalid_code} ->
        unauthorized(conn, "invalid_mfa_code")

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp issue_login(conn, user, opts \\ []) do
    {:ok, token, _claims} = Accounts.issue_access_token(user)
    memberships =
      user.id
      |> Tenancy.list_memberships_for_user()
      |> Enum.map(&serialize_membership/1)

    _ =
      Audit.log(%{
        owner_id: user.id,
        user_id: user.id,
        action: "user.login",
        entity_type: "user",
        entity_id: user.id,
        metadata: %{}
      })

    json(conn, %{
      access_token: token,
      token_type: "Bearer",
      mfa_required: user.mfa_required,
      mfa_enabled: Accounts.mfa_enabled?(user),
      mfa_setup_required: Keyword.get(opts, :mfa_setup_required, false),
      user: serialize_user(user),
      memberships: memberships
    })
  end

  defp unauthorized(conn, reason) do
    conn
    |> put_status(:unauthorized)
    |> json(%{error: reason})
  end

  defp serialize_user(user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      locale: user.locale || "en",
      mfa_required: user.mfa_required,
      mfa_enabled: Accounts.mfa_enabled?(user)
    }
  end

  defp maybe_put(map, params, key) do
    case Map.fetch(params, key) do
      {:ok, value} when value in [nil, ""] and key == "password" -> map
      {:ok, value} -> Map.put(map, key, value)
      :error -> map
    end
  end

  defp serialize_membership(m) do
    %{
      id: m.id,
      business_id: m.business_id,
      branch_id: m.branch_id,
      roles: m.roles,
      status: m.status,
      business_name: m.business && m.business.name,
      branch_name: m.branch && m.branch.name
    }
  end

  defp maybe_create_business(_user, nil), do: :ok
  defp maybe_create_business(_user, ""), do: :ok

  defp maybe_create_business(user, business_name) do
    case Tenancy.create_business(user.id, %{name: business_name, tax_jurisdiction: "PK"}) do
      {:ok, business} ->
        case Tenancy.create_branch(business.id, user, %{
               name: "Main Branch",
               timezone: "Asia/Karachi"
             }) do
          {:ok, _} -> :ok
          {:error, reason} -> {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp translate_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
