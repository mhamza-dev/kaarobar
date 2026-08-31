defmodule KaarobarWeb.QuoteJSON do
  @moduledoc false

  alias KaarobarWeb.JSONHelpers
  alias KaarobarWeb.TradeSerializers, as: S

  def quotes(%{quotes: quotes}), do: %{data: Enum.map(quotes, &S.quote/1)}
  def quote(%{quote: quote}), do: %{data: S.quote(quote)}
  def win_rate(%{stats: stats}), do: %{data: S.win_rate(stats)}

  def time_entries(%{entries: entries}), do: %{data: Enum.map(entries, &S.time_entry/1)}
  def time_entry(%{entry: entry}), do: %{data: S.time_entry(entry)}

  def unbilled(%{result: result}) do
    %{
      data: Enum.map(result.entries, &S.time_entry/1),
      meta: %{minutes: result.minutes, amount: JSONHelpers.money(result.amount)}
    }
  end

  def utilisation(%{rows: rows}), do: %{data: Enum.map(rows, &S.utilisation_row/1)}
end
