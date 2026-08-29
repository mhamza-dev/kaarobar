defmodule KaarobarWeb.CustomerJSON do
  @moduledoc false

  alias KaarobarWeb.JSONHelpers
  alias KaarobarWeb.SalesSerializers

  def customers(%{customers: customers, meta: meta}) do
    %{data: Enum.map(customers, &SalesSerializers.customer/1), meta: meta}
  end

  def customer(%{customer: customer}), do: %{data: SalesSerializers.customer(customer)}

  def ledger(%{customer: customer, entries: entries}) do
    %{
      data: %{
        customer: SalesSerializers.customer(customer),
        balance: JSONHelpers.money(customer.balance),
        entries: Enum.map(entries, &SalesSerializers.customer_ledger_entry/1)
      }
    }
  end

  def payments(%{payments: payments}) do
    %{data: Enum.map(payments, &SalesSerializers.customer_payment/1)}
  end

  def payment(%{payment: payment}), do: %{data: SalesSerializers.customer_payment(payment)}

  def ageing(%{ageing: ageing}), do: %{data: SalesSerializers.ageing(ageing)}
end
