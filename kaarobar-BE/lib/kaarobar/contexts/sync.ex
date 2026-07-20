defmodule Kaarobar.Sync do
  @moduledoc """
  Offline sync helpers (OFF-FR): catalog cache pull, inventory deltas, sales batch upsert.
  Idempotent on `client_txn_id` via `Pos.create_sale/5`.
  """

  import Ecto.Query
  alias Kaarobar.{Pos, Repo}
  alias Kaarobar.Schemas.{InventoryRecord, Product, ProductBranchPrice}

  def catalog(business_id, owner_id, branch_id) do
    products =
      from(p in Product,
        where: p.business_id == ^business_id and p.owner_id == ^owner_id and p.is_active == true,
        order_by: [asc: p.name]
      )
      |> Repo.all()

    prices =
      from(pr in ProductBranchPrice,
        where: pr.branch_id == ^branch_id and pr.owner_id == ^owner_id
      )
      |> Repo.all()
      |> Map.new(&{&1.product_id, &1})

    stock =
      from(i in InventoryRecord,
        where:
          i.branch_id == ^branch_id and i.business_id == ^business_id and i.owner_id == ^owner_id
      )
      |> Repo.all()
      |> Map.new(&{&1.product_id, &1})

    Enum.map(products, fn p ->
      price = prices[p.id]
      inv = stock[p.id]

      %{
        id: p.id,
        sku: p.sku,
        name: p.name,
        tax_rate: to_string(p.tax_rate || 0),
        price: price && to_string(price.price),
        quantity_on_hand: inv && to_string(inv.quantity_on_hand || 0)
      }
    end)
  end

  def inventory_delta(business_id, owner_id, branch_id, since \\ nil) do
    q =
      from(i in InventoryRecord,
        join: p in Product,
        on: p.id == i.product_id,
        where:
          i.business_id == ^business_id and i.owner_id == ^owner_id and i.branch_id == ^branch_id,
        select: %{
          product_id: i.product_id,
          sku: p.sku,
          quantity_on_hand: i.quantity_on_hand,
          updated_at: i.updated_at
        }
      )

    q =
      if since do
        where(q, [i], i.updated_at > ^since)
      else
        q
      end

    Repo.all(q)
    |> Enum.map(fn row ->
      %{
        product_id: row.product_id,
        sku: row.sku,
        quantity_on_hand: to_string(row.quantity_on_hand || 0),
        updated_at: row.updated_at
      }
    end)
  end

  @doc """
  Push offline sales. Each sale must include `client_txn_id`.
  Returns per-item results for the desktop outbox to ack.
  """
  def push_sales(branch_id, owner_id, business_id, cashier_id, sales) when is_list(sales) do
    Enum.map(sales, fn sale_attrs ->
      client_txn_id = sale_attrs["client_txn_id"] || sale_attrs[:client_txn_id]

      case Pos.create_sale(branch_id, owner_id, business_id, cashier_id, sale_attrs) do
        {:ok, sale} ->
          %{
            client_txn_id: client_txn_id,
            status: "ok",
            sale_id: sale.id,
            invoice_number: sale.invoice_number,
            fbr_invoice_no: sale.fbr_invoice_no
          }

        {:error, reason} ->
          %{
            client_txn_id: client_txn_id,
            status: "error",
            error: inspect(reason)
          }
      end
    end)
  end

  def list_branch_stock(business_id, owner_id, branch_id) do
    from(i in InventoryRecord,
      join: p in Product,
      on: p.id == i.product_id,
      where:
        i.business_id == ^business_id and i.owner_id == ^owner_id and i.branch_id == ^branch_id,
      select: %{
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        quantity_on_hand: i.quantity_on_hand
      }
    )
    |> Repo.all()
    |> Enum.map(fn row ->
      %{
        product_id: row.product_id,
        sku: row.sku,
        name: row.name,
        quantity_on_hand: to_string(row.quantity_on_hand || 0)
      }
    end)
  end
end
