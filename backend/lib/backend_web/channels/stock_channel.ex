defmodule KaarobarWeb.StockChannel do
  @moduledoc """
  `stock:<branch id>` — that branch's stock movements as they post.

  Broadcast to by `Kaarobar.Inventory` on every `stock_moves` insert (a sale,
  a transfer, a count adjustment), so a stock screen updates live instead of
  polling `GET /stock`. Requires `inventory:view`.
  """

  use KaarobarWeb, :channel

  alias KaarobarWeb.ChannelAuth

  @impl true
  def join("stock:" <> branch_id, _payload, socket) do
    case ChannelAuth.for_branch(socket, branch_id, "inventory:view") do
      {:ok, scope} -> {:ok, assign(socket, :scope, scope)}
      {:error, :unauthorized} -> {:error, %{reason: "unauthorized"}}
    end
  end
end
