defmodule Kaarobar.Documents.StatementHtml do
  @moduledoc """
  A customer statement as a printable page.

  Laid out as a ledger — date, particulars, debit, credit, running balance —
  because that is the shape every shopkeeper and every customer in this market
  already reads. A column of movements that adds up to the closing figure is
  what settles an argument at the counter; a single "you owe" number is what
  starts one.

  Sheet paper, always. A statement is a page of history, and nobody wants two
  feet of till roll.
  """

  alias Kaarobar.Documents.Labels
  alias Kaarobar.Documents.Statement
  alias Kaarobar.Money

  @doc "Renders the statement as a complete HTML document."
  @spec render(Statement.t()) :: String.t()
  def render(%Statement{} = statement) do
    """
    <!doctype html>
    <html lang="#{statement.language}" dir="#{statement.direction}">
    <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>#{escape(statement.customer_name)}</title>
    <style>#{styles(statement)}</style>
    </head>
    <body>
    <main class="doc">
    #{header(statement)}
    #{summary(statement)}
    #{ledger(statement)}
    #{footer(statement)}
    </main>
    </body>
    </html>
    """
  end

  defp header(%Statement{} = statement) do
    """
    <header class="head">
      <div>
        #{tag(:h1, statement.business_name, "shop")}
        #{tag(:p, statement.branch_name, "muted")}
        #{phone(statement.branch_phone, statement)}
      </div>
      <div class="who">
        #{tag(:h2, statement.customer_name, "customer")}
        #{tag(:p, statement.customer_phone, "muted")}
        #{period(statement)}
      </div>
    </header>
    """
  end

  defp summary(%Statement{} = statement) do
    cards =
      [
        {statement.labels.total, money(statement.balance, statement), true},
        {statement.labels.paid, money(statement.available_credit, statement), false}
      ]
      |> Enum.map_join("\n", fn {label, value, strong} ->
        class = if strong, do: "card strong", else: "card"
        "<div class=\"#{class}\"><span>#{escape(label)}</span><b>#{value}</b></div>"
      end)

    "<section class=\"cards\">#{cards}</section>"
  end

  defp ledger(%Statement{entries: []} = statement) do
    "<p class=\"empty\">#{escape(statement.labels.description)}</p>"
  end

  defp ledger(%Statement{} = statement) do
    rows =
      Enum.map_join(statement.entries, "\n", fn entry ->
        """
        <tr>
          <td>#{escape(date(entry.occurred_at))}</td>
          <td>#{escape(entry.note || entry.kind)}</td>
          <td class="amount">#{money(entry.debit, statement)}</td>
          <td class="amount">#{money(entry.credit, statement)}</td>
          <td class="amount balance">#{money(entry.balance_after, statement)}</td>
        </tr>
        """
      end)

    """
    <table class="ledger">
      <thead>
        <tr>
          <th>#{escape(statement.labels.date)}</th>
          <th>#{escape(statement.labels.description)}</th>
          <th class="amount">#{escape(statement.labels.total)}</th>
          <th class="amount">#{escape(statement.labels.paid)}</th>
          <th class="amount">#{escape(statement.labels.subtotal)}</th>
        </tr>
      </thead>
      <tbody>#{rows}</tbody>
    </table>
    """
  end

  defp footer(%Statement{} = statement) do
    """
    <footer class="foot">
      #{tag(:p, statement.labels.powered_by, "muted small")}
      #{tag(:p, date(statement.printed_at), "muted small")}
    </footer>
    """
  end

  defp styles(%Statement{} = statement) do
    """
    :root { color-scheme: light }
    * { box-sizing: border-box }
    body {
      margin: 0; background: #fff; color: #000;
      font-family: #{Labels.font_stack(statement.language)};
      font-size: 13px; line-height: 1.5;
    }
    .doc { max-width: 900px; margin: 0 auto; padding: 24px }
    .head { display: flex; flex-wrap: wrap; gap: 24px; justify-content: space-between }
    .shop { margin: 0; font-size: 1.5em; font-weight: 700 }
    .customer { margin: 0; font-size: 1.15em; font-weight: 700 }
    .who { text-align: end }
    .muted { margin: 2px 0; color: #444 }
    .small { font-size: 0.85em }
    .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 0 }
    .card {
      flex: 1 1 160px; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px;
      display: flex; flex-direction: column; gap: 2px;
    }
    .card span { color: #444; font-size: 0.85em }
    .card b { font-size: 1.2em; font-variant-numeric: tabular-nums }
    .card.strong { border-color: #000 }
    table { width: 100%; border-collapse: collapse }
    .ledger th {
      text-align: start; font-size: 0.85em; text-transform: uppercase;
      letter-spacing: 0.05em; color: #444; border-bottom: 1px solid #000; padding: 6px 4px;
    }
    .ledger td { padding: 6px 4px; border-bottom: 1px solid #eee; vertical-align: top }
    /* Outside edge in both directions: money belongs there whichever way the
       page reads. */
    .amount { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums }
    .balance { font-weight: 600 }
    .empty { color: #444 }
    .foot { margin-top: 24px; text-align: center }
    @media print { @page { margin: 14mm } }
    """
  end

  defp period(%Statement{from: nil, to: nil}), do: ""

  defp period(%Statement{} = statement) do
    range = [statement.from, statement.to] |> Enum.map(&date/1) |> Enum.reject(&(&1 == ""))
    tag(:p, Enum.join(range, " — "), "muted small")
  end

  defp phone(nil, _statement), do: ""
  defp phone(value, statement), do: tag(:p, "#{statement.labels.tel}: #{value}", "muted")

  defp tag(_name, nil, _class), do: ""
  defp tag(_name, "", _class), do: ""
  defp tag(name, value, class), do: "<#{name} class=\"#{class}\">#{escape(value)}</#{name}>"

  defp money(nil, _statement), do: ""
  defp money(amount, _statement), do: escape(Money.to_string(amount))

  defp date(nil), do: ""
  defp date(%Date{} = value), do: Date.to_iso8601(value)

  defp date(%DateTime{} = value),
    do: value |> DateTime.truncate(:second) |> Calendar.strftime("%Y-%m-%d %H:%M")

  # Same reasoning as the receipt: a customer note is free text a shopkeeper
  # typed, and a statement is not where anybody should find out it can close a
  # tag.
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
