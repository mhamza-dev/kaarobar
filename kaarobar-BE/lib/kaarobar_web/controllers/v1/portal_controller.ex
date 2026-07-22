defmodule KaarobarWeb.V1.PortalController do
  use KaarobarWeb, :controller

  alias Kaarobar.CustomerPortal
  alias Kaarobar.Profiles
  alias Kaarobar.Repo

  def me(conn, params) do
    account = conn.assigns.portal_account
    business_id = params["business_id"] || conn.assigns[:business_id]
    profile = CustomerPortal.get_profile(account, business_id)

    json(conn, %{
      data: %{
        account: %{
          id: profile.account.id,
          email: profile.account.email,
          name: profile.account.name,
          phone: profile.account.phone,
          email_verified: profile.account.email_verified
        },
        memberships:
          Enum.map(profile.memberships, fn c ->
            %{
              customer_id: c.id,
              business_id: c.business_id,
              business_name: c.business && c.business.name,
              loyalty_points: c.loyalty_points || 0,
              khata_enabled: c.khata_enabled == true,
              portal_enabled: c.portal_enabled == true
            }
          end),
        customer: profile.customer && serialize_customer(profile.customer)
      }
    })
  end

  def update_profile(conn, params) do
    account = conn.assigns.portal_account

    case CustomerPortal.update_profile(account, params) do
      {:ok, %Kaarobar.Schemas.Customer{} = customer} ->
        json(conn, %{data: serialize_customer(Repo.preload(customer, :loyalty_tier))})

      {:ok, %Kaarobar.Schemas.CustomerAccount{} = acc} ->
        json(conn, %{
          data: %{
            account: %{id: acc.id, email: acc.email, name: acc.name, phone: acc.phone}
          }
        })

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def upload_profile_pic(conn, params) do
    account = conn.assigns.portal_account
    business_id = params["business_id"] || conn.assigns[:business_id]

    with {:ok, membership} <- resolve_required_membership(account, business_id),
         {:ok, upload} <- extract_upload(params),
         {:ok, updated} <- Profiles.upload_customer_pic(membership, upload) do
      json(conn, %{data: serialize_customer(updated)})
    else
      {:error, reason} -> profile_pic_error(conn, reason)
    end
  end

  def delete_profile_pic(conn, params) do
    account = conn.assigns.portal_account
    business_id = params["business_id"] || conn.assigns[:business_id]

    with {:ok, membership} <- resolve_required_membership(account, business_id),
         {:ok, updated} <- Profiles.clear_customer_pic(membership) do
      json(conn, %{data: serialize_customer(updated)})
    else
      {:error, reason} -> profile_pic_error(conn, reason)
    end
  end

  def orders(conn, params) do
    account = conn.assigns.portal_account
    opts = [business_id: params["business_id"] || conn.assigns[:business_id]]
    data = account |> CustomerPortal.list_orders(opts) |> Enum.map(&serialize_sale/1)
    json(conn, %{data: data})
  end

  def show_order(conn, %{"id" => id} = params) do
    account = conn.assigns.portal_account
    opts = [business_id: params["business_id"] || conn.assigns[:business_id]]

    case CustomerPortal.get_order(account, id, opts) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      sale -> json(conn, %{data: serialize_sale(sale)})
    end
  end

  def loyalty(conn, params) do
    account = conn.assigns.portal_account
    opts = [business_id: params["business_id"] || conn.assigns[:business_id]]
    json(conn, %{data: CustomerPortal.loyalty_summary(account, opts)})
  end

  def ar(conn, params) do
    account = conn.assigns.portal_account
    opts = [business_id: params["business_id"] || conn.assigns[:business_id]]
    balances = CustomerPortal.ar_balance(account, opts)

    invoices =
      account
      |> CustomerPortal.list_open_ar(opts)
      |> Enum.map(fn i ->
        %{
          id: i.id,
          business_id: i.business_id,
          invoice_number: i.invoice_number,
          total_amount: to_string(i.total_amount),
          balance_due: to_string(i.balance_due),
          status: i.status,
          due_date: i.due_date
        }
      end)

    json(conn, %{data: %{balances: balances, invoices: invoices}})
  end

  def pay_ar(conn, params) do
    account = conn.assigns.portal_account

    case CustomerPortal.pay_ar(account, params) do
      {:ok, _} -> json(conn, %{data: %{ok: true}})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def bookings(conn, _params) do
    json(conn, %{data: %{available: false, message: "booking_unavailable"}})
  end

  def revoke_sessions(conn, _params) do
    account = conn.assigns.portal_account
    {:ok, count} = CustomerPortal.revoke_all_sessions(account, :customer)
    json(conn, %{data: %{revoked: count}})
  end

  def place_order(conn, params) do
    account = conn.assigns.portal_account

    case Kaarobar.Marketplace.place_order(account, params) do
      {:ok, sale} ->
        conn |> put_status(:created) |> json(%{data: serialize_sale(sale)})

      {:error, :marketplace_disabled} ->
        conn |> put_status(:forbidden) |> json(%{error: "marketplace_disabled"})

      {:error, :business_not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "business_not_found"})

      {:error, :online_branch_required} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "online_branch_required"})

      {:error, :invalid_payment} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid_payment"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp resolve_required_membership(account, business_id) do
    cond do
      not is_binary(business_id) or business_id == "" ->
        {:error, :business_required}

      true ->
        CustomerPortal.resolve_membership(account, business_id)
    end
  end

  defp serialize_customer(c) do
    %{
      id: c.id,
      business_id: c.business_id,
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
        :business_required -> "business_required"
        other -> inspect(other)
      end

    conn |> put_status(:unprocessable_entity) |> json(%{error: error})
  end

  defp serialize_sale(s) do
    %{
      id: s.id,
      business_id: s.business_id,
      business_name: s.business && s.business.name,
      invoice_number: s.invoice_number,
      source: s.source || "pos",
      subtotal: to_string(s.subtotal),
      tax_amount: to_string(s.tax_amount),
      discount_amount: to_string(s.discount_amount),
      total_amount: to_string(s.total_amount),
      status: s.status,
      notes: s.notes,
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
