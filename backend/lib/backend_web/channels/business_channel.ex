defmodule KaarobarWeb.BusinessChannel do
  @moduledoc """
  `business:<id>` — the live sales feed, and who is currently online.

  Broadcast to by `Kaarobar.Sales.Checkout` on every completed sale, void and
  refund. Requires `sale:view_all`: the same permission that lets a manager
  see every sale in the branch through the REST API, not just their own.
  """

  use KaarobarWeb, :channel

  alias KaarobarWeb.ChannelAuth
  alias KaarobarWeb.Presence

  @impl true
  def join("business:" <> business_id, _payload, socket) do
    case ChannelAuth.for_business(socket, business_id, "sale:view_all") do
      {:ok, scope} ->
        socket =
          socket
          |> assign(:scope, scope)
          |> assign(:business_id, business_id)

        send(self(), :after_join)
        {:ok, socket}

      {:error, :unauthorized} ->
        {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_info(:after_join, socket) do
    {:ok, _ref} =
      Presence.track(socket, socket.assigns.scope |> Kaarobar.Scope.user_id(), %{
        name: socket.assigns.scope.user.name,
        online_at: System.system_time(:second)
      })

    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end
end
