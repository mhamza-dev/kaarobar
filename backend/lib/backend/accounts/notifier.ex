defmodule Kaarobar.Accounts.Notifier do
  @moduledoc """
  Account emails: confirmation, password reset, staff invitations.

  Plain text on purpose. These messages carry a link and nothing else, they are
  read on cheap phones on slow connections, and HTML mail is the fastest way to
  land in a spam folder. Marketing email is a different problem with different
  tooling.

  In development everything lands in `/dev/mailbox`; in test, Swoosh's test
  adapter captures messages so specs can assert on them.
  """

  import Swoosh.Email

  alias Kaarobar.Accounts.User
  alias Kaarobar.Mailer

  @doc "Confirms a newly registered address."
  def deliver_confirmation_instructions(%User{} = user, url) do
    deliver(user.email, user.name, "Confirm your Kaarobar account", """
    Hi #{user.name},

    Confirm your email address to finish setting up your Kaarobar account:

    #{url}

    This link is valid for 7 days.

    If you did not create an account, you can ignore this message.
    """)
  end

  @doc "Sends a password reset link."
  def deliver_reset_password_instructions(%User{} = user, url) do
    deliver(user.email, user.name, "Reset your Kaarobar password", """
    Hi #{user.name},

    You can reset your Kaarobar password here:

    #{url}

    This link is valid for 60 minutes and can be used once.

    If you did not ask to reset your password, ignore this message — your
    current password still works and nothing has changed.
    """)
  end

  @doc "Invites someone to join an organization as staff."
  def deliver_invitation(email, name, organization_name, inviter_name, url, message) do
    greeting = if name, do: "Hi #{name},", else: "Hello,"

    note =
      if message && String.trim(message) != "" do
        "\n#{inviter_name} added a note:\n\n  #{message}\n"
      else
        ""
      end

    deliver(email, name, "#{inviter_name} invited you to #{organization_name} on Kaarobar", """
    #{greeting}

    #{inviter_name} has invited you to join #{organization_name} on Kaarobar.
    #{note}
    Accept the invitation here:

    #{url}

    This invitation is valid for 14 days.
    """)
  end

  @doc "Tells a user their password was changed, so an unexpected change is noticed."
  def deliver_password_changed_notice(%User{} = user) do
    deliver(user.email, user.name, "Your Kaarobar password was changed", """
    Hi #{user.name},

    The password on your Kaarobar account was just changed, and every other
    signed-in device has been signed out.

    If this was not you, reset your password immediately and contact the owner
    of your organization.
    """)
  end

  defp deliver(recipient_email, recipient_name, subject, body) do
    email =
      new()
      |> to({recipient_name || recipient_email, recipient_email})
      |> from({sender_name(), sender_address()})
      |> subject(subject)
      |> text_body(body)

    with {:ok, _metadata} <- Mailer.deliver(email) do
      {:ok, email}
    end
  end

  defp sender_name, do: Application.get_env(:backend, :mail_from_name, "Kaarobar")

  defp sender_address,
    do: Application.get_env(:backend, :mail_from_address, "no-reply@kaarobar.app")
end
