defmodule KaarobarWeb.KitchenChannel do
  @moduledoc """
  `kds:<branch id>` — the kitchen display board.

  Broadcast to by `Kaarobar.Kitchen` whenever a ticket is fired, started,
  bumped or recalled, so every screen in the kitchen updates without polling
  `GET /kitchen/board`. Requires `kitchen:view`.
  """

  use KaarobarWeb, :channel

  alias KaarobarWeb.ChannelAuth

  @impl true
  def join("kds:" <> branch_id, _payload, socket) do
    case ChannelAuth.for_branch(socket, branch_id, "kitchen:view") do
      {:ok, scope} -> {:ok, assign(socket, :scope, scope)}
      {:error, :unauthorized} -> {:error, %{reason: "unauthorized"}}
    end
  end
end
