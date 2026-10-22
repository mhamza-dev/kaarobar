defmodule KaarobarWeb.BillingWebhookController do
  @moduledoc """
  Callbacks from Kaarobar's own Stripe account.

  Separate from `KaarobarWeb.PaymentController.webhook/2`, which receives
  callbacks for a *shop's* gateway and looks up that shop's signing secret.
  This one has a single secret, ours, and settles subscriptions rather than
  sales.

  ## Answering

  200 for anything verified, including events deliberately ignored: Stripe
  reads any other status as "send it again", and retries for days. 400 for a
  bad signature, which genuinely should not be retried and shows up as a
  failure on the Stripe dashboard — which is how we find out the secret is
  wrong.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Billing

  require Logger

  def stripe(conn, _params) do
    raw_body = conn.assigns[:raw_body] || ""
    headers = Map.new(conn.req_headers)

    case Billing.handle_stripe_webhook(raw_body, headers) do
      {:ok, outcome} ->
        json(conn, %{received: true, status: outcome})

      {:error, {:signature_rejected, reason}} ->
        Logger.warning("rejected billing webhook: #{inspect(reason)}")
        conn |> put_status(:bad_request) |> json(%{received: false, error: "signature_rejected"})

      {:error, reason} ->
        # Logged and refused, so Stripe retries: most of these are an event
        # arriving before the one it depends on, and a retry is what fixes it.
        Logger.error("billing webhook failed: #{inspect(reason)}")
        conn |> put_status(:bad_request) |> json(%{received: false, error: "not_applied"})
    end
  end
end
