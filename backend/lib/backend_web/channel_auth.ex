defmodule KaarobarWeb.ChannelAuth do
  @moduledoc """
  Resolves a channel topic's tenant and checks the permission it needs.

  Shared by every channel in `KaarobarWeb.UserSocket` rather than duplicated
  in each, so `business:*`, `kds:*`, `register:*` and `stock:*` all deny a
  join the same way `KaarobarWeb.Plugs.Authorize` denies an HTTP request: a
  membership the caller does not hold, or a permission it does not carry,
  produce the same `{:error, %{reason: "unauthorized"}}` a client cannot use
  to tell "no such business" from "not yours".
  """

  alias Kaarobar.Repo
  alias Kaarobar.Scope
  alias Kaarobar.Scopes
  alias Kaarobar.Tenancy.Branch

  @doc "Builds a scope for the business named in a `business:<id>` topic."
  @spec for_business(Phoenix.Socket.t(), String.t(), String.t()) ::
          {:ok, Scope.t()} | {:error, :unauthorized}
  def for_business(socket, business_id, permission) do
    socket.assigns.current_user
    |> Scopes.build(%{business_id: business_id})
    |> authorize(permission)
  end

  @doc """
  Builds a scope for the branch named in a `kds:<id>` / `stock:<id>` topic.

  `branches` carries no membership of its own to join through — a branch
  belongs to a business the same way a business belongs to an organization —
  so this reads the branch first (unauthenticated: `branches` is one of the
  tables RLS leaves unprotected for exactly this kind of lookup, see
  `priv/repo/migrations/20260909000000_enable_row_level_security.exs`) purely
  to learn which business to build a real scope against, then checks the
  membership covers that specific branch.
  """
  @spec for_branch(Phoenix.Socket.t(), String.t(), String.t()) ::
          {:ok, Scope.t()} | {:error, :unauthorized}
  def for_branch(socket, branch_id, permission) do
    with true <- Kaarobar.Ecto.UUIDv7.valid?(branch_id),
         %Branch{business_id: business_id} <- Repo.get(Branch, branch_id),
         {:ok, scope} <- for_business(socket, business_id, permission),
         true <- Scope.covers_branch?(scope, branch_id) do
      {:ok, scope}
    else
      _other -> {:error, :unauthorized}
    end
  end

  defp authorize({:ok, scope}, permission) do
    if Scope.can?(scope, permission), do: {:ok, scope}, else: {:error, :unauthorized}
  end

  defp authorize({:error, :not_found}, _permission), do: {:error, :unauthorized}
end
