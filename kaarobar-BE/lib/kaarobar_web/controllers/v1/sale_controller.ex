defmodule KaarobarWeb.V1.SaleController do
  use KaarobarWeb, :controller
  alias Kaarobar.Pos
  alias Kaarobar.Guardian

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:current_branch_id]

    items =
      Enum.map(params["items"] || [], fn item ->
        %{
          product_id: item["product_id"],
          quantity: to_decimal(item["quantity"]),
          unit_price: to_decimal(item["unit_price"] || 0),
          discount: to_decimal(item["discount"] || 0),
          sku: item["sku"],
          name: item["name"],
          tax_rate: to_decimal(item["tax_rate"] || "0.18"),
          line_total: line_total(item)
        }
      end)

    payments =
      Enum.map(params["payments"] || [], fn p ->
        %{
          method: p["method"] || "cash",
          amount: to_decimal(p["amount"]),
          reference: p["reference"]
        }
      end)

    subtotal =
      Enum.reduce(items, Decimal.new(0), fn i, acc ->
        Decimal.add(acc, Decimal.mult(i.quantity, i.unit_price))
      end)

    tax_amount =
      Enum.reduce(items, Decimal.new(0), fn i, acc ->
        Decimal.add(acc, Decimal.mult(Decimal.mult(i.quantity, i.unit_price), i.tax_rate))
      end)

    total = Decimal.add(subtotal, tax_amount)

    attrs = %{
      client_txn_id: params["client_txn_id"],
      customer_id: params["customer_id"],
      till_id: params["till_id"],
      status: "Completed",
      subtotal: subtotal,
      tax_amount: tax_amount,
      discount_amount: to_decimal(params["discount_amount"] || 0),
      total_amount: total,
      notes: params["notes"],
      items: items,
      payments: payments
    }

    case Pos.create_sale(branch_id, owner_id, business_id, user.id, attrs) do
      {:ok, sale} -> conn |> put_status(:created) |> json(%{data: sale})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp to_decimal(%Decimal{} = d), do: d
  defp to_decimal(nil), do: Decimal.new(0)
  defp to_decimal(v), do: Decimal.new("#{v}")

  defp line_total(item) do
    qty = to_decimal(item["quantity"])
    price = to_decimal(item["unit_price"] || 0)
    disc = to_decimal(item["discount"] || 0)
    Decimal.sub(Decimal.mult(qty, price), disc)
  end
end
