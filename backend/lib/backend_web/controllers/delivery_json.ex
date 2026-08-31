defmodule KaarobarWeb.DeliveryJSON do
  @moduledoc false

  alias KaarobarWeb.DiningSerializers, as: S

  def deliveries(%{deliveries: deliveries}),
    do: %{data: Enum.map(deliveries, &S.delivery/1)}

  def delivery(%{delivery: delivery}), do: %{data: S.delivery(delivery)}

  def rider_board(%{rounds: rounds}), do: %{data: Enum.map(rounds, &S.rider_round/1)}
end
