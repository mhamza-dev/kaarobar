defmodule KaarobarWeb.UserSocket do
  @moduledoc """
  The realtime entry point for POS clients.

  Authenticated the same way the REST API is: the client connects with
  `?token=<bearer token>` in the socket params, and `connect/3` resolves it
  through the same `Kaarobar.Accounts.fetch_user_by_bearer_token/1` that
  `KaarobarWeb.Plugs.RequireAuth` uses, so a socket can never outlive the
  token that opened it or trust a caller a device revoke has already cut off.

  Each channel resolves its own tenant and permission on join — see
  `KaarobarWeb.ChannelAuth` — because the socket itself is not scoped to one
  business: a manager watching two branches' kitchen displays at once opens
  one socket and two channel joins, not two sockets.
  """

  use Phoenix.Socket

  channel "business:*", KaarobarWeb.BusinessChannel
  channel "kds:*", KaarobarWeb.KitchenChannel
  channel "register:*", KaarobarWeb.RegisterChannel
  channel "stock:*", KaarobarWeb.StockChannel

  alias Kaarobar.Accounts

  @impl Phoenix.Socket
  def connect(%{"token" => token}, socket, _connect_info) when is_binary(token) do
    with {:ok, user, _token} <- Accounts.fetch_user_by_bearer_token(token) do
      {:ok, assign(socket, :current_user, user)}
    else
      _other -> :error
    end
  end

  def connect(_params, _socket, _connect_info), do: :error

  # One id per user, not per business: `KaarobarWeb.Endpoint.broadcast/3`
  # against `"user_socket:#{user_id}"` is how a forced sign-out (device
  # revoke, password change) disconnects every channel this user has open in
  # one call, regardless of which businesses they were watching.
  @impl Phoenix.Socket
  def id(socket), do: "user_socket:#{socket.assigns.current_user.id}"
end
