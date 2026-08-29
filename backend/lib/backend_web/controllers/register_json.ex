defmodule KaarobarWeb.RegisterJSON do
  @moduledoc false

  alias KaarobarWeb.SalesSerializers

  def registers(%{registers: registers}) do
    %{data: Enum.map(registers, &SalesSerializers.register/1)}
  end

  def register(%{register: register}), do: %{data: SalesSerializers.register(register)}

  def shifts(%{shifts: shifts}), do: %{data: Enum.map(shifts, &SalesSerializers.shift/1)}

  def shift(%{shift: shift}), do: %{data: SalesSerializers.shift(shift)}

  def x_report(%{report: report}), do: %{data: SalesSerializers.x_report(report)}

  def reconciliation(%{report: report}), do: %{data: SalesSerializers.reconciliation(report)}

  def cash_movements(%{cash_movements: movements}) do
    %{data: Enum.map(movements, &SalesSerializers.cash_movement/1)}
  end

  def cash_movement(%{cash_movement: movement}) do
    %{data: SalesSerializers.cash_movement(movement)}
  end
end
