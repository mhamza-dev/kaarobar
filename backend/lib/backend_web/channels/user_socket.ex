defmodule KaarobarWeb.UserSocket do
  @moduledoc """
  The realtime entry point for POS clients.

  Channels are added by the phases that own them — live sales feeds, the
  kitchen display, register state, stock movement. Authentication happens once
  here, at connect, using the same bearer token as the REST API, so a socket
  can never outlive the token that opened it.

  Until authentication lands in the identity phase, every connect is refused:
  an open socket that trusts its params would be a hole, not a placeholder.
  """

  use Phoenix.Socket

  # channel "business:*", KaarobarWeb.BusinessChannel
  # channel "kds:*", KaarobarWeb.KitchenChannel
  # channel "register:*", KaarobarWeb.RegisterChannel
  # channel "stock:*", KaarobarWeb.StockChannel

  @impl Phoenix.Socket
  def connect(_params, _socket, _connect_info), do: :error

  @impl Phoenix.Socket
  def id(_socket), do: nil
end
