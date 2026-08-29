defmodule KaarobarWeb.CustomerJSON do
  @moduledoc false

  alias KaarobarWeb.CrmSerializers
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

  def addresses(%{addresses: addresses}),
    do: %{data: Enum.map(addresses, &CrmSerializers.address/1)}

  def address(%{address: address}), do: %{data: CrmSerializers.address(address)}

  def contacts(%{contacts: contacts}), do: %{data: Enum.map(contacts, &CrmSerializers.contact/1)}

  def contact(%{contact: contact}), do: %{data: CrmSerializers.contact(contact)}

  def notes(%{notes: notes}), do: %{data: Enum.map(notes, &CrmSerializers.note/1)}

  def note(%{note: note}), do: %{data: CrmSerializers.note(note)}
end
