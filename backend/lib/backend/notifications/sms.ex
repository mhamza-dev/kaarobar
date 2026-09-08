defmodule Kaarobar.Notifications.SMS do
  @moduledoc """
  What an SMS or WhatsApp provider has to be able to do.

  One callback, because that is all a text message is — Kaarobar has no
  vendor relationship with any SMS/WhatsApp provider today (that is a
  per-market, sometimes per-country decision this codebase should not make on
  a business's behalf), so `Kaarobar.Notifications.SMS.Log` is the only
  adapter shipped. Adding a real one — Twilio, a regional aggregator, the
  WhatsApp Business API — means implementing this behaviour and pointing
  `config :backend, :sms_adapter` at it; nothing else in the codebase should
  need to change.
  """

  @typedoc "E.164 phone number the message goes to."
  @type recipient :: String.t()

  @doc "Sends a text message. `{:ok, provider_id}` on acceptance by the provider."
  @callback send(recipient(), body :: String.t()) :: {:ok, String.t()} | {:error, term()}

  @doc "The configured adapter — `Kaarobar.Notifications.SMS.Log` unless set."
  @spec adapter() :: module()
  def adapter, do: Application.get_env(:backend, :sms_adapter, Kaarobar.Notifications.SMS.Log)

  @doc "Sends through whichever adapter is configured."
  @spec send(recipient(), String.t()) :: {:ok, String.t()} | {:error, term()}
  def send(recipient, body), do: adapter().send(recipient, body)
end
