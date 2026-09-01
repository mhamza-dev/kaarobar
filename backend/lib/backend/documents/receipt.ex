defmodule Kaarobar.Documents.Receipt do
  @moduledoc """
  A sale, in the shape a receipt needs — before anything decides how to draw it.

  ## One model, two renderers

  The HTML page and the ESC/POS byte stream are the same document rendered two
  ways, and they must agree. Building each from the sale independently is how
  the printed receipt and the emailed one end up disagreeing about a total, and
  the customer holding both is the one who finds out.

  So this assembles the facts once, and `Documents.Html` and `Documents.EscPos`
  only lay them out.

  ## Everything is a snapshot

  Names, prices, taxes and the fiscal stamp all come from what the sale itself
  recorded. A receipt reprinted in two years has to show what was charged on
  the day, not what today's catalogue would charge for the same basket.
  """

  alias Kaarobar.Documents.Labels
  alias Kaarobar.Money
  alias Kaarobar.Sales.Sale

  @enforce_keys [:number, :sold_at, :currency, :lines, :totals, :language]
  defstruct [
    :number,
    :sold_at,
    :currency,
    :lines,
    :totals,
    :language,
    :labels,
    :direction,
    :title,
    :business_name,
    :branch_name,
    :branch_address,
    :branch_phone,
    :customer_name,
    :cashier_name,
    :header_note,
    :footer_note,
    :fiscal_number,
    :fiscal_qr_payload,
    payments: [],
    taxes: []
  ]

  @type t :: %__MODULE__{}

  @doc """
  Builds the document from a loaded sale.

  Expects `items` (with `taxes`), `payments`, `customer`, `cashier`, `branch`
  and `business` preloaded — deliberately, rather than querying here. A
  renderer that quietly issues queries is one that gets slow inside a loop
  nobody remembers writing.
  """
  @spec build(Sale.t(), keyword()) :: t()
  def build(%Sale{} = sale, opts \\ []) do
    business = sale.business
    language = Labels.normalize(Keyword.get(opts, :language) || document_language(business))
    labels = Labels.sale(language)

    %__MODULE__{
      number: sale.number,
      sold_at: sale.sold_at,
      currency: sale.currency,
      language: language,
      labels: labels,
      direction: Labels.direction(language),
      title: title_for(sale, labels),
      business_name: business && business.name,
      branch_name: sale.branch && sale.branch.name,
      branch_address: branch_address(sale.branch),
      branch_phone: sale.branch && sale.branch.phone,
      customer_name: customer_name(sale),
      cashier_name: sale.cashier && sale.cashier.name,
      header_note: receipt_setting(business, "header"),
      footer_note: receipt_setting(business, "footer"),
      # In most fiscal regimes the receipt is not a valid tax invoice without
      # these, so they are part of the document rather than an afterthought.
      fiscal_number: sale.fiscal_number,
      fiscal_qr_payload: sale.fiscal_qr_payload,
      lines: Enum.map(loaded(sale.items), &line/1),
      payments: Enum.map(loaded(sale.payments), &payment(&1, labels)),
      taxes: tax_lines(loaded(sale.items)),
      totals: totals(sale)
    }
  end

  @doc "True when the document should be laid out right to left."
  @spec rtl?(t()) :: boolean()
  def rtl?(%__MODULE__{direction: "rtl"}), do: true
  def rtl?(%__MODULE__{}), do: false

  @doc """
  True when this receipt cannot be printed as text by a thermal printer.

  A print head's character generator holds one Latin code page. Urdu, Arabic
  and Chinese all come off it as a row of `?`, so a caller that can raster
  should — see the same decision in `desktop/local`'s `renderReceiptRaster.ts`.
  """
  @spec needs_raster?(t()) :: boolean()
  def needs_raster?(%__MODULE__{} = receipt) do
    rtl?(receipt) or Enum.any?(text_of(receipt), &(not latin?(&1)))
  end

  # ---------------------------------------------------------------- internals

  defp line(item) do
    %{
      name: item.name_snapshot,
      sku: item.sku_snapshot,
      unit: item.unit_snapshot,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount_total,
      line_total: item.line_total,
      note: item.note
    }
  end

  # `to_existing_atom` would raise for a tender the label sets have not been
  # taught yet, which is a crash on the print path over a missing translation.
  # An unknown method prints as itself instead.
  @tender_labels %{
    "cash" => :cash,
    "card" => :card,
    "credit" => :credit,
    "wallet" => :wallet,
    "bank" => :bank
  }

  defp payment(payment, labels) do
    key = Map.get(@tender_labels, payment.method)

    %{
      method: payment.method,
      label: (key && Map.get(labels, key)) || payment.method,
      amount: payment.amount
    }
  end

  # Grouped by rate, because a receipt shows "GST 17%: 340", not one line per
  # item per tax.
  defp tax_lines(items) do
    items
    |> Enum.flat_map(&loaded(&1.taxes))
    |> Enum.group_by(&{&1.label_snapshot || &1.name_snapshot, &1.rate_snapshot})
    |> Enum.map(fn {{label, rate}, taxes} ->
      %{label: label, rate: rate, amount: taxes |> Enum.map(& &1.amount) |> Money.sum()}
    end)
    |> Enum.sort_by(& &1.label)
  end

  defp totals(%Sale{} = sale) do
    %{
      subtotal: sale.subtotal,
      discount: Money.add(sale.discount_total, sale.order_discount),
      tax: sale.tax_total,
      rounding: sale.rounding,
      total: sale.total,
      paid: sale.paid_total,
      change: sale.change_due
    }
  end

  # A credit sale and a cash sale are different pieces of paper as far as the
  # customer is concerned, and the heading is what tells them which they hold.
  defp title_for(%Sale{} = sale, labels) do
    methods = sale |> loaded() |> Enum.map(& &1.method)

    cond do
      "credit" in methods and "cash" not in methods -> labels.credit_receipt
      "card" in methods and "cash" not in methods -> labels.card_receipt
      true -> labels.cash_receipt
    end
  end

  defp loaded(%Sale{payments: payments}), do: loaded(payments)
  defp loaded(%Ecto.Association.NotLoaded{}), do: []
  defp loaded(nil), do: []
  defp loaded(list) when is_list(list), do: list

  defp customer_name(%Sale{customer: %{name: name}}) when is_binary(name), do: name
  defp customer_name(%Sale{}), do: nil

  # The business's own setting, not the caller's Accept-Language. A shop in
  # Karachi prints Urdu receipts whoever pressed print.
  defp document_language(nil), do: :en

  defp document_language(business) do
    receipt_setting(business, "language") || business.default_locale || :en
  end

  defp receipt_setting(nil, _key), do: nil

  defp receipt_setting(business, key) do
    case business.receipt_settings do
      %{} = settings -> Map.get(settings, key)
      _absent -> nil
    end
  end

  # One line, from whichever parts the branch has filled in. A receipt printed
  # with a blank line where the address should be looks like a fault.
  defp branch_address(nil), do: nil

  defp branch_address(branch) do
    [branch.address_line1, branch.address_line2, branch.city]
    |> Enum.reject(&(is_nil(&1) or &1 == ""))
    |> Enum.join(", ")
    |> case do
      "" -> nil
      address -> address
    end
  end

  # Everything a print head would have to spell. The stamp is included: a
  # fiscal number is Latin, but a QR payload need not be.
  defp text_of(%__MODULE__{} = receipt) do
    [
      receipt.business_name,
      receipt.branch_name,
      receipt.branch_address,
      receipt.customer_name,
      receipt.cashier_name,
      receipt.header_note,
      receipt.footer_note
    ] ++
      Enum.map(receipt.lines, & &1.name) ++
      Enum.map(receipt.taxes, & &1.label)
  end

  defp latin?(nil), do: true

  defp latin?(value) when is_binary(value) do
    # Anything a single-byte code page can hold. A print head has no glyph for
    # the rest, and would substitute '?' for every character of it.
    value |> String.to_charlist() |> Enum.all?(&(&1 < 0x100))
  end

  defp latin?(_value), do: true
end
