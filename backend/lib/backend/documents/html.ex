defmodule Kaarobar.Documents.Html do
  @moduledoc """
  A receipt as a page a browser can print.

  What every client that is not driving a thermal printer uses: a browser
  printing to an office printer, a PDF for emailing, the preview a shopkeeper
  looks at before committing to paper.

  ## Self-contained on purpose

  One file, inline styles, no external stylesheet and no web font. A shop's
  connection drops, and a document that waits on a font from a CDN either
  prints in the wrong face or does not print at all — and Urdu is exactly the
  case where the fallback is unreadable rather than merely different. The font
  stack names faces from all three desktop platforms instead.

  ## Escaping

  Every value goes through `escape/1`. A product named `Bolt & Nut <10mm>` is
  ordinary shop data, and a receipt is not a place to discover that a name can
  close a tag.
  """

  alias Kaarobar.Documents.Labels
  alias Kaarobar.Documents.Receipt
  alias Kaarobar.Money

  @doc """
  Renders the receipt as a complete HTML document.

  `:paper` picks the layout: a roll width lays out one narrow column the way a
  thermal receipt reads, and `A4`/`Letter` gets the full-page invoice.
  """
  @spec render(Receipt.t(), keyword()) :: String.t()
  def render(%Receipt{} = receipt, opts \\ []) do
    paper = Keyword.get(opts, :paper, "80mm")

    """
    <!doctype html>
    <html lang="#{receipt.language}" dir="#{receipt.direction}">
    <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>#{escape(receipt.number)}</title>
    <style>#{styles(receipt, paper)}</style>
    </head>
    <body>
    <main class="doc">
    #{header(receipt)}
    #{meta(receipt)}
    #{lines(receipt)}
    #{totals(receipt)}
    #{tenders(receipt)}
    #{fiscal(receipt)}
    #{footer(receipt)}
    </main>
    </body>
    </html>
    """
  end

  # ------------------------------------------------------------------ sections

  defp header(%Receipt{} = receipt) do
    """
    <header class="head">
      #{tag(:h1, receipt.business_name, "shop")}
      #{tag(:p, receipt.branch_name, "muted")}
      #{tag(:p, receipt.branch_address, "muted")}
      #{phone(receipt)}
      #{tag(:p, receipt.header_note, "note")}
      #{tag(:h2, receipt.title, "title")}
    </header>
    """
  end

  defp meta(%Receipt{} = receipt) do
    rows =
      [
        {receipt.labels.invoice, receipt.number},
        {receipt.labels.date, timestamp(receipt.sold_at)},
        {receipt.labels.customer, receipt.customer_name},
        {receipt.labels.cashier, receipt.cashier_name}
      ]
      |> Enum.reject(fn {_label, value} -> value in [nil, ""] end)
      |> Enum.map_join("\n", fn {label, value} ->
        "<div><dt>#{escape(label)}</dt><dd>#{escape(value)}</dd></div>"
      end)

    "<dl class=\"meta\">#{rows}</dl>"
  end

  defp lines(%Receipt{} = receipt) do
    rows =
      Enum.map_join(receipt.lines, "\n", fn item ->
        """
        <tr>
          <td class="name">
            #{escape(item.name)}
            <span class="sub">#{quantity_line(item, receipt)}</span>
            #{discount_note(item, receipt)}
          </td>
          <td class="amount">#{money(item.line_total, receipt)}</td>
        </tr>
        """
      end)

    """
    <table class="lines">
      <thead>
        <tr>
          <th>#{escape(receipt.labels.description)}</th>
          <th class="amount">#{escape(receipt.labels.total)}</th>
        </tr>
      </thead>
      <tbody>#{rows}</tbody>
    </table>
    """
  end

  defp totals(%Receipt{totals: totals} = receipt) do
    rows =
      [
        {receipt.labels.subtotal, money(totals.subtotal, receipt), false},
        discount_row(receipt),
        {receipt.labels.total, money(totals.total, receipt), true}
      ]
      |> Enum.reject(&is_nil/1)

    tax_rows =
      Enum.map(receipt.taxes, fn tax ->
        {tax_label(tax), money(tax.amount, receipt), false}
      end)

    body =
      (Enum.take(rows, 2) ++ tax_rows ++ Enum.drop(rows, 2))
      |> Enum.map_join("\n", fn {label, value, strong} ->
        class = if strong, do: " class=\"grand\"", else: ""
        "<tr#{class}><td>#{escape(label)}</td><td class=\"amount\">#{value}</td></tr>"
      end)

    "<table class=\"totals\">#{body}</table>"
  end

  defp tenders(%Receipt{payments: []}), do: ""

  defp tenders(%Receipt{} = receipt) do
    rows =
      Enum.map_join(receipt.payments, "\n", fn payment ->
        row(payment.label, money(payment.amount, receipt))
      end)

    change =
      if Money.positive?(receipt.totals.change || Money.zero()) do
        row(receipt.labels.change, money(receipt.totals.change, receipt))
      else
        ""
      end

    "<table class=\"totals tenders\">#{rows}#{change}</table>"
  end

  # The stamp. Printed as text, not as a QR image: the payload is the
  # authority's own string, and a shop asked to prove what it declared should
  # be able to read it off the paper rather than scan it.
  defp fiscal(%Receipt{fiscal_number: nil}), do: ""

  defp fiscal(%Receipt{} = receipt) do
    """
    <section class="fiscal">
      #{tag(:p, receipt.fiscal_number, "fiscal-no")}
      #{tag(:p, receipt.fiscal_qr_payload, "fiscal-qr")}
    </section>
    """
  end

  defp footer(%Receipt{} = receipt) do
    """
    <footer class="foot">
      #{tag(:p, receipt.footer_note, "note")}
      #{tag(:p, receipt.labels.thank_you, "thanks")}
      #{tag(:p, receipt.labels.powered_by, "muted small")}
    </footer>
    """
  end

  # -------------------------------------------------------------------- styles

  defp styles(%Receipt{} = receipt, paper) do
    """
    :root { color-scheme: light }
    * { box-sizing: border-box }
    body {
      margin: 0;
      background: #fff;
      color: #000;
      font-family: #{Labels.font_stack(receipt.language)};
      font-size: #{if roll?(paper), do: "12px", else: "13px"};
      line-height: 1.45;
    }
    .doc {
      width: #{width_for(paper)};
      margin: 0 auto;
      padding: #{if roll?(paper), do: "6px 8px", else: "24px"};
    }
    .head { text-align: center }
    .shop { margin: 0; font-size: 1.5em; font-weight: 700; letter-spacing: -0.01em }
    .title { margin: 10px 0 0; font-size: 1.05em; text-transform: uppercase; letter-spacing: 0.08em }
    .muted { margin: 2px 0; color: #444 }
    .small { font-size: 0.85em }
    .note { margin: 8px 0; white-space: pre-line }
    .meta { display: grid; gap: 2px; margin: 12px 0; padding: 8px 0; border-block: 1px dashed #999 }
    .meta div { display: flex; justify-content: space-between; gap: 12px }
    .meta dt { margin: 0; color: #444 }
    .meta dd { margin: 0; font-weight: 600 }
    table { width: 100%; border-collapse: collapse }
    .lines th {
      text-align: start; font-size: 0.85em; text-transform: uppercase;
      letter-spacing: 0.06em; color: #444; padding-bottom: 4px;
    }
    .lines td { vertical-align: top; padding: 5px 0; border-bottom: 1px solid #eee }
    .name .sub { display: block; color: #444; font-size: 0.9em }
    .name .off { display: block; color: #444; font-size: 0.9em }
    /* Right in a left-to-right document, left in a right-to-left one. Money
       belongs on the outside edge either way, which is what `end` means. */
    .amount { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums }
    .totals { margin-top: 10px }
    .totals td { padding: 3px 0 }
    .grand td { border-top: 1px solid #000; padding-top: 6px; font-size: 1.15em; font-weight: 700 }
    .tenders { border-top: 1px dashed #999; margin-top: 8px; padding-top: 6px }
    .fiscal {
      margin-top: 12px; padding-top: 8px; border-top: 1px dashed #999;
      text-align: center; word-break: break-all;
    }
    .fiscal-no { margin: 0; font-weight: 700 }
    .fiscal-qr { margin: 4px 0 0; font-size: 0.8em; color: #444 }
    .foot { margin-top: 14px; text-align: center }
    .thanks { margin: 8px 0 0; font-weight: 700; letter-spacing: 0.06em }
    @media print {
      /* The roll has no margins to speak of; a sheet keeps the driver's. */
      @page { margin: #{if roll?(paper), do: "0", else: "12mm"} }
      body { print-color-adjust: exact }
    }
    """
  end

  # ------------------------------------------------------------------ helpers

  defp quantity_line(item, receipt) do
    "#{escape(Money.to_string(item.quantity))} × #{money(item.unit_price, receipt)}"
  end

  defp row(label, value) do
    "<tr><td>#{escape(label)}</td><td class=\"amount\">#{value}</td></tr>"
  end

  defp discount_note(%{discount: discount}, receipt) do
    if Money.positive?(discount || Money.zero()) do
      "<span class=\"off\">#{escape(receipt.labels.discount)} −#{money(discount, receipt)}</span>"
    else
      ""
    end
  end

  defp discount_row(%Receipt{totals: totals} = receipt) do
    if Money.positive?(totals.discount || Money.zero()) do
      {receipt.labels.discount, "−" <> money(totals.discount, receipt), false}
    end
  end

  defp tax_label(%{label: label, rate: rate}) when not is_nil(rate) do
    percent = rate |> Decimal.mult(100) |> Decimal.normalize() |> Decimal.to_string(:normal)
    "#{label} #{percent}%"
  end

  defp tax_label(%{label: label}), do: label

  defp phone(%Receipt{branch_phone: nil}), do: ""

  defp phone(%Receipt{} = receipt),
    do: tag(:p, "#{receipt.labels.tel}: #{receipt.branch_phone}", "muted")

  defp tag(_name, nil, _class), do: ""
  defp tag(_name, "", _class), do: ""

  defp tag(name, value, class),
    do: "<#{name} class=\"#{class}\">#{escape(value)}</#{name}>"

  defp money(nil, _receipt), do: ""
  defp money(amount, %Receipt{currency: currency}), do: escape(Money.to_string(amount, currency))

  defp timestamp(nil), do: nil

  defp timestamp(%DateTime{} = at),
    do: at |> DateTime.truncate(:second) |> Calendar.strftime("%Y-%m-%d %H:%M")

  defp roll?(paper), do: paper not in ["A4", "Letter"]

  defp width_for("58mm"), do: "58mm"
  defp width_for("76mm"), do: "76mm"
  defp width_for("80mm"), do: "80mm"
  defp width_for(_sheet), do: "100%"

  # Every value a shop can type. `Bolt & Nut <10mm>` is ordinary stock, and a
  # receipt is not where anyone should discover a product name can close a tag.
  defp escape(value) do
    value
    |> to_string()
    |> String.replace("&", "&amp;")
    |> String.replace("<", "&lt;")
    |> String.replace(">", "&gt;")
    |> String.replace("\"", "&quot;")
    |> String.replace("'", "&#39;")
  end
end
