defmodule KaarobarWeb.V1.SaleController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Pos

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = conn.assigns[:branch_id]

    if is_nil(business_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_branch_required"})
    else
      data =
        branch_id
        |> Pos.list_sales(owner_id, business_id)
        |> Enum.map(&serialize_sale/1)

      json(conn, %{data: data})
    end
  end

  def show(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Pos.get_sale(id, owner_id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      sale -> json(conn, %{data: serialize_sale(sale)})
    end
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    if is_nil(business_id) or is_nil(branch_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_and_branch_required"})
    else
      case Pos.create_sale(branch_id, owner_id, business_id, user.id, params) do
        {:ok, sale} ->
          conn |> put_status(:created) |> json(%{data: serialize_sale(sale)})

        {:error, reason} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: error_reason(reason)})
      end
    end
  end

  defp serialize_sale(sale) do
    sale = Kaarobar.Repo.preload(sale, [:items, :payments])

    %{
      id: sale.id,
      invoice_number: sale.invoice_number,
      client_txn_id: sale.client_txn_id,
      status: sale.status,
      subtotal: to_string(sale.subtotal),
      tax_amount: to_string(sale.tax_amount),
      discount_amount: to_string(sale.discount_amount || 0),
      total_amount: to_string(sale.total_amount),
      branch_id: sale.branch_id,
      till_id: sale.till_id,
      fbr_invoice_no: sale.fbr_invoice_no,
      fbr_qr_payload: sale.fbr_qr_payload,
      fbr_reported_at: sale.fbr_reported_at,
      items:
        Enum.map(sale.items || [], fn i ->
          %{
            product_id: i.product_id,
            sku: i.sku,
            name: i.name,
            quantity: to_string(i.quantity),
            unit_price: to_string(i.unit_price),
            discount: to_string(i.discount || 0),
            tax_rate: to_string(i.tax_rate || 0),
            line_total: to_string(i.line_total)
          }
        end),
      payments:
        Enum.map(sale.payments || [], fn p ->
          %{method: p.method, amount: to_string(p.amount), reference: p.reference}
        end),
      returns:
        case Map.get(sale, :returns) do
          %Ecto.Association.NotLoaded{} ->
            []

          list when is_list(list) ->
            Enum.map(list, fn r ->
              %{
                id: r.id,
                status: r.status,
                refund_amount: to_string(r.refund_amount),
                refund_method: Map.get(r, :refund_method)
              }
            end)

          _ ->
            []
        end
    }
  end

  defp error_reason(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp error_reason(reason), do: inspect(reason)
end
