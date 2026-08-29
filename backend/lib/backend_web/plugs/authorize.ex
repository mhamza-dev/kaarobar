defmodule KaarobarWeb.Plugs.Authorize do
  @moduledoc """
  Declarative permission and entitlement checks on a route or controller.

      plug KaarobarWeb.Plugs.Authorize, permission: "products:write" when action in [:create, :update]
      plug KaarobarWeb.Plugs.Authorize, entitlement: "purchase_orders"

  ## Options

    * `:permission` — an RBAC key the caller must hold, e.g. `"sales:refund_approve"`
    * `:entitlement` — a feature the organization's plan must include
    * `:module` — a vertical module the business type must enable, e.g. `"tables"`

  Checking here rather than inside each action means an endpoint cannot ship
  unprotected by omission: the route either declares its requirement or is
  deliberately public in the router.

  The three checks answer different questions and therefore fail differently.
  A missing *permission* is `403 forbidden` — this user may not do it. A missing
  *entitlement* is `402 payment_required` — this plan does not include it, and
  upgrading would. A disabled *module* is `403 module_disabled` — a hair salon
  has no dining tables, and no amount of money changes that.
  """

  @behaviour Plug

  import Plug.Conn

  alias Kaarobar.Scope
  alias Kaarobar.Verticals
  alias KaarobarWeb.ErrorEnvelope

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, opts) do
    scope = conn.assigns[:scope]

    with :ok <- check_scope(scope),
         :ok <- check_permission(scope, Keyword.get(opts, :permission)),
         :ok <- check_entitlement(scope, Keyword.get(opts, :entitlement)),
         :ok <- check_module(scope, Keyword.get(opts, :module)) do
      conn
    else
      {:error, reason} -> reject(conn, reason)
    end
  end

  defp check_scope(%Scope{user: user}) when not is_nil(user), do: :ok
  defp check_scope(_other), do: {:error, :unauthorized}

  defp check_permission(_scope, nil), do: :ok
  defp check_permission(scope, permission), do: Scope.authorize(scope, permission)

  defp check_entitlement(_scope, nil), do: :ok
  defp check_entitlement(scope, feature), do: Scope.require_entitlement(scope, feature)

  defp check_module(_scope, nil), do: :ok

  defp check_module(scope, module) do
    if Verticals.module_enabled?(scope.business, module) do
      :ok
    else
      {:error, :module_disabled}
    end
  end

  defp reject(conn, reason) do
    {status, body} = ErrorEnvelope.for_reason(reason)

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(Plug.Conn.Status.code(status), Jason.encode_to_iodata!(body))
    |> halt()
  end
end
