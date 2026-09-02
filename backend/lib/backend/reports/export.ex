defmodule Kaarobar.Reports.Export do
  @moduledoc """
  Report rows as a CSV a shopkeeper can open in a spreadsheet.

  ## Why this is hand-rolled

  RFC 4180 is a page long, and the alternative is a dependency for twenty lines
  of quoting. What is *not* trivial is the part below about formulas, and a
  library would not have done it for us anyway.

  ## A cell is data, never a formula

  Excel, Numbers and LibreOffice all execute a cell beginning with `=`, `+`,
  `-` or `@`. A shop that names a product `=HYPERLINK("http://…")` — or that
  somebody else names it for them, through a supplier import — has an exported
  report that runs on the accountant's machine when they open it.

  So every cell that starts with one of those characters gets a leading
  apostrophe, which every spreadsheet reads as "this is text". The value is
  visibly unchanged in the cell and unambiguously inert.

  ## Encoding

  UTF-8 with a byte-order mark. Excel on Windows reads a BOM-less UTF-8 file as
  the system codepage, which turns every Urdu product name into mojibake — and
  the shops most likely to export are the ones whose data is not ASCII.
  """

  # Excel's own signal that a file is UTF-8. Ugly, and the only thing that
  # makes a non-Latin export readable on a Windows machine.
  @bom "﻿"

  # A cell starting with any of these is a formula to a spreadsheet.
  @formula_leaders ["=", "+", "-", "@", "\t", "\r"]

  @doc """
  Encodes rows as CSV.

  `columns` is a list of `{key, header}` — explicit rather than derived from
  the first row, so a report whose first row happens to be missing an optional
  field does not silently drop that column for everybody.
  """
  @spec to_csv([map()], [{atom(), String.t()}]) :: binary()
  def to_csv(rows, columns) do
    header = columns |> Enum.map(fn {_key, label} -> label end) |> row()
    body = Enum.map(rows, fn data -> row(Enum.map(columns, &cell(data, &1))) end)

    IO.iodata_to_binary([@bom, header, body])
  end

  @doc """
  The columns for each report the API can export.

  Kept here rather than in the controller so the CSV and the JSON cannot drift
  into disagreeing about what a report contains.
  """
  @spec columns(atom()) :: [{atom(), String.t()}] | nil
  def columns(:daily) do
    [
      {:day, "Date"},
      {:sale_count, "Sales"},
      {:gross_sales, "Gross"},
      {:discount_total, "Discount"},
      {:tax_total, "Tax"},
      {:net_sales, "Net"},
      {:refund_total, "Refunds"},
      {:cost_total, "Cost"}
    ]
  end

  def columns(:top_products) do
    [
      {:product_id, "Product"},
      {:variant_id, "Variant"},
      {:quantity, "Quantity"},
      {:refunded_quantity, "Refunded"},
      {:net_sales, "Net sales"},
      {:cost_total, "Cost"},
      {:margin, "Margin"}
    ]
  end

  def columns(:by_tender) do
    [{:method, "Method"}, {:count, "Payments"}, {:total, "Total"}]
  end

  def columns(:by_cashier) do
    [
      {:cashier_id, "Cashier"},
      {:sale_count, "Sales"},
      {:net_sales, "Net sales"},
      {:discount_total, "Discount"}
    ]
  end

  def columns(:by_branch) do
    [
      {:branch_id, "Branch"},
      {:sale_count, "Sales"},
      {:net_sales, "Net sales"},
      {:refund_total, "Refunds"},
      {:cost_total, "Cost"}
    ]
  end

  def columns(:by_category) do
    [
      {:category_id, "Category"},
      {:quantity, "Quantity"},
      {:net_sales, "Net sales"},
      {:cost_total, "Cost"},
      {:margin, "Margin"}
    ]
  end

  def columns(:tax) do
    [
      {:name, "Tax"},
      {:label, "Label"},
      {:rate, "Rate"},
      {:taxable_total, "Taxable"},
      {:tax_total, "Tax"}
    ]
  end

  def columns(:expenses) do
    [
      {:number, "Number"},
      {:spent_on, "Date"},
      {:description, "Description"},
      {:category, "Category"},
      {:amount, "Amount"},
      {:tax_amount, "Tax"},
      {:method, "Method"},
      {:status, "Status"}
    ]
  end

  def columns(_unknown), do: nil

  @doc "A filename a person will recognise in their downloads folder."
  @spec filename(atom(), Date.t(), Date.t()) :: String.t()
  def filename(report, from, to) do
    "#{report}-#{Date.to_iso8601(from)}-to-#{Date.to_iso8601(to)}.csv"
  end

  # ------------------------------------------------------------------ internals

  defp row(values), do: [Enum.map_join(values, ",", &quote_cell/1), "\r\n"]

  defp cell(data, {key, _label}), do: format(Map.get(data, key))

  defp format(nil), do: ""
  defp format(%Decimal{} = value), do: Decimal.to_string(value, :normal)
  defp format(%Date{} = value), do: Date.to_iso8601(value)
  defp format(%DateTime{} = value), do: DateTime.to_iso8601(value)
  defp format(value) when is_binary(value), do: value
  defp format(value), do: to_string(value)

  # RFC 4180: quote when the value contains a delimiter, a quote or a newline,
  # and double any quote inside.
  defp quote_cell(value) do
    value = neutralise(value)

    if String.contains?(value, [",", "\"", "\n", "\r"]) do
      ~s("#{String.replace(value, "\"", "\"\"")}")
    else
      value
    end
  end

  # See the module note. A leading apostrophe is what every spreadsheet reads
  # as "this cell is text", and it is stripped from the displayed value.
  defp neutralise(""), do: ""

  defp neutralise(value) do
    if String.starts_with?(value, @formula_leaders), do: "'" <> value, else: value
  end
end
