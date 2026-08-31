defmodule Kaarobar.Fiscal.Adapters.Generic do
  @moduledoc """
  The shape most e-invoicing schemes take.

  Post a document as JSON, get back an identifier and usually a QR payload.
  Saudi ZATCA, the UAE's scheme, several EU clearance models and most national
  pilots all reduce to that; only the field names and the endpoint differ.

  ## Why one adapter and not one per country

  Writing a country adapter for a scheme nobody has yet asked for means
  guessing its field names, and a guessed field name is a rejected invoice that
  looks like working code. This one posts a documented, self-describing payload
  and reads the answer from whichever of the usual keys is present — enough to
  integrate against a middleware or a service provider today, and an honest
  starting point for a real country adapter when there is a real specification
  to write it against.

  A scheme that needs signed XML, a device certificate or a clearance handshake
  needs its own adapter. This one does not pretend otherwise.
  """

  @behaviour Kaarobar.Fiscal.Adapter

  alias Kaarobar.Fiscal.Config
  alias Kaarobar.Fiscal.HTTP

  # The keys these schemes use for "here is your number", in the order worth
  # trying. Checked in order so a payload carrying several is read predictably.
  @number_keys ~w(fiscal_number fiscalNumber invoice_number invoiceNumber uuid id reference)
  @qr_keys ~w(qr qr_payload qrPayload qr_code qrCode)
  @reference_keys ~w(reference authority_reference clearance_id submission_id)
  @status_keys ~w(status result state)
  @accepted_values ~w(accepted approved cleared success succeeded ok reported valid)
  @rejected_values ~w(rejected refused invalid failed error declined)

  @impl true
  def reports_reversals?, do: true

  @impl true
  def submit(%Config{} = config, document) do
    case endpoint(config) do
      nil ->
        # Not a network failure worth retrying: nobody has said where to send
        # it, and no number of attempts discovers an address.
        {:rejected,
         %{
           code: "no_endpoint",
           message: "no endpoint_url is configured for this fiscal integration",
           raw: %{}
         }}

      url ->
        case HTTP.post_json(url, build_payload(config, document), headers(config)) do
          {:ok, body} -> interpret(body)
          {:error, reason} -> {:failed, reason}
        end
    end
  end

  @impl true
  def build_payload(%Config{} = config, document) do
    %{
      "document_type" => document.kind,
      "document_number" => document.number,
      "issued_at" => DateTime.to_iso8601(document.issued_at),
      "currency" => document.currency,
      "seller" => %{
        "taxpayer_number" => config.taxpayer_number,
        "pos_id" => config.pos_id
      },
      "buyer" => buyer(document),
      "totals" => %{
        "subtotal" => money(document.subtotal),
        "tax_total" => money(document.tax_total),
        "discount_total" => money(Map.get(document, :discount_total)),
        "total" => money(document.total)
      },
      "references" => %{
        "original_fiscal_number" => Map.get(document, :original_fiscal_number)
      },
      "lines" => Enum.map(document.lines, &line/1)
    }
  end

  defp line(item) do
    %{
      "sku" => Map.get(item, :sku),
      "name" => Map.get(item, :name),
      "tax_code" => Map.get(item, :tax_code),
      "quantity" => money(Map.get(item, :quantity)),
      "unit_price" => money(Map.get(item, :unit_price)),
      "discount_total" => money(Map.get(item, :discount_total)),
      "net_total" => money(Map.get(item, :net_total)),
      "tax_rate" => money(Map.get(item, :tax_rate)),
      "tax_total" => money(Map.get(item, :tax_total)),
      "line_total" => money(Map.get(item, :line_total))
    }
  end

  defp buyer(document) do
    case Map.get(document, :buyer) do
      nil ->
        nil

      buyer ->
        %{
          "name" => Map.get(buyer, :name),
          "tax_number" => Map.get(buyer, :tax_number),
          "national_id" => Map.get(buyer, :national_id),
          "phone" => Map.get(buyer, :phone),
          "address" => Map.get(buyer, :address)
        }
    end
  end

  # Money goes over as a string, the way this platform serialises it
  # everywhere else. A float would round somebody's tax at the JSON layer.
  defp money(nil), do: nil
  defp money(%Decimal{} = value), do: Decimal.to_string(value, :normal)
  defp money(value), do: to_string(value)

  # --------------------------------------------------------------- response

  defp interpret(body) do
    number = first_value(body, @number_keys)
    status = body |> first_value(@status_keys) |> normalise_status()

    cond do
      status == :rejected ->
        {:rejected, %{code: code(body), message: message(body), raw: body}}

      is_binary(number) and number != "" ->
        {:accepted,
         %{
           fiscal_number: number,
           qr_payload: first_value(body, @qr_keys),
           authority_reference: first_value(body, @reference_keys),
           raw: body
         }}

      status == :accepted ->
        # Cleared, but with nothing the receipt can print. Treated as a
        # rejection rather than an acceptance because the alternative is
        # stamping an invoice with a number that does not exist.
        {:rejected,
         %{
           code: "no_fiscal_number",
           message: "the authority accepted the document but returned no fiscal number",
           raw: body
         }}

      true ->
        {:rejected, %{code: code(body), message: message(body), raw: body}}
    end
  end

  defp normalise_status(nil), do: :unknown

  defp normalise_status(value) do
    downcased = value |> to_string() |> String.downcase()

    cond do
      downcased in @accepted_values -> :accepted
      downcased in @rejected_values -> :rejected
      true -> :unknown
    end
  end

  defp code(body) do
    case first_value(body, ~w(code error_code errorCode)) do
      nil -> nil
      value -> to_string(value)
    end
  end

  defp message(body) do
    case first_value(body, ~w(message error errors detail description)) do
      nil -> "the authority did not return a fiscal number"
      value -> stringify(value)
    end
  end

  defp stringify(value) when is_binary(value), do: value
  defp stringify(value) when is_list(value), do: Enum.map_join(value, "; ", &stringify/1)
  defp stringify(value), do: inspect(value)

  # These payloads nest as often as they do not, so the usual keys are looked
  # for one level down as well before giving up on them.
  defp first_value(body, keys) when is_map(body) do
    Enum.find_value(keys, fn key ->
      case Map.get(body, key) do
        nil -> nested(body, key)
        value -> value
      end
    end)
  end

  defp first_value(_body, _keys), do: nil

  defp nested(body, key) do
    Enum.find_value(["data", "result", "invoice", "response"], fn wrapper ->
      case Map.get(body, wrapper) do
        %{} = inner -> Map.get(inner, key)
        _other -> nil
      end
    end)
  end

  defp endpoint(%Config{endpoint_url: url}) when is_binary(url) and url != "", do: url
  defp endpoint(%Config{}), do: nil

  defp headers(%Config{} = config) do
    base = [{"content-type", "application/json"}]

    case Config.credential(config, "token") || Config.credential(config, "api_key") do
      nil -> base
      token -> [{"authorization", "Bearer " <> token} | base]
    end
  end
end
