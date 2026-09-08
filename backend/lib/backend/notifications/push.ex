defmodule Kaarobar.Notifications.Push do
  @moduledoc """
  What a mobile push provider has to be able to do.

  `mobile/staff` is an Expo app, so `Kaarobar.Notifications.Push.Expo` is the
  adapter that actually ships — unlike SMS, this one vendor decision is
  already made by the client, not left open per deployment.
  """

  @typedoc "An Expo push token (`ExponentPushToken[...]`) or equivalent."
  @type token :: String.t()

  @doc """
  Sends a push notification.

  `title` and `body` are what renders in the OS notification tray; `data` is
  delivered to the app for it to act on (which screen to open, which record).
  """
  @callback send(token(), title :: String.t(), body :: String.t(), data :: map()) ::
              {:ok, term()} | {:error, term()}

  @doc "The configured adapter — `Kaarobar.Notifications.Push.Expo` unless set."
  @spec adapter() :: module()
  def adapter, do: Application.get_env(:backend, :push_adapter, Kaarobar.Notifications.Push.Expo)

  @doc "Sends through whichever adapter is configured."
  @spec send(token(), String.t(), String.t(), map()) :: {:ok, term()} | {:error, term()}
  def send(token, title, body, data \\ %{}), do: adapter().send(token, title, body, data)
end
