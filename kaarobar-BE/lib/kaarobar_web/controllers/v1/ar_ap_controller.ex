defmodule KaarobarWeb.V1.ArApController do
  use KaarobarWeb, :controller

  import Ecto.Query

  alias Kaarobar.Accounting
  alias Kaarobar.Guardian
  alias Kaarobar.Profiles
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
      |> Enum.map(fn c ->
        balance = Accounting.customer_balance(c.id, business_id, owner_id)
        Map.merge(serialize_customer(c), %{balance: to_string(balance)})
      end)

    json(conn, %{data: data})
  end

  def create_customer(conn, params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    attrs =
      customer_attrs(params)
      |> Map.merge(%{
        "business_id" => business_id,
        "owner_id" => owner_id
      })
      |> maybe_attach_global_account()

    case %Customer{} |> Customer.changeset(attrs) |> Repo.insert() do
      {:ok, c} ->
        case maybe_provision_portal(c, params) do
          {:ok, customer, portal_meta} ->
            conn
            |> put_status(:created)
            |> json(%{data: Map.merge(serialize_customer(customer), portal_meta)})

          {:error, reason} ->
            # Customer was created; surface portal error clearly
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: portal_error(reason), data: serialize_customer(c)})
        end

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: customer_error(cs)})
    end
  end

  defp maybe_attach_global_account(attrs) do
    email =
      case attrs["email"] do
        e when is_binary(e) -> e |> String.trim() |> String.downcase()
        _ -> nil
      end

    if is_binary(email) and email != "" do
      case Repo.get_by(Kaarobar.Schemas.CustomerAccount, email: email) do
        %{id: id} -> Map.put(attrs, "customer_account_id", id)
        nil -> attrs
      end
    else
      attrs
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

        json(conn, %{
          data: Map.merge(serialize_customer(c), %{balance: to_string(balance)})
        })
    end
  end

  def update_customer(conn, %{"id" => id} = params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Repo.get_by(Customer, id: id, business_id: business_id, owner_id: owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      c ->
        case c |> Customer.changeset(customer_attrs(params)) |> Repo.update() do
          {:ok, updated} ->
            case maybe_provision_portal(updated, params) do
              {:ok, customer, portal_meta} ->
                json(conn, %{data: Map.merge(serialize_customer(customer), portal_meta)})

              {:error, reason} ->
                conn
                |> put_status(:unprocessable_entity)
                |> json(%{error: portal_error(reason), data: serialize_customer(updated)})
            end

          {:error, cs} ->
            conn |> put_status(:unprocessable_entity) |> json(%{error: customer_error(cs)})
        end
    end
  end

  def upload_customer_profile_pic(conn, %{"id" => id} = params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Repo.get_by(Customer, id: id, business_id: business_id, owner_id: owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      customer ->
        case extract_upload(params) do
          {:ok, upload} ->
            case Profiles.upload_customer_pic(customer, upload) do
              {:ok, updated} -> json(conn, %{data: serialize_customer(updated)})
              {:error, reason} -> profile_pic_error(conn, reason)
            end

          {:error, reason} ->
            profile_pic_error(conn, reason)
        end
    end
  end

  def delete_customer_profile_pic(conn, %{"id" => id}) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Repo.get_by(Customer, id: id, business_id: business_id, owner_id: owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      customer ->
        case Profiles.clear_customer_pic(customer) do
          {:ok, updated} -> json(conn, %{data: serialize_customer(updated)})
          {:error, reason} -> profile_pic_error(conn, reason)
        end
    end
  end

  def adjust_loyalty(conn, %{"id" => id} = params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    delta =
      case params["delta"] do
        d when is_integer(d) -> d
        d when is_binary(d) -> String.to_integer(d)
        _ -> nil
      end

    if is_nil(delta) do
      conn |> put_status(:unprocessable_entity) |> json(%{error: "delta_required"})
    else
      case Kaarobar.Loyalty.adjust_points(
             id,
             business_id,
             owner_id,
             user.id,
             delta,
             params["reason"]
           ) do
        {:ok, c} ->
          json(conn, %{data: serialize_customer(c)})

        {:error, :not_found} ->
          conn |> put_status(:not_found) |> json(%{error: "not_found"})

        {:error, cs} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs)})
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

        json(conn, %{
          data: %{
            customer: serialize_customer(c),
            balance: to_string(balance),
            entries: entries
          }
        })
    end
  end

  def invite_portal(conn, %{"id" => id} = params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]
    password = params["portal_password"] || params["password"]

    case Kaarobar.CustomerPortal.invite_from_customer(id, business_id, owner_id, password) do
      {:ok, account, temp_password} ->
        json(conn, %{
          data: %{
            account_id: account.id,
            email: account.email,
            temporary_password: temp_password
          }
        })

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:error, :already_registered} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "already_registered"})

      {:error, :email_required} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "email_required"})

      {:error, :password_required} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "password_required"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp maybe_provision_portal(customer, params) do
    wants_portal? =
      Map.has_key?(params, "portal_password") or
        Map.has_key?(params, "password") or
        Map.has_key?(params, "portal_enabled")

    if wants_portal? do
      case Kaarobar.CustomerPortal.staff_provision_login(customer, params) do
        {:ok, updated, password} when is_binary(password) ->
          {:ok, updated, %{portal_temporary_password: password}}

        {:ok, updated, _} ->
          {:ok, updated, %{}}

        {:error, reason} ->
          {:error, reason}
      end
    else
      {:ok, customer, %{}}
    end
  end

  defp portal_error(:email_required), do: "portal_requires_email"
  defp portal_error(:password_required), do: "portal_requires_password"
  defp portal_error(:already_registered), do: "portal_already_registered"
  defp portal_error(%Ecto.Changeset{} = cs), do: customer_error(cs)
  defp portal_error(other), do: inspect(other)

  defp customer_attrs(params) do
    %{}
    |> maybe_put(params, "name")
    |> maybe_put(params, "phone")
    |> maybe_put(params, "email")
    |> maybe_put(params, "address")
    |> maybe_put(params, "notes")
    |> maybe_put(params, "cnic")
    |> maybe_put(params, "ntn")
    |> maybe_put(params, "company_name")
    |> maybe_put(params, "credit_limit")
    |> maybe_put(params, "user_id")
    |> maybe_put_bool(params, "khata_enabled")
    |> maybe_put_bool(params, "marketing_opt_in_email")
    |> maybe_put_bool(params, "marketing_opt_in_sms")
    |> maybe_put_bool(params, "marketing_opt_in_whatsapp")
    |> maybe_put_bool(params, "portal_enabled")
  end

  defp serialize_customer(c) do
    c = Kaarobar.Repo.preload(c, :customer_account)
    account = c.customer_account
    linked? = not is_nil(Map.get(c, :customer_account_id))

    %{
      id: c.id,
      name: (account && account.name) || c.name,
      phone: if(linked? and account, do: account.phone, else: c.phone) || c.phone,
      email: if(linked? and account, do: account.email, else: c.email) || c.email,
      address: c.address,
      notes: c.notes,
      cnic: c.cnic,
      ntn: c.ntn,
      company_name: c.company_name,
      credit_limit: c.credit_limit && to_string(c.credit_limit),
      loyalty_points: c.loyalty_points || 0,
      loyalty_tier_id: Map.get(c, :loyalty_tier_id),
      khata_enabled: c.khata_enabled == true,
      marketing_opt_in_email: Map.get(c, :marketing_opt_in_email) == true,
      marketing_opt_in_sms: Map.get(c, :marketing_opt_in_sms) == true,
      marketing_opt_in_whatsapp: Map.get(c, :marketing_opt_in_whatsapp) == true,
      portal_enabled: Map.get(c, :portal_enabled) == true,
      portal_linked: linked?,
      customer_account_id: Map.get(c, :customer_account_id),
      user_id: c.user_id,
      profile_pic_url: Profiles.profile_pic_url(c)
    }
  end

  defp extract_upload(%{"file" => %Plug.Upload{} = upload}), do: {:ok, upload}
  defp extract_upload(%{"image" => %Plug.Upload{} = upload}), do: {:ok, upload}
  defp extract_upload(%{"profile_pic" => %Plug.Upload{} = upload}), do: {:ok, upload}
  defp extract_upload(_), do: {:error, :missing_file}

  defp profile_pic_error(conn, reason) do
    error =
      case reason do
        :missing_file -> "missing_file"
        :invalid_upload -> "invalid_upload"
        :unsupported_type -> "unsupported_type"
        :too_large -> "too_large"
        :empty -> "empty"
        other -> inspect(other)
      end

    conn |> put_status(:unprocessable_entity) |> json(%{error: error})
  end

  defp customer_error(cs) do
    if Keyword.has_key?(cs.errors, :phone) do
      "phone_already_exists"
    else
      inspect(cs.errors)
    end
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
      |> Enum.map(&serialize_ar/1)

    json(conn, %{data: data})
  end

  def show_ar(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    case Accounting.get_ar_invoice(id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      inv ->
        json(conn, %{data: serialize_ar(inv, true)})
    end
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
      |> Enum.map(&serialize_ap(&1, false))

    json(conn, %{data: data})
  end

  def show_ap(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    case Accounting.get_ap_bill(id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      bill ->
        json(conn, %{data: serialize_ap(bill, true)})
    end
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

  defp serialize_ar(i, with_payments \\ false) do
    base = %{
      id: i.id,
      invoice_number: i.invoice_number,
      customer_id: i.customer_id,
      customer_name: i.customer && i.customer.name,
      sale_id: Map.get(i, :sale_id),
      invoice_date: i.invoice_date,
      due_date: i.due_date,
      subtotal: i.subtotal && to_string(i.subtotal),
      tax_amount: i.tax_amount && to_string(i.tax_amount),
      total_amount: to_string(i.total_amount),
      balance_due: to_string(i.balance_due),
      status: i.status,
      notes: i.notes,
      inserted_at: i.inserted_at
    }

    if with_payments do
      payments =
        case Map.get(i, :payments) do
          %Ecto.Association.NotLoaded{} -> []
          list when is_list(list) -> list
          _ -> []
        end

      Map.put(
        base,
        :payments,
        Enum.map(payments, fn p ->
          %{
            id: p.id,
            amount: to_string(p.amount),
            method: p.method,
            paid_at: p.paid_at,
            reference: p.reference
          }
        end)
      )
    else
      base
    end
  end

  defp serialize_ap(b, with_payments) do
    base = %{
      id: b.id,
      bill_number: b.bill_number,
      supplier_id: b.supplier_id,
      supplier_name: b.supplier && b.supplier.name,
      bill_date: b.bill_date,
      due_date: b.due_date,
      total_amount: to_string(b.total_amount),
      balance_due: to_string(b.balance_due),
      status: b.status,
      notes: b.notes,
      journal_entry_id: b.journal_entry_id,
      inserted_at: b.inserted_at
    }

    if with_payments do
      payments =
        case Map.get(b, :payments) do
          %Ecto.Association.NotLoaded{} -> []
          list when is_list(list) -> list
          _ -> []
        end

      Map.put(
        base,
        :payments,
        Enum.map(payments, fn p ->
          %{
            id: p.id,
            amount: to_string(p.amount),
            method: p.method,
            paid_at: p.paid_at,
            reference: p.reference
          }
        end)
      )
    else
      base
    end
  end
end
