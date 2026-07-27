defmodule KaarobarWeb.V1.BillingController do
  use KaarobarWeb, :controller

  alias Kaarobar.Billing
  alias Kaarobar.Guardian

  def show(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id
    json(conn, %{data: Billing.usage_summary(owner_id)})
  end

  def checkout(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id
    plan = params["plan"] || params["plan_code"]

    case Billing.create_plan_checkout(owner_id, plan, %{
           redirect_url: params["redirect_url"],
           cancel_url: params["cancel_url"] || params["redirect_url"]
         }) do
      {:ok, %{checkout_url: url} = meta} ->
        json(conn, %{
          data: %{
            checkout_url: url,
            plan: plan,
            checkout_id: Map.get(meta, :checkout_id) || Map.get(meta, :reference),
            dev_fallback: Map.get(meta, :dev_fallback, false)
          }
        })

      {:ok, url} when is_binary(url) ->
        json(conn, %{data: %{checkout_url: url, plan: plan}})

      {:error, :invalid_plan} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid_plan"})

      {:error, :not_configured} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{error: "safepay_not_configured"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def webhook(conn, params) do
    raw =
      case conn.assigns[:raw_body] do
        [body | _] when is_binary(body) -> body
        body when is_binary(body) -> body
        _ -> Jason.encode!(params)
      end

    signature =
      get_req_header(conn, "x-sfpy-signature")
      |> List.first() ||
        get_req_header(conn, "x-signature") |> List.first()

    timestamp = get_req_header(conn, "x-sfpy-timestamp") |> List.first()

    with :ok <-
           Billing.verify_webhook_signature(raw, signature || "", %{
             timestamp: timestamp,
             data: params["data"]
           }),
         {:ok, result} <- Billing.handle_safepay_webhook(params) do
      json(conn, result)
    else
      {:error, :invalid_signature} ->
        conn |> put_status(:unauthorized) |> json(%{error: "invalid_signature"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end
end
