defmodule KaarobarWeb.ReportJSON do
  @moduledoc """
  Serialising report figures.

  Money goes out as strings at the currency's precision, like everywhere else.
  Counts stay numbers: a sale count is not money and quoting it would make
  every client parse it back.
  """

  alias KaarobarWeb.JSONHelpers, as: H

  def summary(%{summary: summary}), do: %{data: serialise(summary)}

  def daily(%{days: days}), do: %{data: Enum.map(days, &serialise/1)}

  def rows(%{rows: rows}), do: %{data: Enum.map(rows, &serialise/1)}

  def profit(%{profit: profit}), do: %{data: serialise(profit)}

  def queued(%{queued: _queued}), do: %{data: %{queued: true}}

  def ageing(%{totals: totals, by_party: by_party}),
    do: %{data: %{totals: serialise(totals), by_party: Enum.map(by_party, &serialise/1)}}

  def payables(%{payables: payables}), do: %{data: serialise(payables)}

  def shift_report(%{report: report}), do: %{data: serialise(report)}

  # Walks the map and formats what is money, leaving counts, ids and dates
  # alone. One rule in one place, so a report added later cannot forget it.
  # Ecto structs reach here inside a shift report. Only their own fields are
  # kept: `__meta__` and unloaded associations are not data, and neither
  # survives JSON encoding.
  defp serialise(%module{} = record) when module not in [Date, DateTime, NaiveDateTime, Decimal] do
    if function_exported?(module, :__schema__, 1) do
      record |> Map.take(module.__schema__(:fields)) |> serialise()
    else
      record |> Map.from_struct() |> serialise()
    end
  end

  defp serialise(%Decimal{} = amount), do: H.money(amount)
  defp serialise(%Date{} = date), do: Date.to_iso8601(date)

  defp serialise(value) when is_map(value) and not is_struct(value) do
    Map.new(value, fn {key, inner} -> {key, serialise_value(key, inner)} end)
  end

  defp serialise(value) when is_list(value), do: Enum.map(value, &serialise/1)
  defp serialise(value), do: value

  # Not every decimal in a report is money. A tax rate of 0.175 rounded to the
  # currency's two places becomes 0.18 — a different tax — and 1.5 kg of
  # pesticide is a quantity, not an amount. Both go out at full precision.
  @exact ~w(quantity refunded_quantity net_quantity item_count rate)a

  defp serialise_value(key, %Decimal{} = value) when key in @exact,
    do: Decimal.to_string(value, :normal)

  defp serialise_value(_key, %Decimal{} = amount), do: H.money(amount)
  defp serialise_value(_key, %Date{} = date), do: Date.to_iso8601(date)
  defp serialise_value(_key, value) when is_list(value), do: Enum.map(value, &serialise/1)

  defp serialise_value(_key, value) when is_map(value) and not is_struct(value),
    do: serialise(value)

  defp serialise_value(_key, value), do: value
end
