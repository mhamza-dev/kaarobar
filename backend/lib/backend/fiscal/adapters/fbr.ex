defmodule Kaarobar.Fiscal.Adapters.FBR do
  @moduledoc """
  Pakistan's FBR real-time POS invoice regime.

  A registered retailer posts every invoice to the FBR as it is issued and gets
  back an invoice number that must be printed on the receipt, alongside a QR
  code encoding it. A receipt without that number is not a valid tax invoice.

  ## Their "success" is not HTTP's success

  The FBR answers `200` with `{"Code": "100", "Response": "..."}` for a
  rejection just as readily as for an acceptance. Reading the status line would
  mark a refused invoice as filed — which is the worst outcome available here,
  because the shop would print a stamp that does not exist and believe itself
  compliant. So acceptance is decided by the body: a code of `"100"` and an
  invoice number, or it did not happen.

  ## The USIN is ours, the invoice number is theirs

  The USIN is the shop's own unique identifier for the sale and is what makes a
  retry idempotent at their end — resending the same USIN after a timeout
  returns the original invoice number rather than filing a second one. So it is
  derived from the sale number, never regenerated per attempt.

  Field names follow their published schema exactly, capitals and all. They are
  ugly and they are not ours to tidy: a renamed key is a rejected invoice.
  """

  @behaviour Kaarobar.Fiscal.Adapter

  alias Kaarobar.Fiscal.Config
  alias Kaarobar.Fiscal.HTTP

  # Defaults only. The FBR has moved these paths before and will again, so a
  # configuration may override them with `endpoint_url` without a deploy — a
  # hard-coded URL is otherwise the thing that takes a whole tenant offline.
  @sandbox_url "https://gw.fbr.gov.pk/imsp/v1/api/Sandbox/PostData"
  @live_url "https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData"

  # The one code that means the FBR took it.
  @accepted_code "100"

  @impl true
  def reports_reversals?, do: true

  @impl true
  def submit(%Config{} = config, document) do
    payload = build_payload(config, document)

    case HTTP.post_json(endpoint(config), payload, headers(config)) do
      {:ok, body} -> interpret(body)
      {:error, reason} -> {:failed, reason}
    end
  end

  @impl true
  def build_payload(%Config{} = config, document) do
    %{
      "InvoiceNumber" => Map.get(document, :original_fiscal_number),
      "POSID" => config.pos_id,
      "USIN" => usin(document),
      "DateTime" => format_datetime(document.issued_at),
      "BuyerNTN" => buyer_field(document, :tax_number),
      "BuyerCNIC" => buyer_field(document, :national_id),
      "BuyerName" => buyer_field(document, :name),
      "BuyerPhoneNumber" => buyer_field(document, :phone),
      "TotalBillAmount" => amount(document.total),
      "TotalQuantity" => amount(total_quantity(document)),
      "TotalSaleValue" => amount(document.subtotal),
      "TotalTaxCharged" => amount(document.tax_total),
      "Discount" => amount(Map.get(document, :discount_total)),
      "FurtherTax" => amount(Map.get(document, :further_tax)),
      "PaymentMode" => payment_mode(document),
      "RefUSIN" => Map.get(document, :original_usin),
      "InvoiceType" => invoice_type(document),
      "Items" => Enum.map(document.lines, &line/1)
    }
  end

  # ------------------------------------------------------------------ payload

  defp line(item) do
    %{
      "ItemCode" => Map.get(item, :sku),
      "ItemName" => Map.get(item, :name),
      "PCTCode" => Map.get(item, :tax_code),
      "Quantity" => amount(Map.get(item, :quantity)),
      "TaxRate" => amount(Map.get(item, :tax_rate)),
      "SaleValue" => amount(Map.get(item, :net_total)),
      "TotalAmount" => amount(Map.get(item, :line_total)),
      "TaxCharged" => amount(Map.get(item, :tax_total)),
      "Discount" => amount(Map.get(item, :discount_total)),
      "FurtherTax" => amount(Map.get(item, :further_tax)),
      "InvoiceType" => 1,
      "RefUSIN" => nil
    }
  end

  # Their gateway is stricter about types than about values: a decimal struct
  # serialises as a JSON object and is rejected outright, so every money field
  # goes over as a number.
  defp amount(nil), do: 0
  defp amount(%Decimal{} = value), do: value |> Decimal.round(2) |> Decimal.to_float()
  defp amount(value) when is_number(value), do: value

  defp total_quantity(document) do
    document.lines
    |> Enum.map(&(Map.get(&1, :quantity) || Decimal.new(0)))
    |> Enum.reduce(Decimal.new(0), &Decimal.add/2)
  end

  # Their identifier for the sale, and what makes a retry safe: the same USIN
  # resent after a timeout returns the original invoice rather than filing a
  # second one. Derived, so it cannot drift between attempts.
  defp usin(document), do: document.number

  defp buyer_field(document, key) do
    case Map.get(document, :buyer) do
      nil -> nil
      buyer -> Map.get(buyer, key)
    end
  end

  # 1 = new invoice, 3 = debit/credit note against an earlier one.
  defp invoice_type(%{kind: kind}) when kind in ["refund", "credit_note", "void"], do: 3
  defp invoice_type(_document), do: 1

  defp payment_mode(document) do
    case Map.get(document, :payment_mode) do
      "cash" -> 1
      "card" -> 2
      "gift_card" -> 3
      "bank" -> 4
      "cheque" -> 5
      "credit" -> 6
      _other -> 1
    end
  end

  # They want local wall-clock time in their own format, not an ISO instant.
  defp format_datetime(%DateTime{} = at) do
    at
    |> DateTime.truncate(:second)
    |> Calendar.strftime("%Y-%m-%d %H:%M:%S")
  end

  # ----------------------------------------------------------------- response

  # Acceptance is a code and a number together. A "success" carrying no invoice
  # number is nothing the shop can print, so it is not an acceptance.
  defp interpret(body) do
    code = to_string(body["Code"] || body["code"] || "")
    number = body["InvoiceNumber"] || body["invoiceNumber"]

    cond do
      code == @accepted_code and is_binary(number) and number != "" ->
        {:accepted,
         %{
           fiscal_number: number,
           qr_payload: number,
           authority_reference: body["Response"] || body["response"],
           raw: body
         }}

      code == "" and is_binary(number) and number != "" ->
        # Some sandbox deployments answer with the number and no code at all.
        {:accepted,
         %{fiscal_number: number, qr_payload: number, authority_reference: nil, raw: body}}

      true ->
        {:rejected, %{code: nullify(code), message: message(body), raw: body}}
    end
  end

  # Their message is kept because it names the field to correct, but it arrives
  # as a string, a list of errors or a map depending on which validator refused
  # it — and `last_error` is a text column.
  defp message(body) do
    raw =
      body["Response"] || body["response"] || body["Errors"] || body["errors"] ||
        body["message"] || "the authority did not accept the invoice"

    stringify(raw)
  end

  defp stringify(value) when is_binary(value), do: value
  defp stringify(value) when is_list(value), do: Enum.map_join(value, "; ", &stringify/1)
  defp stringify(value), do: inspect(value)

  defp nullify(""), do: nil
  defp nullify(code), do: code

  defp endpoint(%Config{endpoint_url: url}) when is_binary(url) and url != "", do: url
  defp endpoint(%Config{mode: "live"}), do: @live_url
  defp endpoint(%Config{}), do: @sandbox_url

  defp headers(%Config{} = config) do
    token = Config.credential(config, "token") || Config.credential(config, "bearer_token") || ""

    [{"authorization", "Bearer " <> token}, {"content-type", "application/json"}]
  end
end
