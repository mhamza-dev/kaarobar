defmodule Kaarobar.Payments.Adapters.Easypaisa do
  @moduledoc """
  Mobile wallet payments through Easypaisa.

  The same shape as JazzCash — a merchant account, a hashed request, a prompt
  on the customer's phone — but a different hash construction, so the two
  cannot share code without one of them being subtly wrong.

  ## The hash covers a fixed field order, not a sorted one

  Easypaisa signs a defined sequence of fields rather than everything sorted.
  Sorting them, as JazzCash requires, produces a hash the gateway rejects with
  a generic error. `signature/2` is public because that difference is exactly
  the kind of thing that is discovered in production otherwise.
  """

  @behaviour Kaarobar.Payments.Gateway

  alias Kaarobar.Payments.HTTP
  alias Kaarobar.Payments.Provider

  @sandbox "https://easypaystg.easypaisa.com.pk/easypay-service/rest/v4/initiate-ma-transaction"
  @live "https://easypay.easypaisa.com.pk/easypay-service/rest/v4/initiate-ma-transaction"

  # The order Easypaisa hashes in. Fixed, not sorted.
  @signed_fields ~w(amount orderId storeId mobileAccountNo emailAddress)

  @impl true
  def create_charge(%Provider{} = provider, params) do
    fields = %{
      "storeId" => Provider.credential(provider, "store_id"),
      "orderId" => params.reference,
      "transactionType" => "MA",
      "amount" => to_rupees(params.amount),
      "mobileAccountNo" => Map.get(params, :customer_phone) || "",
      "emailAddress" => Map.get(params, :customer_email) || ""
    }

    body = Map.put(fields, "signature", signature(provider, fields))

    case HTTP.post_json(provider, endpoint(provider), body, headers(provider)) do
      {:ok, response} -> {:ok, to_result(response, params)}
      {:error, reason} -> {:error, reason}
    end
  end

  @impl true
  def capture(%Provider{}, external_id, amount),
    do: {:ok, %{status: :captured, external_id: external_id, amount: amount}}

  @impl true
  def refund(%Provider{}, _external_id, _amount), do: {:error, :not_supported}

  @impl true
  def void(%Provider{}, _external_id), do: {:error, :not_supported}

  @impl true
  def fetch_status(%Provider{} = provider, external_id) do
    url = "#{inquiry_endpoint(provider)}?orderId=#{external_id}"

    case HTTP.get(provider, url, headers(provider)) do
      {:ok, response} ->
        {:ok,
         %{
           status: status_for(Map.get(response, "responseCode")),
           external_id: external_id,
           provider_status: Map.get(response, "responseCode"),
           failure_message: Map.get(response, "responseDesc"),
           raw: response
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def verify_webhook(%Provider{} = provider, raw_body, _headers) do
    with {:ok, payload} <- decode(raw_body),
         supplied when is_binary(supplied) <- Map.get(payload, "signature"),
         expected <- signature(provider, payload),
         true <- Plug.Crypto.secure_compare(supplied, expected) do
      {:ok, payload}
    else
      nil -> {:error, :signature_missing}
      false -> {:error, :signature_invalid}
      {:error, reason} -> {:error, reason}
    end
  end

  @impl true
  def parse_event(%{"orderId" => order_id} = payload) do
    code = Map.get(payload, "responseCode")

    {:ok,
     %{
       external_id: order_id,
       type: "easypaisa.transaction",
       result: %{
         status: status_for(code),
         external_id: order_id,
         provider_status: code,
         failure_code: if(code != "0000", do: code),
         failure_message: Map.get(payload, "responseDesc"),
         wallet_msisdn: Map.get(payload, "mobileAccountNo"),
         raw: payload
       }
     }}
  end

  def parse_event(_payload), do: {:ok, nil}

  @impl true
  def supports_capture?, do: false

  @impl true
  def supports_refund?, do: false

  @doc """
  The request signature, over a fixed field order.

  Public because the fixed order is the difference from JazzCash, and getting
  it wrong yields a gateway error that explains nothing.
  """
  @spec signature(Provider.t(), map()) :: String.t()
  def signature(%Provider{} = provider, fields) do
    secret = Provider.credential(provider, "hash_key") || ""

    payload =
      @signed_fields
      |> Enum.map(&to_string(Map.get(fields, &1, "")))
      |> Enum.join("&")

    :hmac
    |> :crypto.mac(:sha256, secret, payload)
    |> Base.encode64()
  end

  @doc "Easypaisa wants rupees with two decimal places, as text."
  @spec to_rupees(Decimal.t()) :: String.t()
  def to_rupees(%Decimal{} = amount), do: amount |> Decimal.round(2) |> Decimal.to_string(:normal)

  defp to_result(response, params) do
    code = Map.get(response, "responseCode")

    %{
      status: status_for(code),
      external_id: Map.get(response, "orderId", params.reference),
      checkout_url: Map.get(response, "paymentToken") && redirect_url(response),
      amount: params.amount,
      provider_status: code,
      failure_message: Map.get(response, "responseDesc"),
      raw: response
    }
  end

  defp redirect_url(response), do: Map.get(response, "redirectUrl")

  # 0000 is success. 0001 means the customer has been prompted on their phone
  # and has not answered, which the till has to show rather than call a failure.
  defp status_for("0000"), do: :captured
  defp status_for("0001"), do: :requires_action
  defp status_for(nil), do: :pending
  defp status_for(_code), do: :failed

  defp endpoint(%Provider{mode: "live"}), do: @live
  defp endpoint(%Provider{}), do: @sandbox

  defp inquiry_endpoint(provider),
    do: String.replace(endpoint(provider), "initiate-ma-transaction", "inquire-transaction")

  defp headers(%Provider{} = provider) do
    [
      {"content-type", "application/json"},
      {"credentials", Provider.credential(provider, "credentials") || ""}
    ]
  end

  defp decode(body) when is_map(body), do: {:ok, body}

  defp decode(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, decoded} when is_map(decoded) -> {:ok, decoded}
      _other -> {:error, :payload_malformed}
    end
  end

  defp decode(_body), do: {:error, :payload_malformed}
end
