defmodule Kaarobar.Payments.Adapters.JazzCash do
  @moduledoc """
  Mobile wallet payments through JazzCash.

  ## The secure hash is the whole protocol

  JazzCash authenticates both directions with an HMAC-SHA256 over the request's
  own fields: every non-empty parameter except the hash itself, sorted by key,
  joined with `&`, prefixed by the integrity salt. Get the sorting or the
  empty-field handling wrong and every request is rejected with an error that
  says nothing useful — so `secure_hash/2` is public and is the thing worth
  testing directly.

  The same function verifies callbacks. A response whose hash does not
  recompute is a stranger claiming a wallet paid, and it is refused.

  ## Amounts are integer paisa in a string

  JazzCash wants the minor unit, zero-padded, as text. The conversion lives
  here so a rounding error cannot leak into the rest of the system, and so the
  one place it could go wrong is the one place there is a test for it.
  """

  @behaviour Kaarobar.Payments.Gateway

  alias Kaarobar.Payments.HTTP
  alias Kaarobar.Payments.Provider

  @sandbox "https://sandbox.jazzcash.com.pk/ApplicationAPI/API/Payment/DoTransaction"
  @live "https://payments.jazzcash.com.pk/ApplicationAPI/API/Payment/DoTransaction"

  @impl true
  def create_charge(%Provider{} = provider, params) do
    fields = build_fields(provider, params)
    body = Map.put(fields, "pp_SecureHash", secure_hash(provider, fields))

    case HTTP.post_json(provider, endpoint(provider), body, json_headers()) do
      {:ok, response} -> {:ok, to_result(response, params)}
      {:error, reason} -> {:error, reason}
    end
  end

  @impl true
  def capture(%Provider{}, external_id, amount) do
    # Wallet payments settle in one step: the customer approves on their phone
    # and the money moves. There is nothing held to capture later.
    {:ok, %{status: :captured, external_id: external_id, amount: amount}}
  end

  @impl true
  def refund(%Provider{} = provider, external_id, amount) do
    fields = %{
      "pp_TxnRefNo" => external_id,
      "pp_MerchantID" => Provider.credential(provider, "merchant_id"),
      "pp_Password" => Provider.credential(provider, "password"),
      "pp_Amount" => to_paisa(amount),
      "pp_TxnCurrency" => "PKR"
    }

    body = Map.put(fields, "pp_SecureHash", secure_hash(provider, fields))

    case HTTP.post_json(provider, refund_endpoint(provider), body, json_headers()) do
      {:ok, response} ->
        {:ok,
         %{
           status: :refunded,
           external_id: Map.get(response, "pp_TxnRefNo", external_id),
           amount: amount,
           provider_status: Map.get(response, "pp_ResponseCode"),
           raw: response
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def void(%Provider{}, _external_id), do: {:error, :not_supported}

  @impl true
  def fetch_status(%Provider{} = provider, external_id) do
    fields = %{
      "pp_TxnRefNo" => external_id,
      "pp_MerchantID" => Provider.credential(provider, "merchant_id"),
      "pp_Password" => Provider.credential(provider, "password")
    }

    body = Map.put(fields, "pp_SecureHash", secure_hash(provider, fields))

    case HTTP.post_json(provider, status_endpoint(provider), body, json_headers()) do
      {:ok, response} ->
        {:ok,
         %{
           status: status_for(Map.get(response, "pp_ResponseCode")),
           external_id: external_id,
           provider_status: Map.get(response, "pp_ResponseCode"),
           failure_message: Map.get(response, "pp_ResponseMessage"),
           raw: response
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def verify_webhook(%Provider{} = provider, raw_body, _headers) do
    with {:ok, payload} <- decode(raw_body),
         supplied when is_binary(supplied) <- Map.get(payload, "pp_SecureHash"),
         expected <- secure_hash(provider, Map.delete(payload, "pp_SecureHash")),
         true <- Plug.Crypto.secure_compare(String.upcase(supplied), expected) do
      {:ok, payload}
    else
      nil -> {:error, :signature_missing}
      false -> {:error, :signature_invalid}
      {:error, reason} -> {:error, reason}
    end
  end

  @impl true
  def parse_event(%{"pp_TxnRefNo" => reference} = payload) do
    code = Map.get(payload, "pp_ResponseCode")

    {:ok,
     %{
       external_id: reference,
       type: "jazzcash.transaction",
       result: %{
         status: status_for(code),
         external_id: reference,
         provider_status: code,
         failure_code: if(code != "000", do: code),
         failure_message: Map.get(payload, "pp_ResponseMessage"),
         wallet_msisdn: Map.get(payload, "pp_MobileNumber"),
         raw: payload
       }
     }}
  end

  def parse_event(_payload), do: {:ok, nil}

  @impl true
  def supports_capture?, do: false

  @impl true
  def supports_refund?, do: true

  @doc """
  The integrity hash JazzCash signs every message with.

  Non-empty values only, sorted by key, joined with `&`, prefixed by the salt.
  Public because it is the single point where a mistake makes every request
  fail with a message that explains nothing, and it deserves its own tests.
  """
  @spec secure_hash(Provider.t(), map()) :: String.t()
  def secure_hash(%Provider{} = provider, fields) do
    salt = Provider.credential(provider, "integrity_salt") || ""

    payload =
      fields
      |> Enum.reject(fn {key, value} -> key == "pp_SecureHash" or blank?(value) end)
      |> Enum.sort_by(fn {key, _value} -> key end)
      |> Enum.map_join("&", fn {_key, value} -> to_string(value) end)

    :hmac
    |> :crypto.mac(:sha256, salt, salt <> "&" <> payload)
    |> Base.encode16(case: :upper)
  end

  @doc """
  Rupees as the integer paisa string JazzCash expects.

  Public for the same reason as the hash: it is a conversion that fails
  silently and only shows up as a wrong amount on somebody's statement.
  """
  @spec to_paisa(Decimal.t()) :: String.t()
  def to_paisa(%Decimal{} = amount) do
    amount
    |> Decimal.mult(100)
    |> Decimal.round(0)
    |> Decimal.to_integer()
    |> Integer.to_string()
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp build_fields(%Provider{} = provider, params) do
    now = DateTime.utc_now()

    %{
      "pp_Version" => "2.0",
      "pp_TxnType" => "MWALLET",
      "pp_Language" => "EN",
      "pp_MerchantID" => Provider.credential(provider, "merchant_id"),
      "pp_Password" => Provider.credential(provider, "password"),
      "pp_TxnRefNo" => params.reference,
      "pp_Amount" => to_paisa(params.amount),
      "pp_TxnCurrency" => params.currency,
      "pp_TxnDateTime" => stamp(now),
      # JazzCash refuses a transaction whose expiry has passed, so a generous
      # window is what stops a slow customer losing their basket.
      "pp_TxnExpiryDateTime" => stamp(DateTime.add(now, 3600, :second)),
      "pp_BillReference" => params.reference,
      "pp_Description" => Map.get(params, :description) || params.reference,
      "pp_MobileNumber" => Map.get(params, :customer_phone) || "",
      "ppmpf_1" => Map.get(params, :customer_phone) || ""
    }
  end

  defp to_result(response, params) do
    code = Map.get(response, "pp_ResponseCode")

    %{
      status: status_for(code),
      external_id: Map.get(response, "pp_TxnRefNo", params.reference),
      amount: params.amount,
      provider_status: code,
      failure_code: if(code not in [nil, "000", "121"], do: code),
      failure_message: Map.get(response, "pp_ResponseMessage"),
      raw: response
    }
  end

  # 000 is success. 121 is "pending customer approval" — the customer has been
  # sent a prompt on their phone and has not answered yet, which is a state the
  # till has to show rather than treat as a failure.
  defp status_for("000"), do: :captured
  defp status_for("121"), do: :requires_action
  defp status_for(nil), do: :pending
  defp status_for(_code), do: :failed

  defp endpoint(%Provider{mode: "live"}), do: @live
  defp endpoint(%Provider{}), do: @sandbox

  defp refund_endpoint(provider), do: String.replace(endpoint(provider), "DoTransaction", "DoRefund")

  defp status_endpoint(provider),
    do: String.replace(endpoint(provider), "DoTransaction", "DoInquiry")

  defp json_headers, do: [{"content-type", "application/json"}]

  defp stamp(datetime), do: Calendar.strftime(datetime, "%Y%m%d%H%M%S")

  defp decode(body) when is_map(body), do: {:ok, body}

  defp decode(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, decoded} when is_map(decoded) -> {:ok, decoded}
      _other -> {:error, :payload_malformed}
    end
  end

  defp decode(_body), do: {:error, :payload_malformed}

  defp blank?(nil), do: true
  defp blank?(""), do: true
  defp blank?(value) when is_binary(value), do: String.trim(value) == ""
  defp blank?(_value), do: false
end
