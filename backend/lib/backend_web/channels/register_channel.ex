defmodule KaarobarWeb.RegisterChannel do
  @moduledoc """
  `register:<id>` — one till's shift state.

  Broadcast to by `Kaarobar.Registers` on shift open/close and every cash
  movement, so a manager watching a register does not have to poll
  `GET /registers/:id/shift`. Requires `register:view`.
  """

  use KaarobarWeb, :channel

  alias Kaarobar.Registers.Register
  alias Kaarobar.Repo
  alias KaarobarWeb.ChannelAuth

  @impl true
  def join("register:" <> register_id, _payload, socket) do
    # `registers` is RLS-protected and there is no tenant context yet — this
    # is the same "which tenant does this id even belong to" lookup
    # `KaarobarWeb.ChannelAuth.for_branch/3` does against `branches` (which
    # RLS leaves unprotected instead); a register has no such exemption, so
    # this one read runs as `backend_system` purely to learn the business id,
    # before the real, permission-checked scope below is what actually
    # authorizes the join.
    with true <- Kaarobar.Ecto.UUIDv7.valid?(register_id),
         %Register{business_id: business_id} <-
           Repo.as_system(fn -> Repo.get(Register, register_id) end),
         {:ok, scope} <- ChannelAuth.for_business(socket, business_id, "register:view") do
      {:ok, assign(socket, :scope, scope)}
    else
      _other -> {:error, %{reason: "unauthorized"}}
    end
  end
end
