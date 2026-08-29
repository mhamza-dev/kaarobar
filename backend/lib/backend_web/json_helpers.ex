defmodule KaarobarWeb.JSONHelpers do
  @moduledoc """
  Serialisation helpers shared by every JSON view.

  ## Money is rendered as a string

  Monetary values are `Decimal` on `numeric(16,4)` columns and are serialised
  as strings — `"1499.5000"`, not `1499.5`. JSON numbers are IEEE-754 doubles
  in every JavaScript client we ship to, and a POS that silently rounds a total
  is not a POS. Clients parse these with a decimal library, exactly as they
  would a currency amount from any payment API.
  """

  @doc "Wraps a rendered payload in the standard success envelope."
  @spec data(term()) :: map()
  def data(payload), do: %{data: payload}

  @doc "Wraps a rendered list alongside its pagination metadata."
  @spec data(list(), map()) :: map()
  def data(entries, meta) when is_list(entries), do: %{data: entries, meta: meta}

  @doc "Serialises a `Decimal` as a lossless string. See the module note above."
  @spec money(Decimal.t() | nil) :: String.t() | nil
  def money(nil), do: nil
  def money(%Decimal{} = value), do: Decimal.to_string(value, :normal)

  @doc "Serialises a quantity, which may be fractional (1.5 kg of pesticide)."
  @spec quantity(Decimal.t() | nil) :: String.t() | nil
  def quantity(nil), do: nil
  def quantity(%Decimal{} = value), do: Decimal.to_string(value, :normal)

  @doc "Serialises a timestamp as ISO 8601 with a `Z` offset."
  @spec timestamp(DateTime.t() | NaiveDateTime.t() | nil) :: String.t() | nil
  def timestamp(nil), do: nil
  def timestamp(%DateTime{} = value), do: DateTime.to_iso8601(value)
  def timestamp(%NaiveDateTime{} = value), do: NaiveDateTime.to_iso8601(value)

  @doc "Serialises a date as ISO 8601."
  @spec date(Date.t() | nil) :: String.t() | nil
  def date(nil), do: nil
  def date(%Date{} = value), do: Date.to_iso8601(value)

  @doc """
  Renders an association only when it has been preloaded.

  Prevents an unloaded association from either raising or silently rendering
  as `null` when the caller simply forgot to preload it.
  """
  @spec preloaded(term(), (term() -> term())) :: term()
  def preloaded(%Ecto.Association.NotLoaded{}, _fun), do: nil
  def preloaded(nil, _fun), do: nil
  def preloaded(value, fun) when is_list(value), do: Enum.map(value, fun)
  def preloaded(value, fun), do: fun.(value)
end
