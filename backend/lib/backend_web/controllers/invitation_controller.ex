defmodule KaarobarWeb.InvitationController do
  @moduledoc """
  Inviting staff, and accepting an invitation.

  `preview/2` and `accept/2` are unauthenticated — the invitee has no account
  yet, which is the whole reason invitations exist. They are protected by the
  token instead: 32 random bytes, stored hashed, single use, and valid for
  fourteen days.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Accounts
  alias Kaarobar.Audit
  alias Kaarobar.Staffing
  alias KaarobarWeb.ClientLinks

  plug KaarobarWeb.Plugs.Authorize, [permission: "staff:view"] when action in [:index]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "staff:invite"] when action in [:create, :delete]

  @doc "Lists outstanding invitations."
  def index(conn, _params) do
    render(conn, :index, invitations: Staffing.list_invitations(conn.assigns.scope))
  end

  @doc "Invites someone to join as staff."
  def create(conn, params) do
    scope = conn.assigns.scope

    with {:ok, invitation} <- Staffing.invite(scope, params, &ClientLinks.accept_invitation/1) do
      Audit.log(scope, "invitation.sent", invitation,
        entity_type: "invitation",
        label: invitation.email,
        summary: "Invited #{invitation.email}"
      )

      conn
      |> put_status(:created)
      |> render(:show, invitation: invitation)
    end
  end

  @doc "Withdraws an invitation."
  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, invitation} <- Staffing.revoke_invitation(scope, id) do
      Audit.log(scope, "invitation.revoked", invitation,
        entity_type: "invitation",
        label: invitation.email
      )

      send_resp(conn, :no_content, "")
    end
  end

  @doc """
  Shows what an invitation is for, so the acceptance screen can be rendered.

  Returns only what the invitee needs in order to decide — which organization,
  which business, which role, and whether they must choose a password. Nothing
  about other staff, and nothing that would make a guessed token useful.
  """
  def preview(conn, %{"token" => token}) do
    with {:ok, preview} <- Staffing.preview_invitation(token) do
      json(conn, %{data: preview})
    end
  end

  @doc """
  Accepts an invitation.

  Creates the account if there is not one already, joins the organization, and
  returns a bearer token — the invitee is signed in and working, rather than
  bounced to a sign-in form they would have to complete separately.
  """
  def accept(conn, %{"token" => token} = params) do
    with {:ok, %{user: user, membership: membership}} <-
           Staffing.accept_invitation(token, Map.get(params, "user", %{})) do
      {plaintext, _token} =
        Accounts.create_bearer_token(user,
          context: "api",
          user_agent: user_agent(conn),
          ip_address: conn.assigns[:remote_ip]
        )

      Audit.log_anonymous("invitation.accepted",
        entity_type: "membership",
        entity_id: membership.id,
        actor_label: user.name,
        summary: "#{user.email} joined",
        ip_address: conn.assigns[:remote_ip],
        request_id: conn.assigns[:request_id]
      )

      conn
      |> put_status(:created)
      |> put_view(json: KaarobarWeb.AuthJSON)
      |> render(:session, user: user, token: plaintext)
    end
  end

  def accept(_conn, _params), do: {:error, :unprocessable_entity}

  defp user_agent(conn) do
    case get_req_header(conn, "user-agent") do
      [agent | _rest] -> agent
      [] -> nil
    end
  end
end
