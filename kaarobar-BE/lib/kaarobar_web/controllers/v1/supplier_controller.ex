defmodule KaarobarWeb.V1.SupplierController do
  use KaarobarWeb, :controller

  alias Kaarobar.Inventory
  alias Kaarobar.Schemas.Supplier

  def index(conn, _params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_required"})
    else
      data =
        business_id
        |> Inventory.list_suppliers(owner_id)
        |> Enum.map(&serialize/1)

      json(conn, %{data: data})
    end
  end

  def show(conn, %{"id" => id}) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Inventory.get_supplier(id, business_id, owner_id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      supplier -> json(conn, %{data: serialize(supplier)})
    end
  end

  def create(conn, params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_required"})
    else
      case Inventory.create_supplier(business_id, owner_id, params) do
        {:ok, supplier} ->
          conn |> put_status(:created) |> json(%{data: serialize(supplier)})

        {:error, cs} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "validation_failed", details: translate_errors(cs)})
      end
    end
  end

  def update(conn, %{"id" => id} = params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Inventory.get_supplier(id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      supplier ->
        case Inventory.update_supplier(supplier, Map.drop(params, ["id"])) do
          {:ok, updated} ->
            json(conn, %{data: serialize(updated)})

          {:error, cs} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: "validation_failed", details: translate_errors(cs)})
        end
    end
  end

  defp serialize(%Supplier{} = s) do
    %{
      id: s.id,
      name: s.name,
      legal_name: s.legal_name,
      code: s.code,
      tax_id: s.tax_id,
      strn: s.strn,
      website: s.website,
      industry: s.industry,
      status: s.status,
      notes: s.notes,
      is_preferred: s.is_preferred,
      rating: s.rating,
      contact: s.contact || %{},
      contact_name: s.contact_name,
      contact_role: s.contact_role,
      contact_email: s.contact_email,
      contact_phone: s.contact_phone,
      contact_mobile: s.contact_mobile,
      contact_whatsapp: s.contact_whatsapp,
      contact_cnic: s.contact_cnic,
      address_line1: s.address_line1,
      address_line2: s.address_line2,
      city: s.city,
      province: s.province,
      postal_code: s.postal_code,
      country: s.country,
      payment_terms: s.payment_terms,
      payment_method: s.payment_method,
      bank_name: s.bank_name,
      bank_iban: s.bank_iban,
      bank_account_title: s.bank_account_title,
      credit_limit: decimal_to_string(s.credit_limit),
      currency: s.currency,
      lead_time_days: s.lead_time_days,
      minimum_order_amount: decimal_to_string(s.minimum_order_amount),
      catalogs: s.catalogs || [],
      brands: s.brands || [],
      tags: s.tags || [],
      business_id: s.business_id
    }
  end

  defp decimal_to_string(nil), do: nil
  defp decimal_to_string(%Decimal{} = d), do: Decimal.to_string(d)
  defp decimal_to_string(other), do: to_string(other)

  defp translate_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
