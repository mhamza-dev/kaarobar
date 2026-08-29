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
end
