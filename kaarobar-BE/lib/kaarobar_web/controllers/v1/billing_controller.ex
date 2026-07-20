defmodule KaarobarWeb.V1.BillingController do
  use KaarobarWeb, :controller
  alias Kaarobar.Billing
  alias Kaarobar.Guardian

  def show(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    {:ok, sub} = Billing.ensure_subscription(user.id)
    json(conn, %{data: sub})
  end

  def webhook(conn, params) do
    {:ok, result} = Billing.handle_lemonsqueezy_webhook(params)
    json(conn, result)
  end
end
