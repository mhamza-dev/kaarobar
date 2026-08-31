defmodule KaarobarWeb.PaymentController do
  @moduledoc """
  Taking money through a gateway, and hearing back about it.

  ## The webhook endpoint is deliberately unauthenticated

  A gateway has no bearer token and never will. Its callback is authenticated
  by a signature over the raw body instead, which is why `webhook/2` reads
  `conn.assigns.raw_body` rather than the parsed params: re-encoding JSON
  changes the bytes, and a signature computed over different bytes never
  matches.

  It answers 200 to anything it managed to store, including events it decided
  not to act on. A gateway reads a non-200 as "try again", so returning an
  error for an event we deliberately ignored earns an escalating retry storm
  for something that was never a problem.

  ## Credentials never come back out

  The provider serialiser omits them entirely. There is no read path for a
  secret key — a shop that has lost one replaces it rather than reading it,
  which is also what its gateway would tell them to do.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Payments

  require Logger

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "payment:configure"]
       when action in [:providers, :configure, :update_provider, :delete_provider]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "payment:charge"] when action in [:charge, :capture, :sync]

  plug KaarobarWeb.Plugs.Authorize, [permission: "payment:refund"] when action in [:refund]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "payment:view"] when action in [:index, :show, :settlements]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "payment:reconcile"] when action in [:reconcile]

  # --- Providers --------------------------------------------------------------

  def providers(conn, _params) do
    render(conn, :providers, providers: Payments.list_providers(conn.assigns.scope))
  end

  def configure(conn, params) do
    with {:ok, provider} <- Payments.configure_provider(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:provider, provider: provider)
    end
  end

  def update_provider(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, provider} <- Payments.fetch_provider(scope, id),
         {:ok, updated} <- Payments.update_provider(scope, provider, params) do
      render(conn, :provider, provider: updated)
    end
  end

  def delete_provider(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, provider} <- Payments.fetch_provider(scope, id),
         {:ok, deleted} <- Payments.delete_provider(scope, provider) do
      render(conn, :provider, provider: deleted)
    end
  end

  # --- Payments ---------------------------------------------------------------

  def index(conn, params) do
    opts = if params["status"], do: [status: params["status"]], else: []
    render(conn, :intents, intents: Payments.list_intents(conn.assigns.scope, opts))
  end

  def show(conn, %{"id" => id}) do
    with {:ok, intent} <- Payments.fetch_intent(conn.assigns.scope, id) do
      render(conn, :intent, intent: intent)
    end
  end

  @doc """
  Asks for money.

  Comes back `processing` or `requires_action` with wherever the customer has
  to go next. It is not a payment until a webhook says so.
  """
  def charge(conn, params) do
    with {:ok, intent} <- Payments.charge(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:intent, intent: intent)
    end
  end

  def capture(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, intent} <- Payments.fetch_intent(scope, id),
         {:ok, captured} <- Payments.capture(scope, intent, parse_money(params["amount"])) do
      render(conn, :intent, intent: captured)
    end
  end

  def refund(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, intent} <- Payments.fetch_intent(scope, id),
         {:ok, amount} <- require_money(params["amount"]),
         {:ok, refunded} <- Payments.refund(scope, intent, amount) do
      render(conn, :intent, intent: refunded)
    end
  end

  @doc "Asks the gateway directly, for when a callback never came."
  def sync(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, intent} <- Payments.fetch_intent(scope, id),
         {:ok, synced} <- Payments.sync(scope, intent) do
      render(conn, :intent, intent: synced)
    end
  end

  # --- Settlements ------------------------------------------------------------

  def settlements(conn, _params) do
    render(conn, :settlements, settlements: Payments.list_settlements(conn.assigns.scope))
  end

  def reconcile(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, settlement} <- fetch_settlement(scope, id),
         {:ok, reconciled} <- Payments.reconcile(scope, settlement, params["notes"]) do
      render(conn, :settlement, settlement: reconciled)
    end
  end

  # --- The callback -----------------------------------------------------------

  @doc """
  Takes a gateway's callback.

  Unauthenticated by necessity and signed instead. Reads the raw body, because
  the signature covers the bytes the gateway sent and re-encoding the parsed
  JSON produces different ones.

  Answers 200 for anything stored — including events deliberately ignored —
  because a gateway reads any other status as "send it again", and an
  escalating retry storm for a non-problem helps nobody.
  """
  def webhook(conn, %{"provider" => provider}) do
    raw_body = conn.assigns[:raw_body] || ""
    headers = Map.new(conn.req_headers)

    case Payments.handle_webhook(provider, raw_body, headers) do
      {:ok, event} ->
        json(conn, %{received: true, status: event.status})

      {:error, {:signature_rejected, reason}} ->
        # A forged or misconfigured callback. 400 rather than 200: this one
        # genuinely should not be retried, and the gateway's dashboard showing
        # a failure is how the shop finds out its secret is wrong.
        Logger.warning("rejected #{provider} webhook: #{inspect(reason)}")
        conn |> put_status(:bad_request) |> json(%{received: false, error: "signature_rejected"})

      {:error, reason} ->
        Logger.error("#{provider} webhook failed: #{inspect(reason)}")
        conn |> put_status(:bad_request) |> json(%{received: false, error: to_string(reason)})
    end
  end

  defp fetch_settlement(scope, id) do
    case Enum.find(Payments.list_settlements(scope), &(&1.id == id)) do
      nil -> {:error, :not_found}
      settlement -> {:ok, settlement}
    end
  end

  defp require_money(value) do
    case parse_money(value) do
      nil -> {:error, :amount_required}
      amount -> {:ok, amount}
    end
  end

  defp parse_money(nil), do: nil

  defp parse_money(value) do
    case Kaarobar.Money.cast(value) do
      {:ok, amount} -> amount
      :error -> nil
    end
  end
end
