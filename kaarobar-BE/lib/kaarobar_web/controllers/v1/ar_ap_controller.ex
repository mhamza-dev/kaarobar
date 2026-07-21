defmodule KaarobarWeb.V1.ArApController do
  use KaarobarWeb, :controller

  import Ecto.Query

  alias Kaarobar.Accounting
  alias Kaarobar.Guardian
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.Customer

  def list_customers(conn, _params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    data =
      Customer
      |> where([c], c.business_id == ^business_id and c.owner_id == ^owner_id)
      |> order_by([c], asc: c.name)
      |> Repo.all()
      |> Enum.map(&serialize_customer/1)

    json(conn, %{data: data})
  end

  def create_customer(conn, params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case %Customer{}
         |> Customer.changeset(%{
           name: params["name"],
           phone: params["phone"],
           email: params["email"],
           khata_enabled: params["khata_enabled"] == true || params["khata_enabled"] == "true",
           business_id: business_id,
           owner_id: owner_id
         })
         |> Repo.insert() do
      {:ok, c} ->
        conn
        |> put_status(:created)
        |> json(%{data: serialize_customer(c)})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def show_customer(conn, %{"id" => id}) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Repo.get_by(Customer, id: id, business_id: business_id, owner_id: owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      c ->
        balance = Accounting.customer_balance(c.id, business_id, owner_id)
        json(conn, %{data: Map.merge(serialize_customer(c), %{balance: balance})})
    end
  end

  def update_customer(conn, %{"id" => id} = params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Repo.get_by(Customer, id: id, business_id: business_id, owner_id: owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      c ->
        attrs =
          %{}
          |> maybe_put(params, "name")
          |> maybe_put(params, "phone")
          |> maybe_put(params, "email")
          |> maybe_put_bool(params, "khata_enabled")

        case c |> Customer.changeset(attrs) |> Repo.update() do
          {:ok, updated} ->
            json(conn, %{data: serialize_customer(updated)})

          {:error, cs} ->
            conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
        end
    end
  end

  def customer_ledger(conn, %{"id" => id}) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Repo.get_by(Customer, id: id, business_id: business_id, owner_id: owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      c ->
        entries = Accounting.customer_ledger(c.id, business_id, owner_id)
        balance = Accounting.customer_balance(c.id, business_id, owner_id)
        json(conn, %{data: %{customer: serialize_customer(c), balance: balance, entries: entries}})
    end
  end

  defp serialize_customer(c) do
    %{
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      khata_enabled: c.khata_enabled == true
    }
  end

  defp maybe_put(map, params, key) do
    case Map.fetch(params, key) do
      {:ok, value} -> Map.put(map, key, value)
      :error -> map
    end
  end

  defp maybe_put_bool(map, params, key) do
    case Map.fetch(params, key) do
      {:ok, true} -> Map.put(map, key, true)
      {:ok, "true"} -> Map.put(map, key, true)
      {:ok, false} -> Map.put(map, key, false)
      {:ok, "false"} -> Map.put(map, key, false)
      {:ok, _} -> map
      :error -> map
    end
  end

  def list_ar(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    data =
      Accounting.list_ar_invoices(business_id, owner_id)
      |> Enum.map(fn i ->
        %{
          id: i.id,
          invoice_number: i.invoice_number,
          customer_name: i.customer && i.customer.name,
          total_amount: to_string(i.total_amount),
          balance_due: to_string(i.balance_due),
          status: i.status,
          due_date: i.due_date
        }
      end)

    json(conn, %{data: data})
  end

  def create_ar(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    case Accounting.create_ar_invoice(business_id, owner_id, user.id, params) do
      {:ok, inv} ->
        conn
        |> put_status(:created)
        |> json(%{
          data: %{
            id: inv.id,
            invoice_number: inv.invoice_number,
            total_amount: to_string(inv.total_amount),
            balance_due: to_string(inv.balance_due),
            status: inv.status
          }
        })

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def pay_ar(conn, %{"id" => id} = params) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Accounting.record_ar_payment(id, owner_id, user.id, params) do
      {:ok, p} ->
        json(conn, %{data: %{id: p.id, amount: to_string(p.amount), method: p.method}})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def ar_aging(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    as_of = parse_date(params["as_of"])

    json(conn, %{data: Accounting.ar_aging(business_id, owner_id, as_of)})
  end

  def list_ap(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    data =
      Accounting.list_ap_bills(business_id, owner_id)
      |> Enum.map(fn b ->
        %{
          id: b.id,
          bill_number: b.bill_number,
          supplier_name: b.supplier && b.supplier.name,
          total_amount: to_string(b.total_amount),
          balance_due: to_string(b.balance_due),
          status: b.status,
          due_date: b.due_date
        }
      end)

    json(conn, %{data: data})
  end

  def create_ap(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    case Accounting.create_ap_bill(business_id, owner_id, user.id, params) do
      {:ok, bill} ->
        conn
        |> put_status(:created)
        |> json(%{
          data: %{
            id: bill.id,
            bill_number: bill.bill_number,
            total_amount: to_string(bill.total_amount),
            balance_due: to_string(bill.balance_due),
            status: bill.status
          }
        })

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def pay_ap(conn, %{"id" => id} = params) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Accounting.record_ap_payment(id, owner_id, user.id, params) do
      {:ok, p} ->
        json(conn, %{data: %{id: p.id, amount: to_string(p.amount), method: p.method}})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def ap_aging(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    as_of = parse_date(params["as_of"])

    json(conn, %{data: Accounting.ap_aging(business_id, owner_id, as_of)})
  end

  defp parse_date(nil), do: Date.utc_today()

  defp parse_date(str) do
    case Date.from_iso8601(str) do
      {:ok, d} -> d
      _ -> Date.utc_today()
    end
  end
end
