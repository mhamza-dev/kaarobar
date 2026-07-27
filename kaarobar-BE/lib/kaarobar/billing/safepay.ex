defmodule Kaarobar.Billing.Safepay do
  @moduledoc """
  Safepay HTTP client for Pakistan SaaS billing (ADM-FR-003).

  Hosted redirect checkout (no embedded card fields):

  * **Subscriptions** — passport token + `/checkout/subscribe` URL
    (`planId`, `reference`, `cancelUrl`, `redirectUrl`)
  * **One-time** — `POST /order/v1/init` payment tracker + `/checkout/pay` URL
    (campaign pay-to-send amounts in PKR)

  Env (see `.env.example`):

  * `SAFEPAY_API_KEY` — client key for payment init
  * `SAFEPAY_SECRET_KEY` — merchant secret (`X-SFPY-MERCHANT-SECRET`) for passport
  * `SAFEPAY_WEBHOOK_SECRET` — HMAC for `X-SFPY-SIGNATURE`
  * `SAFEPAY_ENVIRONMENT` — `sandbox` (default) | `production` | `development`
  * `SAFEPAY_PLAN_STARTER` / `_GROWTH` / `_ENTERPRISE` — dashboard plan IDs
  * `SAFEPAY_CHECKOUT_URL` — static fallback when API keys are unset

  Docs: https://safepay-docs.netlify.app/ · Node SDK patterns from `@sfpy/node-sdk`.
  """

  @api_production "https://api.getsafepay.com"
  @api_sandbox "https://sandbox.api.getsafepay.com"
  @api_development "https://dev.api.getsafepay.com"

  @checkout_production "https://getsafepay.com/checkout"
  @checkout_sandbox "https://sandbox.api.getsafepay.com/checkout"
  @checkout_development "https://dev.api.getsafepay.com/checkout"

  def configured? do
    api_key() not in [nil, ""] and secret_key() not in [nil, ""]
  end

  def environment do
    case System.get_env("SAFEPAY_ENVIRONMENT") ||
           Application.get_env(:kaarobar, :safepay_environment) ||
           "sandbox" do
      env when env in ~w(production sandbox development) -> env
      _ -> "sandbox"
    end
  end

  def api_key,
    do: System.get_env("SAFEPAY_API_KEY") || Application.get_env(:kaarobar, :safepay_api_key)

  def secret_key,
    do:
      System.get_env("SAFEPAY_SECRET_KEY") ||
        Application.get_env(:kaarobar, :safepay_secret_key)

  def webhook_secret,
    do:
      System.get_env("SAFEPAY_WEBHOOK_SECRET") ||
        Application.get_env(:kaarobar, :safepay_webhook_secret)

  def fallback_checkout_url do
    System.get_env("SAFEPAY_CHECKOUT_URL") ||
      Application.get_env(:kaarobar, :safepay_checkout_url)
  end

  def plan_id_for(code) when is_binary(code) do
    env_key = "SAFEPAY_PLAN_#{String.upcase(code)}"

    System.get_env(env_key) ||
      Application.get_env(:kaarobar, :safepay_plans, %{})[code]
  end

  def plan_id_for(_), do: nil

  @doc """
  Encode checkout metadata into a URL-safe reference / order_id.
  Decoded again from Safepay webhooks via `decode_reference/1`.
  """
  def encode_reference(meta) when is_map(meta) do
    meta
    |> Enum.reject(fn {_k, v} -> is_nil(v) or v == "" end)
    |> Map.new(fn {k, v} -> {to_string(k), v} end)
    |> Jason.encode!()
    |> Base.url_encode64(padding: false)
  end

  def decode_reference(ref) when is_binary(ref) and ref != "" do
    with {:ok, json} <- Base.url_decode64(ref, padding: false),
         {:ok, map} when is_map(map) <- Jason.decode(json) do
      {:ok, map}
    else
      _ ->
        # Plain payment UUID / legacy order ids
        {:ok, %{"payment_id" => ref, "order_id" => ref}}
    end
  end

  def decode_reference(_), do: {:error, :invalid_reference}

  @doc """
  Create a hosted subscription checkout URL (planId + reference).
  """
  def create_subscription_checkout(plan_id, reference, opts \\ %{})

  def create_subscription_checkout(plan_id, reference, opts)
      when is_binary(plan_id) and plan_id != "" and is_binary(reference) and reference != "" do
    if not configured?() do
      {:error, :not_configured}
    else
      redirect_url = opts[:redirect_url] || opts["redirect_url"] || default_redirect_url()
      cancel_url = opts[:cancel_url] || opts["cancel_url"] || redirect_url

      with {:ok, auth_token} <- create_passport_token() do
        url =
          subscription_checkout_base()
          |> URI.parse()
          |> Map.put(
            :query,
            URI.encode_query(%{
              "plan_id" => plan_id,
              "auth_token" => auth_token,
              "env" => environment(),
              "cancel_url" => cancel_url,
              "redirect_url" => redirect_url,
              "reference" => reference
            })
          )
          |> URI.to_string()

        {:ok, %{checkout_url: url, reference: reference, plan_id: plan_id}}
      end
    end
  end

  def create_subscription_checkout(_, _, _), do: {:error, :not_configured}

  @doc """
  Create a one-time payment tracker and hosted checkout URL (PKR).

  `amount_pkr` may be a Decimal, integer, float, or numeric string (major units).
  """
  def create_payment_checkout(amount_pkr, order_id, opts \\ %{})

  def create_payment_checkout(amount_pkr, order_id, opts)
      when is_binary(order_id) and order_id != "" do
    if not configured?() do
      {:error, :not_configured}
    else
      amount = normalize_amount(amount_pkr)
      redirect_url = opts[:redirect_url] || opts["redirect_url"] || default_redirect_url()
      cancel_url = opts[:cancel_url] || opts["cancel_url"] || redirect_url
      webhooks? = opts[:webhooks] != false and opts["webhooks"] != false

      with {:ok, token} <- init_payment(amount, "PKR") do
        url =
          payment_checkout_base()
          |> URI.parse()
          |> Map.put(
            :query,
            URI.encode_query(%{
              "beacon" => token,
              "cancel_url" => cancel_url,
              "env" => environment(),
              "order_id" => order_id,
              "redirect_url" => redirect_url,
              "source" => "custom",
              "webhooks" => to_string(webhooks?)
            })
          )
          |> URI.to_string()

        {:ok, %{checkout_url: url, checkout_id: token, tracker: token, order_id: order_id}}
      end
    end
  end

  def create_payment_checkout(_, _, _), do: {:error, :not_configured}

  @doc """
  Verify `X-SFPY-SIGNATURE` (classic Safepay Node SDK: HMAC-SHA512 over JSON `data`).

  Also accepts HMAC-SHA256 hex of the raw body (dev/tests) when `data` is absent.
  When webhook secret is unset, verification is skipped (`:ok`).
  """
  def verify_webhook_signature(raw_body, signature, opts \\ [])

  def verify_webhook_signature(raw_body, signature, opts)
      when is_binary(raw_body) and is_binary(signature) do
    secret = webhook_secret()

    if secret in [nil, ""] do
      :ok
    else
      sig = String.trim(signature)

      candidates =
        [
          hmac_hex(:sha512, secret, encode_data_blob(raw_body, opts)),
          hmac_hex(:sha256, secret, raw_body),
          hmac_hex(:sha512, secret, raw_body)
        ]
        |> Enum.reject(&is_nil/1)

      # Newer Raast-style: sha256=<hex> over timestamp.raw_body
      timestamp = opts[:timestamp] || opts["timestamp"]

      candidates =
        if is_binary(timestamp) and timestamp != "" do
          key =
            case Base.decode64(secret) do
              {:ok, decoded} -> decoded
              _ -> secret
            end

          digest =
            :crypto.mac(:hmac, :sha256, key, timestamp <> "." <> raw_body)
            |> Base.encode16(case: :lower)

          ["sha256=#{digest}" | candidates]
        else
          candidates
        end

      if Enum.any?(candidates, fn expected ->
           is_binary(expected) and byte_size(expected) == byte_size(sig) and
             (Plug.Crypto.secure_compare(expected, String.downcase(sig)) or
                Plug.Crypto.secure_compare(expected, sig))
         end) do
        :ok
      else
        {:error, :invalid_signature}
      end
    end
  end

  def verify_webhook_signature(_, _, _), do: {:error, :invalid_signature}

  # --- HTTP ---

  defp create_passport_token do
    url = "#{client_api_base()}/passport/v1/token"

    headers = [
      {"x-sfpy-merchant-secret", secret_key()},
      {"content-type", "application/json"},
      {"accept", "application/json"}
    ]

    request = Finch.build(:post, url, headers, "{}")

    case Finch.request(request, Kaarobar.Finch) do
      {:ok, %Finch.Response{status: status, body: body}} when status in 200..299 ->
        case Jason.decode(body) do
          {:ok, %{"data" => token}} when is_binary(token) and token != "" ->
            {:ok, token}

          {:ok, %{"data" => %{"token" => token}}} when is_binary(token) ->
            {:ok, token}

          _ ->
            {:error, :invalid_passport_response}
        end

      {:ok, %Finch.Response{status: status, body: body}} ->
        {:error, {status, body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp init_payment(amount, currency) do
    url = "#{api_base()}/order/v1/init"

    body =
      Jason.encode!(%{
        amount: amount,
        client: api_key(),
        currency: currency,
        environment: environment()
      })

    headers = [
      {"content-type", "application/json"},
      {"accept", "application/json"}
    ]

    request = Finch.build(:post, url, headers, body)

    case Finch.request(request, Kaarobar.Finch) do
      {:ok, %Finch.Response{status: status, body: resp}} when status in 200..299 ->
        case Jason.decode(resp) do
          {:ok, %{"data" => %{"token" => token}}} when is_binary(token) ->
            {:ok, token}

          {:ok, %{"data" => token}} when is_binary(token) ->
            {:ok, token}

          {:ok, %{"token" => token}} when is_binary(token) ->
            {:ok, token}

          _ ->
            {:error, :invalid_payment_response}
        end

      {:ok, %Finch.Response{status: status, body: resp}} ->
        {:error, {status, resp}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp api_base do
    case environment() do
      "production" -> @api_production
      "development" -> @api_development
      _ -> @api_sandbox
    end
  end

  defp client_api_base, do: api_base() <> "/client"

  defp payment_checkout_base do
    case environment() do
      "production" -> @checkout_production <> "/pay"
      "development" -> @checkout_development <> "/pay"
      _ -> @checkout_sandbox <> "/pay"
    end
  end

  defp subscription_checkout_base do
    case environment() do
      "production" -> @checkout_production <> "/subscribe"
      "development" -> @checkout_development <> "/subscribe"
      _ -> @checkout_sandbox <> "/subscribe"
    end
  end

  defp default_redirect_url do
    Application.get_env(:kaarobar, :public_base_url, "http://localhost:4000") <>
      "/app/settings?tab=subscriptions"
  end

  defp normalize_amount(%Decimal{} = d), do: Decimal.to_float(d)
  defp normalize_amount(n) when is_integer(n), do: n * 1.0
  defp normalize_amount(n) when is_float(n), do: n

  defp normalize_amount(str) when is_binary(str) do
    case Float.parse(str) do
      {n, _} -> n
      :error -> 0.0
    end
  end

  defp normalize_amount(_), do: 0.0

  defp encode_data_blob(raw_body, opts) do
    cond do
      is_map(opts[:data]) ->
        Jason.encode!(opts[:data])

      true ->
        case Jason.decode(raw_body) do
          {:ok, %{"data" => data}} -> Jason.encode!(data)
          _ -> raw_body
        end
    end
  end

  defp hmac_hex(_alg, _secret, nil), do: nil

  defp hmac_hex(alg, secret, payload) when is_binary(payload) do
    :crypto.mac(:hmac, alg, secret, payload) |> Base.encode16(case: :lower)
  end
end
