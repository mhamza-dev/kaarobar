defmodule KaarobarWeb.AuthController do
  @moduledoc """
  Registration, sign-in, sign-out and account recovery.

  Every action here is unauthenticated by definition, which makes them the
  attack surface of the whole API. Three rules run through all of them:

    * **Nothing enumerates accounts.** Sign-in and password reset give the same
      answer whether or not the address is registered.
    * **Everything is rate limited by address**, in the router pipeline.
    * **Everything is audited**, including failures — a burst of failed
      sign-ins is exactly what an owner needs to see.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Accounts
  alias Kaarobar.Audit
  alias Kaarobar.Tenancy
  alias KaarobarWeb.ClientLinks

  @doc """
  Registers an owner, their organization, and optionally a first business.

  Returns a bearer token, so signing up lands the owner on a working till
  rather than a sign-in form.
  """
  def register(conn, params) do
    case Tenancy.register_owner(params) do
      {:ok, result} ->
        {plaintext, _token} = issue_token(conn, result.user)

        Audit.log_anonymous("user.registered",
          entity_type: "user",
          entity_id: result.user.id,
          actor_label: result.user.name,
          summary: "Registered #{result.organization.name}",
          ip_address: conn.assigns[:remote_ip],
          request_id: conn.assigns[:request_id]
        )

        Accounts.deliver_confirmation_instructions(result.user, &ClientLinks.confirm_email/1)

        conn
        |> put_status(:created)
        |> render(:session, user: result.user, token: plaintext, result: result)

      {:error, _step, %Ecto.Changeset{} = changeset} ->
        {:error, changeset}
    end
  end

  @doc "Signs in with an email address and password."
  def login(conn, %{"email" => email, "password" => password}) do
    case Accounts.authenticate(email, password) do
      {:ok, user} ->
        {plaintext, _token} = issue_token(conn, user)

        Audit.log_anonymous("user.signed_in",
          entity_type: "user",
          entity_id: user.id,
          actor_label: user.name,
          ip_address: conn.assigns[:remote_ip],
          request_id: conn.assigns[:request_id]
        )

        render(conn, :session, user: user, token: plaintext)

      {:error, reason} ->
        Audit.log_anonymous("user.sign_in_failed",
          entity_type: "user",
          summary: "Failed sign-in for #{obscure(email)}: #{reason}",
          ip_address: conn.assigns[:remote_ip],
          request_id: conn.assigns[:request_id]
        )

        {:error, login_error(reason)}
    end
  end

  def login(_conn, _params), do: {:error, :invalid_credentials}

  # A locked or suspended account is only revealed to someone who already
  # proved they know the password, so these are safe to distinguish.
  defp login_error(:account_locked), do: :account_locked
  defp login_error(:account_suspended), do: :account_suspended
  defp login_error(_reason), do: :invalid_credentials

  @doc "Signs out the current device."
  def logout(conn, _params) do
    user = conn.assigns.current_user
    token = conn.assigns.current_token

    :ok = Accounts.revoke_bearer_token(user, token.id) |> normalize_revoke()

    send_resp(conn, :no_content, "")
  end

  @doc "Signs out every device."
  def logout_all(conn, _params) do
    user = conn.assigns.current_user
    :ok = Accounts.revoke_all_bearer_tokens(user)

    send_resp(conn, :no_content, "")
  end

  @doc """
  Starts a password reset.

  Always `202`, registered or not. Reporting "no such account" would turn this
  endpoint into an address checker.
  """
  def forgot_password(conn, %{"email" => email}) do
    :ok = Accounts.deliver_reset_password_instructions(email, &ClientLinks.reset_password/1)

    conn
    |> put_status(:accepted)
    |> json(%{data: %{message: "If that address has an account, a reset link is on its way."}})
  end

  def forgot_password(_conn, _params), do: {:error, :unprocessable_entity}

  @doc "Completes a password reset."
  def reset_password(conn, %{"token" => token} = params) do
    case Accounts.reset_password(token, Map.take(params, ["password", "password_confirmation"])) do
      {:ok, user} ->
        Audit.log_anonymous("user.password_reset",
          entity_type: "user",
          entity_id: user.id,
          actor_label: user.name,
          ip_address: conn.assigns[:remote_ip],
          request_id: conn.assigns[:request_id]
        )

        conn
        |> put_status(:ok)
        |> json(%{data: %{message: "Password updated. Sign in with your new password."}})

      {:error, :invalid_token} ->
        {:error, :invalid_token, "This reset link has expired or has already been used."}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def reset_password(_conn, _params), do: {:error, :unprocessable_entity}

  @doc "Confirms an email address."
  def confirm(conn, %{"token" => token}) do
    case Accounts.confirm_user(token) do
      {:ok, _user} ->
        json(conn, %{data: %{message: "Email address confirmed."}})

      {:error, :invalid_token} ->
        {:error, :invalid_token, "This confirmation link has expired or has already been used."}
    end
  end

  def confirm(_conn, _params), do: {:error, :unprocessable_entity}

  @doc "Resends the confirmation email for the signed-in user."
  def resend_confirmation(conn, _params) do
    case Accounts.deliver_confirmation_instructions(
           conn.assigns.current_user,
           &ClientLinks.confirm_email/1
         ) do
      :ok ->
        conn
        |> put_status(:accepted)
        |> json(%{data: %{message: "Confirmation email sent."}})

      {:error, :already_confirmed} ->
        json(conn, %{data: %{message: "This address is already confirmed."}})
    end
  end

  # --- Internal ---------------------------------------------------------------

  defp issue_token(conn, user) do
    Accounts.create_bearer_token(user,
      context: "api",
      device_name: device_name(conn),
      user_agent: user_agent(conn),
      ip_address: conn.assigns[:remote_ip]
    )
  end

  defp device_name(conn) do
    case get_req_header(conn, "x-device-name") do
      [name | _rest] -> String.slice(String.trim(name), 0, 120)
      [] -> nil
    end
  end

  defp user_agent(conn) do
    case get_req_header(conn, "user-agent") do
      [agent | _rest] -> agent
      [] -> nil
    end
  end

  defp normalize_revoke(:ok), do: :ok
  defp normalize_revoke({:error, :not_found}), do: :ok

  # Enough for an owner reading the audit trail to recognise the address,
  # not enough for the trail itself to become a list of customer emails.
  defp obscure(email) when is_binary(email) do
    case String.split(email, "@", parts: 2) do
      [local, domain] -> String.slice(local, 0, 2) <> "***@" <> domain
      _other -> "***"
    end
  end

  defp obscure(_email), do: "***"
end
