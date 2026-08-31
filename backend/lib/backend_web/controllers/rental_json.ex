defmodule KaarobarWeb.RentalJSON do
  @moduledoc false

  alias KaarobarWeb.TradeSerializers, as: S

  def units(%{units: units}), do: %{data: Enum.map(units, &S.unit/1)}
  def unit(%{unit: unit}), do: %{data: S.unit(unit)}

  def agreements(%{agreements: agreements}),
    do: %{data: Enum.map(agreements, &S.agreement/1)}

  def agreement(%{agreement: agreement}), do: %{data: S.agreement(agreement)}
end
