defmodule KaarobarWeb.ClientLinks do
  @moduledoc """
  Builds the links that go into emails.

  They point at the client application, not at this API. Every one of these
  flows ends in a form — choose a password, accept an invitation — and this is
  a JSON API with no pages to render. The base URL comes from `FRONTEND_URL`.

  Tokens are placed in the path rather than the query string. Query strings are
  more likely to end up in browser history, proxy logs and `Referer` headers,
  and these tokens are as good as a password until they are used.
  """

  @doc "Where a user goes to choose a new password."
  @spec reset_password(String.t()) :: String.t()
  def reset_password(token), do: build(["reset-password", token])

  @doc "Where a user goes to confirm their email address."
  @spec confirm_email(String.t()) :: String.t()
  def confirm_email(token), do: build(["confirm-email", token])

  @doc "Where an invited person goes to accept and set up their account."
  @spec accept_invitation(String.t()) :: String.t()
  def accept_invitation(token), do: build(["invitations", token])

  @doc """
  The web app's billing screen, where Stripe sends a customer back.

  `{CHECKOUT_SESSION_ID}` is left unencoded on purpose: it is Stripe's
  placeholder, replaced with the session id on the way back.
  """
  @spec billing(String.t() | nil) :: String.t()
  def billing(outcome \\ nil)
  def billing(nil), do: base_url() <> "/settings/billing"

  def billing("success"),
    do: base_url() <> "/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}"

  def billing(outcome) when is_binary(outcome),
    do: base_url() <> "/settings/billing?" <> URI.encode_query(%{"checkout" => outcome})

  defp build(segments) do
    base = base_url()

    encoded =
      Enum.map_join(segments, "/", fn segment ->
        URI.encode(segment, &URI.char_unreserved?/1)
      end)

    base <> "/" <> encoded
  end

  defp base_url do
    :backend
    |> Application.get_env(:frontend_url, "http://localhost:3000")
    |> String.trim_trailing("/")
  end
end
