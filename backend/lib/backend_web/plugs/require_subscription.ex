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

  The exemption is by **controller module**, not by path. A path list stops
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
    KaarobarWeb.BillingController,
    KaarobarWeb.OrganizationController,
    KaarobarWeb.MeController
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

  # The router puts the matched controller in `private` before running the
  # pipeline, so this is known by the time the plug is reached.
  defp exempt?(conn, opts) do
    conn.private[:phoenix_controller] in Keyword.fetch!(opts, :exempt)
  end

  defp reject(conn) do
    {status, body} = ErrorEnvelope.for_reason(:subscription_expired)

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(Plug.Conn.Status.code(status), Jason.encode_to_iodata!(body))
    |> halt()
  end
end
