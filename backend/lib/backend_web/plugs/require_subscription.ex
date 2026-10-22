defmodule KaarobarWeb.Plugs.RequireSubscription do
  @moduledoc """
  Stops an organization whose subscription has actually lapsed.

  Not on a failed payment — `Kaarobar.Billing.Subscription` keeps a `past_due`
  organization working until its grace runs out, and only a scheduled job ever
  moves one to `expired`. By the time this plug says no, the invoice has been
  unpaid for a fortnight and somebody has been told about it four times.

  ## What stays reachable

  Billing, and the screens that let somebody see who they are and get their own
  data out. An organization that cannot reach its own billing screen cannot
  give us money, and one that cannot export its own records has been locked out
  of its property rather than its subscription.

  The exemption is by **controller module** (or a controller and some of its
  actions), not by path. A path list stops
  covering a route the day somebody renames it, and does so silently; a
  controller that no longer exists fails to compile.

  ## Where it goes

  In the authenticated pipeline, after `LoadScope`. One check for the whole API
  rather than an annotation on two hundred routes — an annotation every new
  route would have to remember, and the first one that forgot would be a free
  tier nobody meant to offer.
  """

  @behaviour Plug

  import Plug.Conn

  alias Kaarobar.Scope
  alias KaarobarWeb.ErrorEnvelope

  # Reachable even when the subscription has lapsed.
  @exempt [
    # Signing out, signing out everywhere, resending a confirmation email.
    KaarobarWeb.AuthController,
    KaarobarWeb.BillingController,
    KaarobarWeb.OrganizationController,
    KaarobarWeb.MeController,
    # Reading its own businesses — which every client needs to settle on
    # one before it can show anything, the billing screen included. Only
    # these actions: creating or changing a business stays closed.
    {KaarobarWeb.BusinessController, [:index, :show]}
  ]

  @impl Plug
  def init(opts), do: Keyword.put_new(opts, :exempt, @exempt)

  @impl Plug
  def call(%Plug.Conn{assigns: %{scope: scope}} = conn, opts) do
    if Scope.serviceable?(scope) or exempt?(conn, opts) do
      conn
    else
      reject(conn)
    end
  end

  # No scope means no tenant was selected — `/me`, listing the organizations a
  # user belongs to, accepting an invitation. There is nothing here to gate.
  def call(conn, _opts), do: conn

  # Which controller the route goes to, asked of the router. Not
  # `conn.private[:phoenix_controller]`: Phoenix only sets that when the
  # controller itself runs, which is after this pipeline — reading it here
  # found nothing, so nothing was ever exempt and a lapsed organization could
  # not reach the billing screen to pay.
  defp exempt?(conn, opts) do
    router = conn.private[:phoenix_router] || KaarobarWeb.Router

    case Phoenix.Router.route_info(router, conn.method, conn.path_info, conn.host) do
      %{plug: controller, plug_opts: action} ->
        Enum.any?(Keyword.fetch!(opts, :exempt), fn
          {^controller, actions} -> action in actions
          exempt -> exempt == controller
        end)

      :error ->
        false
    end
  end

  defp reject(conn) do
    {status, body} = ErrorEnvelope.for_reason(:subscription_expired)

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(Plug.Conn.Status.code(status), Jason.encode_to_iodata!(body))
    |> halt()
  end
end
