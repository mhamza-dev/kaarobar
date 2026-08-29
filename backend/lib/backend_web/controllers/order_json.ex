defmodule KaarobarWeb.OrderJSON do
  @moduledoc false

  alias KaarobarWeb.SalesSerializers

  def orders(%{orders: orders}), do: %{data: Enum.map(orders, &SalesSerializers.order/1)}

  def order(%{order: order}), do: %{data: SalesSerializers.order(order)}
end
