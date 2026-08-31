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

  # `show` and `plans` are deliberately ungated: everybody in an organization
  # should be able to see whether the subscription is the reason something has
  # stopped working, even if only one person may act on it.
  plug KaarobarWeb.Plugs.Authorize,
       [permission: "organization:billing"]
       when action in [
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
    render(conn, :plans, plans: Billing.list_plans())
  end

  # --- Subscription -----------------------------------------------------------

  @doc "Where this organization stands. The screen a lapsed tenant lands on."
  def show(conn, _params) do
    render(conn, :subscription, subscription: Billing.subscription(conn.assigns.scope))
  end

  def subscribe(conn, %{"plan" => plan_code} = params) do
    opts = if params["skip_trial"] in [true, "true"], do: [skip_trial: true], else: []

    with {:ok, subscription} <- Billing.subscribe(conn.assigns.scope, plan_code, opts) do
      conn |> put_status(:created) |> render(:subscription, subscription: subscription)
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
