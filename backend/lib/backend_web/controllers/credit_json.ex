defmodule KaarobarWeb.CreditJSON do
  @moduledoc false

  alias KaarobarWeb.CrmSerializers

  def invoices(%{invoices: invoices}), do: %{data: Enum.map(invoices, &CrmSerializers.invoice/1)}

  def ageing(%{ageing: ageing}), do: %{data: CrmSerializers.ageing(ageing)}

  def by_customer(%{rows: rows}),
    do: %{data: Enum.map(rows, &CrmSerializers.customer_ageing/1)}

  def statement(%{statement: statement}), do: %{data: CrmSerializers.statement(statement)}

  def allocations(%{allocations: allocations}),
    do: %{data: Enum.map(allocations, &CrmSerializers.allocation/1)}
end
