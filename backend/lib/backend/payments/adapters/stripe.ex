defmodule Kaarobar.Payments.Adapters.Stripe do
  @moduledoc """
  Cards, through Stripe.

  ## Signature verification is the security boundary

  `verify_webhook/3` is the only thing standing between the shop's books and
  anyone on the internet who knows a payment intent id. It recomputes the HMAC
  over `timestamp.payload` exactly as Stripe signs it, compares in constant
  time, and rejects anything older than the tolerance — because a valid
  signature replayed a week later is still a stranger telling the shop it was
  paid.

  Constant-time comparison matters here specifically: a byte-by-byte compare
  leaks how much of a forged signature was right, and a few thousand attempts
  turns that into a working forgery.

  ## Money crosses the boundary in minor units

  Stripe counts in the currency's smallest unit; the rest of this system counts
  in `Decimal`. The conversion lives here, once per direction, because a
  rounding error introduced at the edges would be silent and would only show up
  in a reconciliation weeks later.
  """

  @behaviour Kaarobar.Payments.Gateway

  alias Kaarobar.Money
  alias Kaarobar.Payments.HTTP
  alias Kaarobar.Payments.Provider

  @api "https://api.stripe.com/v1"
  # Stripe's own recommendation. Long enough for a slow queue, short enough
  # that a captured signature is not useful tomorrow.
  @tolerance_seconds 300

  @impl true
  def create_charge(%Provider{} = provider, params) do
    body = %{
      "amount" => to_minor(params.amount, params.currency),
      "currency" => String.downcase(params.currency),
      "automatic_payment_methods[enabled]" => "true",
      "metadata[reference]" => params.reference
    }

    body =
      body
      |> maybe_put("description", Map.get(params, :description))
      |> maybe_put("receipt_email", Map.get(params, :customer_email))

    case HTTP.post_form(provider, "#{@api}/payment_intents", body, auth(provider)) do
      {:ok, response} -> {:ok, to_result(response, params.currency)}
      {:error, reason} -> {:error, reason}
    end
  end

  @impl true
  def capture(%Provider{} = provider, external_id, amount) do
    body = %{"amount_to_capture" => to_minor(amount, "usd")}

    case HTTP.post_form(provider, "#{@api}/payment_intents/#{external_id}/capture", body, auth(provider)) do
      {:ok, response} -> {:ok, to_result(response, currency_of(response))}
      {:error, reason} -> {:error, reason}
    end
  end

  @impl true
  def refund(%Provider{} = provider, external_id, amount) do
    body = %{
      "payment_intent" => external_id,
      "amount" => to_minor(amount, "usd")
    }

    case HTTP.post_form(provider, "#{@api}/refunds", body, auth(provider)) do
      {:ok, response} ->
        {:ok,
         %{
           status: :refunded,
           external_id: Map.get(response, "id"),
           provider_status: Map.get(response, "status"),
           amount: amount,
           raw: response
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def void(%Provider{} = provider, external_id) do
    case HTTP.post_form(provider, "#{@api}/payment_intents/#{external_id}/cancel", %{}, auth(provider)) do
      {:ok, response} -> {:ok, %{to_result(response, currency_of(response)) | status: :cancelled}}
      {:error, reason} -> {:error, reason}
    end
  end

  @impl true
  def fetch_status(%Provider{} = provider, external_id) do
    case HTTP.get(provider, "#{@api}/payment_intents/#{external_id}", auth(provider)) do
      {:ok, response} -> {:ok, to_result(response, currency_of(response))}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Checks a Stripe callback's signature.

  Recomputes the HMAC over `timestamp.payload`, compares in constant time, and
  refuses anything outside the tolerance window. Public so it can be tested
  directly — this is the function most worth having tests for in the whole
  adapter.
  """
  @impl true
  def verify_webhook(%Provider{} = provider, raw_body, headers) do
    with {:ok, secret} <- fetch_secret(provider),
         {:ok, header} <- fetch_signature_header(headers),
         {:ok, timestamp, signatures} <- parse_signature_header(header),
         :ok <- check_timestamp(timestamp),
         :ok <- check_signature(secret, timestamp, raw_body, signatures),
         {:ok, event} <- Jason.decode(raw_body) do
      {:ok, event}
    end
  end

  @impl true
  def parse_event(%{"type" => type, "id" => id} = event) do
    object = get_in(event, ["data", "object"]) || %{}

    case status_for(type, object) do
      nil ->
        # Stripe sends a great deal a POS does not care about. Saying so is not
        # an error; treating it as one fills the retry queue with noise.
        {:ok, nil}

      status ->
        {:ok,
         %{
           external_id: id,
           type: type,
           result: %{
             status: status,
             external_id: Map.get(object, "id"),
             provider_status: Map.get(object, "status"),
             failure_code: get_in(object, ["last_payment_error", "code"]),
             failure_message: get_in(object, ["last_payment_error", "message"]),
             raw: object
           }
         }}
    end
  end

  def parse_event(_event), do: {:error, :unrecognised_event}

  @impl true
  def supports_capture?, do: true

  @impl true
  def supports_refund?, do: true

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp status_for("payment_intent.succeeded", _object), do: :captured
  defp status_for("payment_intent.amount_capturable_updated", _object), do: :authorized
  defp status_for("payment_intent.payment_failed", _object), do: :failed
  defp status_for("payment_intent.canceled", _object), do: :cancelled
  defp status_for("payment_intent.requires_action", _object), do: :requires_action
  defp status_for("charge.refunded", _object), do: :refunded
  defp status_for(_type, _object), do: nil

  defp to_result(response, currency) do
    %{
      status: intent_status(Map.get(response, "status")),
      external_id: Map.get(response, "id"),
      checkout_url: Map.get(response, "next_action") && hosted_url(response),
      amount: from_minor(Map.get(response, "amount"), currency),
      provider_status: Map.get(response, "status"),
      failure_code: get_in(response, ["last_payment_error", "code"]),
      failure_message: get_in(response, ["last_payment_error", "message"]),
      raw: response
    }
  end

  defp intent_status("succeeded"), do: :captured
  defp intent_status("requires_capture"), do: :authorized
  defp intent_status("requires_action"), do: :requires_action
  defp intent_status("requires_payment_method"), do: :pending
  defp intent_status("requires_confirmation"), do: :pending
  defp intent_status("processing"), do: :pending
  defp intent_status("canceled"), do: :cancelled
  defp intent_status(_other), do: :pending

  defp hosted_url(response),
    do: get_in(response, ["next_action", "redirect_to_url", "url"])

  defp currency_of(response), do: Map.get(response, "currency", "usd")

  defp auth(%Provider{} = provider) do
    [{"authorization", "Bearer #{Provider.credential(provider, "secret_key")}"}]
  end

  defp fetch_secret(%Provider{} = provider) do
    case Provider.signing_secret(provider) do
      nil -> {:error, :webhook_secret_missing}
      secret -> {:ok, secret}
    end
  end

  defp fetch_signature_header(headers) do
    case Map.get(headers, "stripe-signature") || Map.get(headers, "Stripe-Signature") do
      nil -> {:error, :signature_missing}
      value -> {:ok, value}
    end
  end

  # `t=1614556800,v1=abc...,v1=def...` — more than one v1 is normal during a
  # secret rotation, and refusing the second one would break every rotation.
  defp parse_signature_header(header) do
    parts =
      header
      |> String.split(",")
      |> Enum.map(&String.split(&1, "=", parts: 2))
      |> Enum.filter(&match?([_key, _value], &1))

    timestamp = Enum.find_value(parts, fn ["t", value] -> value; _other -> nil end)
    signatures = for ["v1", value] <- parts, do: value

    cond do
      is_nil(timestamp) -> {:error, :signature_malformed}
      signatures == [] -> {:error, :signature_malformed}
      true -> {:ok, timestamp, signatures}
    end
  end

  # A valid signature replayed a week later is still a stranger telling the
  # shop it was paid.
  defp check_timestamp(timestamp) do
    with {seconds, ""} <- Integer.parse(timestamp),
         age when age <= @tolerance_seconds <- abs(System.system_time(:second) - seconds) do
      :ok
    else
      _outside -> {:error, :signature_expired}
    end
  end

  defp check_signature(secret, timestamp, raw_body, signatures) do
    expected =
      :hmac
      |> :crypto.mac(:sha256, secret, "#{timestamp}.#{raw_body}")
      |> Base.encode16(case: :lower)

    # Constant time: a byte-by-byte compare leaks how much of a forged
    # signature was right, and a few thousand attempts turns that into a
    # working forgery.
    if Enum.any?(signatures, &Plug.Crypto.secure_compare(&1, expected)) do
      :ok
    else
      {:error, :signature_invalid}
    end
  end

  # Stripe counts in the currency's smallest unit; this system counts in
  # Decimal. One conversion per direction, here, because a rounding error at
  # the edges would only surface in a reconciliation weeks later.
  defp to_minor(%Decimal{} = amount, currency) do
    factor = :math.pow(10, Money.minor_units(currency)) |> round()

    amount |> Decimal.mult(factor) |> Decimal.round(0) |> Decimal.to_integer()
  end

  defp from_minor(nil, _currency), do: Money.zero()

  defp from_minor(minor, currency) when is_integer(minor) do
    factor = :math.pow(10, Money.minor_units(currency)) |> round()

    minor |> Decimal.new() |> Decimal.div(factor) |> Money.round(currency)
  end

  defp from_minor(_other, _currency), do: Money.zero()

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
