defmodule KaarobarWeb.BillingController do
  @moduledoc """
  The organization's own subscription: what it is on, what it owes, what it can
  reach.

  ## Reachable when the subscription has lapsed

  `KaarobarWeb.Plugs.RequireSubscription` exempts this controller by name. An
  organization that has been cut off and cannot reach the screen where it pays
  is one that cannot become a paying customer again — which is a worse outcome
  for us than for them.

  ## Plans are read-only here

  The catalogue is ours, not the tenant's. Creating and pricing plans happens
  in platform administration; a tenant may look at what is on offer and choose
  one.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Billing
  alias KaarobarWeb.ClientLinks

  # `show` and `plans` are deliberately ungated: everybody in an organization
  # should be able to see whether the subscription is the reason something has
  # stopped working, even if only one person may act on it.
  plug KaarobarWeb.Plugs.Authorize,
       [permission: "organization:billing"]
       when action in [
              :checkout,
              :portal,
              :subscribe,
              :change_plan,
              :cancel,
              :resume,
              :set_quantity,
              :invoices,
              :invoice
            ]

  # --- Plans ------------------------------------------------------------------

  @doc """
  What is on offer.

  Public plans only. An unlisted plan is still live for the organizations
  already on it, and showing it here would be offering an old price to
  everybody.
  """
  def plans(conn, _params) do
    conn
    # Also served unauthenticated, to the marketing site's pricing page. The
    # catalogue is the same for everyone, so a shared cache may keep it.
    |> put_resp_header("cache-control", "public, max-age=300")
    |> render(:plans, plans: Billing.list_plans(), checkout_enabled: Billing.checkout_enabled?())
  end

  # --- Subscription -----------------------------------------------------------

  @doc "Where this organization stands. The screen a lapsed tenant lands on."
  def show(conn, _params) do
    scope = conn.assigns.scope

    render(conn, :subscription,
      subscription: Billing.subscription(scope),
      trial_eligible: Billing.trial_eligible?(scope)
    )
  end

  def subscribe(conn, %{"plan" => plan_code} = params) do
    opts = if params["skip_trial"] in [true, "true"], do: [skip_trial: true], else: []
    opts = Keyword.put(opts, :require_payment, Billing.checkout_enabled?())

    with {:ok, subscription} <- Billing.subscribe(conn.assigns.scope, plan_code, opts) do
      conn |> put_status(:created) |> render(:subscription, subscription: subscription)
    end
  end

  @doc """
  Where to send the customer to pay by card.

  The return addresses are built here from `FRONTEND_URL`, never taken from
  the request: a caller-chosen success URL would make this an open redirect
  that happens to pass through Stripe.
  """
  def checkout(conn, %{"plan" => plan_code}) do
    opts = [
      success_url: ClientLinks.billing("success"),
      cancel_url: ClientLinks.billing("cancelled")
    ]

    with {:ok, session} <- Billing.checkout(conn.assigns.scope, plan_code, opts) do
      json(conn, %{data: session})
    end
  end

  def checkout(_conn, _params), do: {:error, :bad_request}

  @doc "Stripe's customer portal: the card, the plan, cancelling, past invoices."
  def portal(conn, _params) do
    with {:ok, session} <- Billing.portal(conn.assigns.scope, ClientLinks.billing()) do
      json(conn, %{data: session})
    end
  end

  def change_plan(conn, %{"plan" => plan_code}) do
    with {:ok, subscription} <- Billing.change_plan(conn.assigns.scope, plan_code) do
      render(conn, :subscription, subscription: subscription)
    end
  end

  @doc """
  Cancels.

  At the end of the paid period unless `immediate` is asked for — the customer
  keeps what they have already paid for.
  """
  def cancel(conn, params) do
    opts = if params["immediate"] in [true, "true"], do: [immediate: true], else: []

    with {:ok, subscription} <- Billing.cancel(conn.assigns.scope, opts) do
      render(conn, :subscription, subscription: subscription)
    end
  end

  def resume(conn, _params) do
    with {:ok, subscription} <- Billing.resume(conn.assigns.scope) do
      render(conn, :subscription, subscription: subscription)
    end
  end

  def set_quantity(conn, %{"kind" => kind, "quantity" => quantity}) do
    with {:ok, _item} <- Billing.set_quantity(conn.assigns.scope, kind, to_integer(quantity)) do
      render(conn, :subscription, subscription: Billing.subscription(conn.assigns.scope))
    end
  end

  # --- Invoices ---------------------------------------------------------------

  def invoices(conn, params) do
    opts = if params["status"], do: [status: params["status"]], else: []

    render(conn, :invoices, invoices: Billing.list_invoices(conn.assigns.scope, opts))
  end

  def invoice(conn, %{"id" => id}) do
    with {:ok, invoice} <- Billing.fetch_invoice(conn.assigns.scope, id) do
      render(conn, :invoice, invoice: invoice)
    end
  end

  defp to_integer(value) when is_integer(value), do: value

  defp to_integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {number, _rest} -> number
      :error -> 0
    end
  end

  defp to_integer(_value), do: 0
end
