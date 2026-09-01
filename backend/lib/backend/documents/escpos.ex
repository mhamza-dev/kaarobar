defmodule Kaarobar.Documents.EscPos do
  @moduledoc """
  A receipt as bytes a thermal printer understands.

  The server builds the payload; the client pushes it at the printer. That
  split is deliberate — a browser cannot open a USB device, and a shop's
  printer is on the shop's network, not ours. What the client gets is an opaque
  blob to forward, which also means fixing a layout bug ships to every till
  without anybody updating anything.

  ## What this cannot do

  A print head holds one single-byte code page. Urdu, Arabic and Chinese come
  off it as a row of `?` — `Kaarobar.Documents.Receipt.needs_raster?/1` says
  when that would happen, and such a receipt should be drawn and sent as an
  image instead. The desktop app already does exactly that; the same decision
  applies here, and callers are told rather than handed unreadable bytes.
  """

  alias Kaarobar.Documents.Receipt
  alias Kaarobar.Money

  # ESC/POS control bytes.
  @esc 0x1B
  @gs 0x1D
  @lf 0x0A

  # Font A on a standard head. 48 columns on an 80mm roll, 32 on 58mm.
  @columns %{"58mm" => 32, "80mm" => 48, "76mm" => 42}
  @default_columns 48

  @doc """
  Renders the receipt.

  Returns `{:error, :not_printable}` for a document whose script the print head
  has no glyphs for, rather than a page of `?`. The caller either rasters it or
  tells the user why it cannot be printed as text — both are better than paper
  nobody can read.
  """
  @spec render(Receipt.t(), keyword()) :: {:ok, binary()} | {:error, :not_printable}
  def render(%Receipt{} = receipt, opts \\ []) do
    if Receipt.needs_raster?(receipt) do
      {:error, :not_printable}
    else
      {:ok, build(receipt, columns(Keyword.get(opts, :paper, "80mm")))}
    end
  end

  @doc "How many characters fit across a roll."
  @spec columns(String.t()) :: pos_integer()
  def columns(paper), do: Map.get(@columns, paper, @default_columns)

  # ---------------------------------------------------------------- rendering

  defp build(%Receipt{} = receipt, width) do
    [
      init(),
      centred(),
      emphasis(true),
      double_height(true),
      line(receipt.business_name),
      double_height(false),
      emphasis(false),
      line(receipt.branch_name),
      line(receipt.branch_address),
      phone_line(receipt),
      feed(1),
      line(receipt.header_note),
      emphasis(true),
      line(receipt.title),
      emphasis(false),
      left(),
      divider(width),
      meta(receipt, width),
      divider(width),
      lines(receipt, width),
      divider(width),
      totals(receipt, width),
      tenders(receipt, width),
      centred(),
      feed(1),
      fiscal(receipt),
      line(receipt.footer_note),
      line(receipt.labels.thank_you),
      line(receipt.labels.powered_by),
      feed(3),
      cut()
    ]
    |> IO.iodata_to_binary()
  end

  defp meta(%Receipt{} = receipt, width) do
    [
      pair(receipt.labels.invoice, receipt.number, width),
      pair(receipt.labels.date, timestamp(receipt.sold_at), width),
      if(receipt.customer_name, do: pair(receipt.labels.customer, receipt.customer_name, width)),
      if(receipt.cashier_name, do: pair(receipt.labels.cashier, receipt.cashier_name, width))
    ]
  end

  # Two rows per item: the name on its own so a long one is not truncated, then
  # the arithmetic. A receipt that cuts "Blue cotton shirt, large" down to
  # "Blue cotton s" is one a customer cannot check.
  defp lines(%Receipt{} = receipt, width) do
    Enum.map(receipt.lines, fn item ->
      quantity = Money.to_string(item.quantity)
      unit = money(item.unit_price, receipt.currency)

      [
        line(item.name),
        pair("  #{quantity} x #{unit}", money(item.line_total, receipt.currency), width),
        if(positive?(item.discount),
          do: pair("  #{receipt.labels.discount}", "-" <> money(item.discount, receipt.currency), width)
        )
      ]
    end)
  end

  defp totals(%Receipt{totals: totals} = receipt, width) do
    [
      pair(receipt.labels.subtotal, money(totals.subtotal, receipt.currency), width),
      if(positive?(totals.discount),
        do: pair(receipt.labels.discount, "-" <> money(totals.discount, receipt.currency), width)
      ),
      Enum.map(receipt.taxes, fn tax ->
        pair(tax_label(receipt, tax), money(tax.amount, receipt.currency), width)
      end),
      emphasis(true),
      pair(receipt.labels.total, money(totals.total, receipt.currency), width),
      emphasis(false)
    ]
  end

  defp tenders(%Receipt{} = receipt, width) do
    [
      Enum.map(receipt.payments, fn payment ->
        pair(payment.label, money(payment.amount, receipt.currency), width)
      end),
      if(positive?(receipt.totals.change),
        do: pair(receipt.labels.change, money(receipt.totals.change, receipt.currency), width)
      )
    ]
  end

  # The stamp, where a tax inspector expects it. Printed as text rather than as
  # a QR image: the payload is the authority's own string, and a shop asked to
  # prove what was declared can read it off the paper.
  defp fiscal(%Receipt{fiscal_number: nil}), do: []

  defp fiscal(%Receipt{} = receipt) do
    [line(receipt.fiscal_number), line(receipt.fiscal_qr_payload)]
  end

  defp phone_line(%Receipt{branch_phone: nil}), do: []
  defp phone_line(%Receipt{} = receipt), do: line("#{receipt.labels.tel}: #{receipt.branch_phone}")

  defp tax_label(_receipt, %{label: label, rate: rate}) when not is_nil(rate) do
    "#{label} #{Decimal.mult(rate, 100) |> Decimal.normalize() |> Decimal.to_string(:normal)}%"
  end

  defp tax_label(_receipt, %{label: label}), do: label

  # ------------------------------------------------------------------ helpers

  # Label left, value right, dots between. The dots matter: a column of figures
  # with nothing joining them to their labels is one that gets misread on a
  # crumpled receipt.
  defp pair(label, value, width) do
    label = to_string(label)
    value = to_string(value)
    gap = max(width - String.length(label) - String.length(value), 1)

    line(label <> String.duplicate(" ", gap) <> value)
  end

  defp divider(width), do: line(String.duplicate("-", width))

  defp line(nil), do: []
  defp line(""), do: []
  defp line(text), do: [to_string(text), @lf]

  defp init, do: [@esc, 0x40]
  defp centred, do: [@esc, 0x61, 1]
  defp left, do: [@esc, 0x61, 0]
  defp emphasis(true), do: [@esc, 0x45, 1]
  defp emphasis(false), do: [@esc, 0x45, 0]
  defp double_height(true), do: [@gs, 0x21, 0x01]
  defp double_height(false), do: [@gs, 0x21, 0x00]
  defp feed(n), do: List.duplicate(@lf, n)
  # GS V 66 0 — cut, after feeding the paper clear of the head.
  defp cut, do: [feed(2), @gs, 0x56, 66, 0]

  defp money(nil, _currency), do: ""
  defp money(amount, currency), do: Money.to_string(amount, currency)

  defp positive?(nil), do: false
  defp positive?(%Decimal{} = value), do: Money.positive?(value)

  defp timestamp(nil), do: ""

  defp timestamp(%DateTime{} = at),
    do: at |> DateTime.truncate(:second) |> Calendar.strftime("%Y-%m-%d %H:%M")
end
