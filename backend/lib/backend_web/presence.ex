defmodule KaarobarWeb.Presence do
  @moduledoc """
  Staff online status, tracked per business.

  `KaarobarWeb.BusinessChannel` tracks each joining member under their user
  id; `list/1` is what a dashboard reads to show who is currently on shift
  versus who the roster merely says is staff.
  """

  use Phoenix.Presence,
    otp_app: :backend,
    pubsub_server: Kaarobar.PubSub
end
