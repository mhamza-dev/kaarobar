defmodule KaarobarWeb.V1.BillingController do
  use KaarobarWeb, :controller

  alias Kaarobar.Billing
  alias Kaarobar.Guardian

  def show(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id
    json(conn, %{data: Billing.usage_summary(owner_id)})
  end

  def webhook(conn, params) do
    raw =
      case conn.assigns[:raw_body] do
        [body | _] when is_binary(body) -> body
        body when is_binary(body) -> body
        _ -> Jason.encode!(params)
      end

    signature = get_req_header(conn, "x-signature") |> List.first()

    with :ok <- Billing.verify_webhook_signature(raw, signature || ""),
         {:ok, result} <- Billing.handle_lemonsqueezy_webhook(params) do
      json(conn, result)
    else
      {:error, :invalid_signature} ->
        conn |> put_status(:unauthorized) |> json(%{error: "invalid_signature"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end
end
