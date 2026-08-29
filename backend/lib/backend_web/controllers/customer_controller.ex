defmodule KaarobarWeb.CustomerController do
  @moduledoc """
  Customers, what they owe, and what they have paid.

  The customer record itself, plus the things attached to one: addresses,
  contacts and notes. What they owe lives in `KaarobarWeb.CreditController`,
  points in `KaarobarWeb.LoyaltyController`, prepaid balances in
  `KaarobarWeb.PrepaidController`.

  Credit is gated separately from customer records, because seeing who a
  customer is and deciding how much they may owe are different jobs. Addresses
  and contacts ride on `customer:edit` — they are part of the record, not a
  financial decision.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Customers
  alias Kaarobar.Customers.CustomerAddress
  alias Kaarobar.Customers.CustomerContact
  alias Kaarobar.Customers.CustomerNote
  alias KaarobarWeb.Pagination

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "customer:view"] when action in [:index, :show, :lookup]

  plug KaarobarWeb.Plugs.Authorize, [permission: "customer:create"] when action in [:create]
  plug KaarobarWeb.Plugs.Authorize, [permission: "customer:edit"] when action in [:update]
  plug KaarobarWeb.Plugs.Authorize, [permission: "customer:archive"] when action in [:delete]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "credit:view"] when action in [:ledger, :payments, :ageing]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "credit:payment"] when action in [:record_payment]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "customer:view"] when action in [:addresses, :contacts, :notes]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "customer:edit"]
       when action in [
              :add_address,
              :update_address,
              :delete_address,
              :add_contact,
              :update_contact,
              :delete_contact,
              :add_note,
              :delete_note
            ]

  def index(conn, params) do
    {customers, meta} =
      conn.assigns.scope
      |> Customers.query(customer_filters(params))
      |> Pagination.page(params)

    render(conn, :customers, customers: customers, meta: meta)
  end

  def show(conn, %{"id" => id}) do
    with {:ok, customer} <- Customers.fetch_customer(conn.assigns.scope, id) do
      render(conn, :customer, customer: customer)
    end
  end

  @doc """
  Finds a customer by phone.

  How a shop actually identifies a returning customer — not by email, and never
  by a UUID.
  """
  def lookup(conn, %{"phone" => phone}) do
    case Customers.find_by_phone(conn.assigns.scope, phone) do
      nil -> {:error, :not_found}
      customer -> render(conn, :customer, customer: customer)
    end
  end

  def create(conn, params) do
    with {:ok, customer} <- Customers.create_customer(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:customer, customer: customer)
    end
  end

  def update(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, id),
         {:ok, updated} <- Customers.update_customer(scope, customer, params) do
      render(conn, :customer, customer: updated)
    end
  end

  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, id),
         {:ok, deleted} <- Customers.delete_customer(scope, customer) do
      render(conn, :customer, customer: deleted)
    end
  end

  @doc "One customer's statement, oldest first, with a running balance."
  def ledger(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, id) do
      entries = Customers.list_ledger_entries(scope, customer)

      render(conn, :ledger, customer: customer, entries: entries)
    end
  end

  def payments(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, id) do
      render(conn, :payments, payments: Customers.list_payments(scope, customer))
    end
  end

  @doc "Records a customer settling part or all of what they owe."
  def record_payment(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, id),
         {:ok, payment} <- Customers.record_payment(scope, customer, params) do
      conn |> put_status(:created) |> render(:payment, payment: payment)
    end
  end

  @doc "What is owed, bucketed by how long it has been outstanding."
  def ageing(conn, _params) do
    render(conn, :ageing, ageing: Customers.receivables_ageing(conn.assigns.scope))
  end

  # Booleans arrive as strings on a query string; "true" is the only value that
  # should switch a filter on.
  # --- Addresses --------------------------------------------------------------

  def addresses(conn, %{"customer_id" => customer_id}) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id) do
      render(conn, :addresses, addresses: Customers.list_addresses(scope, customer))
    end
  end

  def add_address(conn, %{"customer_id" => customer_id} = params) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id),
         {:ok, address} <- Customers.add_address(scope, customer, params) do
      conn |> put_status(:created) |> render(:address, address: address)
    end
  end

  def update_address(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, address} <- Customers.fetch_child(scope, CustomerAddress, id),
         {:ok, updated} <- Customers.update_address(scope, address, params) do
      render(conn, :address, address: updated)
    end
  end

  def delete_address(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, address} <- Customers.fetch_child(scope, CustomerAddress, id),
         {:ok, deleted} <- Customers.delete_address(scope, address) do
      render(conn, :address, address: deleted)
    end
  end

  # --- Contacts ---------------------------------------------------------------

  def contacts(conn, %{"customer_id" => customer_id}) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id) do
      render(conn, :contacts, contacts: Customers.list_contacts(scope, customer))
    end
  end

  def add_contact(conn, %{"customer_id" => customer_id} = params) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id),
         {:ok, contact} <- Customers.add_contact(scope, customer, params) do
      conn |> put_status(:created) |> render(:contact, contact: contact)
    end
  end

  def update_contact(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, contact} <- Customers.fetch_child(scope, CustomerContact, id),
         {:ok, updated} <- Customers.update_contact(scope, contact, params) do
      render(conn, :contact, contact: updated)
    end
  end

  def delete_contact(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, contact} <- Customers.fetch_child(scope, CustomerContact, id),
         {:ok, deleted} <- Customers.delete_contact(scope, contact) do
      render(conn, :contact, contact: deleted)
    end
  end

  # --- Notes ------------------------------------------------------------------

  def notes(conn, %{"customer_id" => customer_id}) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id) do
      render(conn, :notes, notes: Customers.list_notes(scope, customer))
    end
  end

  def add_note(conn, %{"customer_id" => customer_id} = params) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id),
         {:ok, note} <- Customers.add_note(scope, customer, params) do
      conn |> put_status(:created) |> render(:note, note: note)
    end
  end

  def delete_note(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, note} <- Customers.fetch_child(scope, CustomerNote, id),
         {:ok, deleted} <- Customers.delete_note(scope, note) do
      render(conn, :note, note: deleted)
    end
  end


  defp customer_filters(params) do
    params
    |> Map.take(~w(q credit_allowed owing))
    |> Enum.reduce(%{}, fn
      {key, value}, acc when key in ~w(credit_allowed owing) ->
        Map.put(acc, key, value in [true, "true", "1"])

      {key, value}, acc ->
        Map.put(acc, key, value)
    end)
  end
end
