defmodule KaarobarWeb.V1.InventoryController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Inventory

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
        |> Inventory.list_inventory_for_branch(owner_id, business_id)
        |> Enum.map(fn row ->
          %{
            product_id: row.product_id,
            sku: row.product && row.product.sku,
            name: row.product && row.product.name,
            quantity_on_hand: to_string(row.quantity_on_hand),
            avg_cost: to_string(row.avg_cost || 0)
          }
        end)

      json(conn, %{data: data})
    end
  end

  def set_price(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    case Inventory.set_branch_price(
           params["product_id"],
           branch_id,
           owner_id,
           business_id,
           params["price"]
         ) do
      {:ok, price} ->
        json(conn, %{
          data: %{
            id: price.id,
            product_id: price.product_id,
            branch_id: price.branch_id,
            price: to_string(price.price)
          }
        })

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def adjust(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    case Inventory.adjust_stock(branch_id, owner_id, business_id, user.id, params) do
      {:ok, adj} ->
        conn
        |> put_status(:created)
        |> json(%{
          data: %{
            id: adj.id,
            product_id: adj.product_id,
            quantity_delta: to_string(adj.quantity_delta),
            reason_code: adj.reason_code
          }
        })

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def list_adjustments(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = conn.assigns[:branch_id]

    data =
      branch_id
      |> Inventory.list_adjustments(owner_id, business_id)
      |> Enum.map(fn a ->
        %{
          id: a.id,
          product_id: a.product_id,
          quantity_delta: to_string(a.quantity_delta),
          reason_code: a.reason_code,
          notes: a.notes,
          inserted_at: a.inserted_at
        }
      end)

    json(conn, %{data: data})
  end

  def transfer(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    case Inventory.create_transfer(business_id, owner_id, params) do
      {:ok, transfer} ->
        conn |> put_status(:created) |> json(%{data: serialize_transfer(transfer)})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def list_transfers(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    data =
      business_id
      |> Inventory.list_transfers(owner_id)
      |> Enum.map(&serialize_transfer/1)

    json(conn, %{data: data})
  end

  def confirm_transfer(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Inventory.confirm_transfer(id, owner_id) do
      {:ok, transfer} -> json(conn, %{data: serialize_transfer(transfer)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def list_pos(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = conn.assigns[:branch_id]

    data =
      Inventory.list_purchase_orders(business_id, owner_id, branch_id: branch_id)
      |> Enum.map(&serialize_po/1)

    json(conn, %{data: data})
  end

  def show_po(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Inventory.get_purchase_order(id, owner_id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      po -> json(conn, %{data: serialize_po(po)})
    end
  end

  def create_po(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    case Inventory.create_purchase_order(business_id, branch_id, owner_id, params) do
      {:ok, po} -> conn |> put_status(:created) |> json(%{data: serialize_po(po)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def update_po_status(conn, %{"id" => id} = params) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Inventory.update_purchase_order_status(id, owner_id, params["status"]) do
      {:ok, po} -> json(conn, %{data: serialize_po(po)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def list_grn(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = conn.assigns[:branch_id]

    data =
      Inventory.list_goods_receipts(business_id, owner_id, branch_id: branch_id)
      |> Enum.map(&serialize_grn/1)

    json(conn, %{data: data})
  end

  def receive_grn(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id
    branch_id = params["branch_id"] || conn.assigns[:branch_id]

    case Inventory.receive_goods(
           params["purchase_order_id"],
           branch_id,
           owner_id,
           business_id,
           user.id,
           params
         ) do
      {:ok, grn} -> conn |> put_status(:created) |> json(%{data: serialize_grn(grn)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp serialize_po(po) do
    po = Kaarobar.Repo.preload(po, [:items, :supplier])

    %{
      id: po.id,
      status: po.status,
      branch_id: po.branch_id,
      supplier_id: po.supplier_id,
      supplier_name: po.supplier && po.supplier.name,
      notes: po.notes,
      expected_delivery_date: po.expected_delivery_date,
      items:
        Enum.map(po.items || [], fn i ->
          %{
            product_id: i.product_id,
            quantity: to_string(i.quantity),
            unit_cost: to_string(i.unit_cost)
          }
        end)
    }
  end

  defp serialize_grn(gr) do
    gr = Kaarobar.Repo.preload(gr, [:items])

    %{
      id: gr.id,
      status: gr.status,
      purchase_order_id: gr.purchase_order_id,
      branch_id: gr.branch_id,
      notes: gr.notes,
      items:
        Enum.map(gr.items || [], fn i ->
          %{
            product_id: i.product_id,
            quantity_received: to_string(i.quantity_received)
          }
        end)
    }
  end

  defp serialize_transfer(t) do
    t = Kaarobar.Repo.preload(t, [:items])

    %{
      id: t.id,
      status: t.status,
      from_branch_id: t.from_branch_id,
      to_branch_id: t.to_branch_id,
      notes: t.notes,
      items:
        Enum.map(t.items || [], fn i ->
          %{product_id: i.product_id, quantity: to_string(i.quantity)}
        end)
    }
  end
end
