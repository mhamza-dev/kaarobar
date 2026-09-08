defmodule Kaarobar.Notifications.SMS.Log do
  @moduledoc """
  The default SMS/WhatsApp adapter: writes to the log and nowhere else.

  What `Kaarobar.Payments.Adapters.Manual` is to payments — not a placeholder
  so much as the correct behaviour for a deployment that has not (or does not
  intend to) contract an SMS provider. A laundry sending "your order is ready"
  by text is a feature the vertical wants; this is what makes it safe to
  implement `Kaarobar.Notifications.SMS.send/2` calls throughout the codebase
  before any tenant has actually turned a real provider on.
  """

  @behaviour Kaarobar.Notifications.SMS

  require Logger

  @impl true
  def send(recipient, body) do
    Logger.info("SMS to #{recipient}: #{body}")
    {:ok, "log-#{System.unique_integer([:positive])}"}
  end
end
