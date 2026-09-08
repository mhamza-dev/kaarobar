defmodule KaarobarWeb.MeController do
  @moduledoc """
  The signed-in user's own account and context.

  `show/2` is the endpoint every client calls on start-up. It returns the whole
  scope — identity, tenant, roles, permissions — because the client builds its
  navigation from it, and a client that has to ask for permissions separately
  will render a menu it then has to take away.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Accounts
  alias Kaarobar.Audit
  alias Kaarobar.Tenancy

  @doc "The caller's identity, tenant, roles and permissions."
  def show(conn, _params) do
    render(conn, :show,
      scope: conn.assigns.scope,
      organizations: Tenancy.list_organizations_for_user(conn.assigns.current_user)
    )
  end

  @doc "Updates the caller's own profile."
  def update(conn, params) do
    with {:ok, user} <- Accounts.update_profile(conn.assigns.current_user, params) do
      Audit.log(conn.assigns.scope, "user.profile_updated", user, entity_type: "user")
      render(conn, :profile, user: user)
    end
  end

  @doc "Changes the caller's password, after confirming the current one."
  def update_password(conn, %{"current_password" => current} = params) do
    with {:ok, user} <-
           Accounts.update_password(
             conn.assigns.current_user,
             current,
             Map.take(params, ["password", "password_confirmation"])
           ) do
      Audit.log(conn.assigns.scope, "user.password_changed", user, entity_type: "user")

      conn
      |> put_status(:ok)
      |> json(%{
        data: %{
          message: "Password updated. You have been signed out on all other devices."
        }
      })
    end
  end

  def update_password(_conn, _params), do: {:error, :unprocessable_entity}

  @doc "Changes the caller's email address, after confirming their password."
  def update_email(conn, %{"current_password" => current} = params) do
    with {:ok, user} <-
           Accounts.update_email(conn.assigns.current_user, current, Map.take(params, ["email"])) do
      Audit.log(conn.assigns.scope, "user.email_changed", user, entity_type: "user")
      render(conn, :profile, user: user)
    end
  end

  def update_email(_conn, _params), do: {:error, :unprocessable_entity}

  @doc "Lists the devices signed in as the caller."
  def devices(conn, _params) do
    render(conn, :devices,
      devices: Accounts.list_bearer_tokens(conn.assigns.current_user),
      current_token_id: conn.assigns.current_token.id
    )
  end

  @doc "Signs one device out."
  def revoke_device(conn, %{"id" => id}) do
    with :ok <- Accounts.revoke_bearer_token(conn.assigns.current_user, id) do
      send_resp(conn, :no_content, "")
    end
  end

  @doc """
  Starts TOTP enrollment: a fresh secret and the QR code URI to scan it from.

  Not yet enforced on sign-in — `confirm_mfa/2` is what turns it on, once the
  app proves it can produce a matching code.
  """
  def enroll_mfa(conn, _params) do
    {:ok, _user, provisioning_uri} = Accounts.start_totp_enrollment(conn.assigns.current_user)
    render(conn, :mfa_enrollment, provisioning_uri: provisioning_uri)
  end

  @doc "Confirms enrollment with a code from the app, turning MFA on."
  def confirm_mfa(conn, %{"code" => code}) do
    with {:ok, user} <- Accounts.confirm_totp_enrollment(conn.assigns.current_user, code) do
      Audit.log(conn.assigns.scope, "user.mfa_enabled", user, entity_type: "user")
      render(conn, :profile, user: user)
    end
  end

  def confirm_mfa(_conn, _params), do: {:error, :bad_request}

  @doc "Turns MFA off, after confirming the password."
  def disable_mfa(conn, %{"current_password" => password}) do
    with {:ok, user} <- Accounts.disable_totp(conn.assigns.current_user, password) do
      Audit.log(conn.assigns.scope, "user.mfa_disabled", user, entity_type: "user")
      render(conn, :profile, user: user)
    end
  end

  def disable_mfa(_conn, _params), do: {:error, :bad_request}

  @doc "A GDPR export of everything held about the caller personally."
  def export(conn, _params) do
    Audit.log(conn.assigns.scope, "user.data_exported", conn.assigns.current_user,
      entity_type: "user"
    )

    render(conn, :export, export: Accounts.export_personal_data(conn.assigns.current_user))
  end

  @doc """
  Erases the caller's own personal data, after confirming their password.

  Scrubs the account rather than removing the row — see
  `Kaarobar.Accounts.erase_personal_data/2` for why — and signs every device
  out, since the password that would be needed to sign back in no longer
  exists.
  """
  def erase(conn, %{"current_password" => password}) do
    with {:ok, user} <- Accounts.erase_personal_data(conn.assigns.current_user, password) do
      Audit.log(conn.assigns.scope, "user.data_erased", user, entity_type: "user")

      conn
      |> put_status(:ok)
      |> json(%{data: %{message: "Your account and personal data have been erased."}})
    end
  end

  def erase(_conn, _params), do: {:error, :bad_request}
end
