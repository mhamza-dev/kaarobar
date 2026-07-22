defmodule KaarobarWeb.V1.PortalController do
  use KaarobarWeb, :controller

  alias Kaarobar.CustomerPortal
  alias Kaarobar.Profiles

  def me(conn, _params) do
    account = conn.assigns.portal_account
    customer = CustomerPortal.get_profile(account)

    json(conn, %{
      data: %{
        account: %{
          id: account.id,
          email: account.email,
          email_verified: account.email_verified,
          business_id: account.business_id,
          customer_id: account.customer_id
        },
        customer: serialize_customer(customer)
      }
    })
  end

  def update_profile(conn, params) do
    account = conn.assigns.portal_account

    case CustomerPortal.update_profile(account, params) do
      {:ok, customer} ->
        json(conn, %{data: serialize_customer(customer)})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def upload_profile_pic(conn, params) do
    account = conn.assigns.portal_account
    customer = CustomerPortal.get_profile(account)

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

  def delete_profile_pic(conn, _params) do
    account = conn.assigns.portal_account
    customer = CustomerPortal.get_profile(account)

    case Profiles.clear_customer_pic(customer) do
      {:ok, updated} -> json(conn, %{data: serialize_customer(updated)})
      {:error, reason} -> profile_pic_error(conn, reason)
    end
  end

  def orders(conn, _params) do
    account = conn.assigns.portal_account
    data = account |> CustomerPortal.list_orders() |> Enum.map(&serialize_sale/1)
    json(conn, %{data: data})
  end

  def show_order(conn, %{"id" => id}) do
    account = conn.assigns.portal_account

    case CustomerPortal.get_order(account, id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      sale -> json(conn, %{data: serialize_sale(sale)})
    end
  end

  def loyalty(conn, _params) do
    account = conn.assigns.portal_account
    json(conn, %{data: CustomerPortal.loyalty_summary(account)})
  end

  def ar(conn, _params) do
    account = conn.assigns.portal_account
    balance = CustomerPortal.ar_balance(account)

    invoices =
      account
      |> CustomerPortal.list_open_ar()
      |> Enum.map(fn i ->
        %{
          id: i.id,
          invoice_number: i.invoice_number,
          total_amount: to_string(i.total_amount),
          balance_due: to_string(i.balance_due),
          status: i.status,
          due_date: i.due_date
        }
      end)

    json(conn, %{data: %{balance: to_string(balance), invoices: invoices}})
  end

  def pay_ar(conn, params) do
    account = conn.assigns.portal_account

    case CustomerPortal.pay_ar(account, params) do
      {:ok, _} -> json(conn, %{data: %{ok: true}})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def bookings(conn, _params) do
    # CUS-FR-005 deferred until Phase B appointments
    json(conn, %{data: %{available: false, message: "booking_unavailable"}})
  end

  def revoke_sessions(conn, _params) do
    account = conn.assigns.portal_account
    {:ok, count} = CustomerPortal.revoke_all_sessions(account, :customer)
    json(conn, %{data: %{revoked: count}})
  end

  defp serialize_customer(c) do
    %{
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      loyalty_points: c.loyalty_points || 0,
      loyalty_tier_id: c.loyalty_tier_id,
      loyalty_tier_name: c.loyalty_tier && c.loyalty_tier.name,
      marketing_opt_in_email: c.marketing_opt_in_email == true,
      marketing_opt_in_sms: c.marketing_opt_in_sms == true,
      marketing_opt_in_whatsapp: c.marketing_opt_in_whatsapp == true,
      khata_enabled: c.khata_enabled == true,
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

  defp serialize_sale(s) do
    %{
      id: s.id,
      invoice_number: s.invoice_number,
      subtotal: to_string(s.subtotal),
      tax_amount: to_string(s.tax_amount),
      discount_amount: to_string(s.discount_amount),
      total_amount: to_string(s.total_amount),
      status: s.status,
      inserted_at: s.inserted_at,
      items:
        Enum.map(s.items || [], fn i ->
          %{
            name: i.name || Map.get(i, :product_name),
            quantity: to_string(i.quantity),
            unit_price: to_string(i.unit_price),
            line_total: to_string(i.line_total)
          }
        end),
      payments:
        Enum.map(s.payments || [], fn p ->
          %{method: p.method, amount: to_string(p.amount)}
        end)
    }
  end
end
