defmodule KaarobarWeb.JSON do
  @moduledoc false

  def money(nil), do: "0"
  def money(%Decimal{} = d), do: Decimal.to_string(d)
  def money(other), do: to_string(other)
end
