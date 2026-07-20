defmodule Kaarobar.Inventory do
  import Ecto.Query
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{
    Product, ProductBranchPrice, InventoryRecord,
    PurchaseOrder, PurchaseOrderItem, GoodsReceipt, GoodsReceiptItem,
    StockTransfer, StockTransferItem, StockAdjustment
  }
  alias Ecto.Multi

  def create_product(business_id, owner_id, attrs) do
    %Product{}
    |> Product.changeset(Map.merge(attrs, %{business_id: business_id, owner_id: owner_id}))
    |> Repo.insert()
  end

  def list_products(business_id, owner_id) do
    Product
    |> where([p], p.business_id == ^business_id and p.owner_id == ^owner_id)
    |> Repo.all()
  end

  def get_product(product_id, business_id, owner_id) do
    Product
    |> where([p], p.id == ^product_id and p.business_id == ^business_id and p.owner_id == ^owner_id)
    |> Repo.one()
  end

  def set_branch_price(product_id, branch_id, owner_id, business_id, price) do
    case Repo.get_by(ProductBranchPrice, product_id: product_id, branch_id: branch_id) do
      nil ->
        %ProductBranchPrice{}
        |> ProductBranchPrice.changeset(%{
          product_id: product_id,
          branch_id: branch_id,
          owner_id: owner_id,
          business_id: business_id,
          price: price
        })
        |> Repo.insert()

      existing ->
        existing
        |> ProductBranchPrice.changeset(%{price: price})
        |> Repo.update()
    end
  end

  def get_inventory(branch_id, product_id, owner_id, business_id) do
    InventoryRecord
    |> where([i], i.branch_id == ^branch_id and i.product_id == ^product_id and
                  i.owner_id == ^owner_id and i.business_id == ^business_id)
    |> Repo.one()
  end

  def create_purchase_order(business_id, branch_id, owner_id, attrs) do
    Multi.new()
    |> Multi.insert(:po, fn _ ->
      %PurchaseOrder{}
      |> PurchaseOrder.changeset(Map.merge(attrs, %{
        business_id: business_id,
        branch_id: branch_id,
        owner_id: owner_id
      }))
    end)
    |> Multi.run(:items, fn _repo, %{po: po} ->
      items = attrs[:items] || []
      results = Enum.map(items, fn item_attrs ->
        %PurchaseOrderItem{}
        |> PurchaseOrderItem.changeset(Map.put(item_attrs, :purchase_order_id, po.id))
        |> Repo.insert()
      end)

      if Enum.all?(results, fn {status, _} -> status == :ok end) do
        {:ok, Enum.map(results, fn {:ok, item} -> item end)}
      else
        {:error, :item_insert_failed}
      end
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{po: po}} -> {:ok, po}
      {:error, _op, reason, _changes} -> {:error, reason}
    end
  end

  def create_goods_receipt(purchase_order_id, branch_id, owner_id, business_id, received_by_id, attrs) do
    Multi.new()
    |> Multi.insert(:gr, fn _ ->
      %GoodsReceipt{}
      |> GoodsReceipt.changeset(Map.merge(attrs, %{
        purchase_order_id: purchase_order_id,
        branch_id: branch_id,
        owner_id: owner_id,
        business_id: business_id,
        received_by_id: received_by_id
      }))
    end)
    |> Multi.run(:items, fn _repo, %{gr: gr} ->
      items = attrs[:items] || []
      results = Enum.map(items, fn item_attrs ->
        %GoodsReceiptItem{}
        |> GoodsReceiptItem.changeset(Map.put(item_attrs, :goods_receipt_id, gr.id))
        |> Repo.insert()
      end)

      if Enum.all?(results, fn {status, _} -> status == :ok end) do
        {:ok, Enum.map(results, fn {:ok, item} -> item end)}
      else
        {:error, :item_insert_failed}
      end
    end)
    |> Multi.run(:update_inventory, fn _repo, %{items: items} ->
      po = Repo.get(PurchaseOrder, purchase_order_id) |> Repo.preload(:items)

      Enum.each(items, fn gr_item ->
        po_item = Enum.find(po.items, fn i -> i.product_id == gr_item.product_id end)

        if po_item do
          case get_inventory(branch_id, gr_item.product_id, owner_id, business_id) do
            nil ->
              %InventoryRecord{}
              |> InventoryRecord.changeset(%{
                branch_id: branch_id,
                product_id: gr_item.product_id,
                owner_id: owner_id,
                business_id: business_id,
                quantity_on_hand: gr_item.quantity_received,
                avg_cost: po_item.unit_cost
              })
              |> Repo.insert()

            existing ->
              new_qty = Decimal.add(existing.quantity_on_hand, gr_item.quantity_received)
              total_old_cost = Decimal.mult(existing.quantity_on_hand, existing.avg_cost)
              total_new_cost = Decimal.mult(gr_item.quantity_received, po_item.unit_cost)
              new_avg_cost = Decimal.div(Decimal.add(total_old_cost, total_new_cost), new_qty)

              existing
              |> InventoryRecord.changeset(%{
                quantity_on_hand: new_qty,
                avg_cost: new_avg_cost
              })
              |> Repo.update()
          end
        end
      end)

      {:ok, :updated}
    end)
    |> Multi.run(:enqueue_journal, fn _repo, %{gr: gr} ->
      %{
        gr_id: gr.id,
        business_id: business_id,
        owner_id: owner_id,
        posted_by_id: received_by_id
      }
      |> Kaarobar.Workers.PostPurchaseJournalWorker.new()
      |> Oban.insert()
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{gr: gr}} -> {:ok, gr}
      {:error, _op, reason, _changes} -> {:error, reason}
    end
  end

  def create_stock_adjustment(branch_id, product_id, owner_id, business_id, adjusted_by_id, attrs) do
    reason = attrs[:reason_code] || attrs["reason_code"] || "adjustment"
    allowed = ~w(adjustment damage theft count_correction expired sample)

    if reason not in allowed do
      {:error, :invalid_reason_code}
    else
      Multi.new()
      |> Multi.insert(:adjustment, fn _ ->
        %StockAdjustment{}
        |> StockAdjustment.changeset(
          Map.merge(normalize_map(attrs), %{
            branch_id: branch_id,
            product_id: product_id,
            owner_id: owner_id,
            business_id: business_id,
            adjusted_by_id: adjusted_by_id,
            reason_code: reason
          })
        )
      end)
      |> Multi.run(:update_inventory, fn _repo, %{adjustment: adj} ->
        case get_inventory(branch_id, product_id, owner_id, business_id) do
          nil ->
            if Decimal.compare(adj.quantity_delta, 0) == :lt do
              {:error, :insufficient_stock}
            else
              %InventoryRecord{}
              |> InventoryRecord.changeset(%{
                branch_id: branch_id,
                product_id: product_id,
                owner_id: owner_id,
                business_id: business_id,
                quantity_on_hand: adj.quantity_delta,
                avg_cost: 0
              })
              |> Repo.insert()
            end

          existing ->
            new_qty = Decimal.add(existing.quantity_on_hand, adj.quantity_delta)

            if Decimal.compare(new_qty, 0) == :lt do
              {:error, :insufficient_stock}
            else
              existing
              |> InventoryRecord.changeset(%{quantity_on_hand: new_qty})
              |> Repo.update()
            end
        end
      end)
      |> Multi.run(:audit, fn _repo, %{adjustment: adj} ->
        Kaarobar.Audit.log(%{
          owner_id: owner_id,
          user_id: adjusted_by_id,
          action: "inventory.adjust",
          entity_type: "stock_adjustment",
          entity_id: adj.id,
          metadata: %{
            product_id: product_id,
            branch_id: branch_id,
            quantity_delta: to_string(adj.quantity_delta),
            reason_code: reason
          }
        })
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{adjustment: adj}} -> {:ok, adj}
        {:error, _op, reason, _} -> {:error, reason}
      end
    end
  end

  defp normalize_map(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_binary(k) ->
        key =
          try do
            String.to_existing_atom(k)
          rescue
            ArgumentError -> String.to_atom(k)
          end

        {key, v}

      {k, v} ->
        {k, v}
    end)
  end

  def list_inventory_for_branch(branch_id, owner_id, business_id) do
    InventoryRecord
    |> where([i], i.branch_id == ^branch_id and i.owner_id == ^owner_id and i.business_id == ^business_id)
    |> preload(:product)
    |> Repo.all()
  end

  def adjust_stock(branch_id, owner_id, business_id, adjusted_by_id, params) do
    create_stock_adjustment(
      branch_id,
      params["product_id"] || params[:product_id],
      owner_id,
      business_id,
      adjusted_by_id,
      %{
        quantity_delta: params["quantity_delta"] || params[:quantity_delta],
        reason_code: params["reason_code"] || params[:reason_code] || "adjustment",
        notes: params["notes"] || params[:notes]
      }
    )
  end

  def receive_goods(purchase_order_id, branch_id, owner_id, business_id, received_by_id, attrs) do
    create_goods_receipt(purchase_order_id, branch_id, owner_id, business_id, received_by_id, attrs)
  end

  def create_transfer(business_id, owner_id, params) do
    Multi.new()
    |> Multi.insert(:transfer, fn _ ->
      %StockTransfer{}
      |> StockTransfer.changeset(%{
        business_id: business_id,
        owner_id: owner_id,
        from_branch_id: params["from_branch_id"] || params[:from_branch_id],
        to_branch_id: params["to_branch_id"] || params[:to_branch_id],
        status: "pending",
        notes: params["notes"] || params[:notes]
      })
    end)
    |> Multi.run(:items, fn _repo, %{transfer: transfer} ->
      items = params["items"] || params[:items] || []

      results =
        Enum.map(items, fn item ->
          %StockTransferItem{}
          |> StockTransferItem.changeset(%{
            stock_transfer_id: transfer.id,
            product_id: item["product_id"] || item[:product_id],
            quantity: item["quantity"] || item[:quantity]
          })
          |> Repo.insert()
        end)

      if Enum.all?(results, &match?({:ok, _}, &1)) do
        {:ok, Enum.map(results, fn {:ok, i} -> i end)}
      else
        {:error, :item_insert_failed}
      end
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{transfer: transfer}} -> {:ok, transfer}
      {:error, _op, reason, _} -> {:error, reason}
    end
  end

  def confirm_transfer(transfer_id, owner_id) do
    transfer =
      Repo.get_by(StockTransfer, id: transfer_id, owner_id: owner_id)
      |> then(&(&1 && Repo.preload(&1, :items)))

    cond do
      is_nil(transfer) ->
        {:error, :not_found}

      transfer.status != "pending" ->
        {:error, :invalid_status}

      true ->
        Multi.new()
        |> Multi.run(:check_stock, fn _repo, _ ->
          Enum.reduce_while(transfer.items, {:ok, :ok}, fn item, acc ->
            from_inv =
              Repo.get_by(InventoryRecord,
                branch_id: transfer.from_branch_id,
                product_id: item.product_id,
                owner_id: owner_id
              )

            cond do
              is_nil(from_inv) ->
                {:halt, {:error, {:insufficient_stock, item.product_id}}}

              Decimal.compare(from_inv.quantity_on_hand, item.quantity) == :lt ->
                {:halt, {:error, {:insufficient_stock, item.product_id}}}

              true ->
                {:cont, acc}
            end
          end)
        end)
        |> Multi.update(:transfer, StockTransfer.changeset(transfer, %{status: "completed"}))
        |> Multi.run(:move_stock, fn _repo, _ ->
          Enum.reduce_while(transfer.items, {:ok, :moved}, fn item, acc ->
            from_inv =
              Repo.get_by!(InventoryRecord,
                branch_id: transfer.from_branch_id,
                product_id: item.product_id
              )

            {count, _} =
              from(i in InventoryRecord,
                where:
                  i.id == ^from_inv.id and i.quantity_on_hand >= ^item.quantity,
                update: [
                  set: [quantity_on_hand: fragment("quantity_on_hand - ?", ^item.quantity)]
                ]
              )
              |> Repo.update_all([])

            if count != 1 do
              {:halt, {:error, {:insufficient_stock, item.product_id}}}
            else
              case Repo.get_by(InventoryRecord,
                     branch_id: transfer.to_branch_id,
                     product_id: item.product_id
                   ) do
                nil ->
                  %InventoryRecord{}
                  |> InventoryRecord.changeset(%{
                    branch_id: transfer.to_branch_id,
                    product_id: item.product_id,
                    owner_id: transfer.owner_id,
                    business_id: transfer.business_id,
                    quantity_on_hand: item.quantity,
                    avg_cost: from_inv.avg_cost || Decimal.new(0)
                  })
                  |> Repo.insert()
                  |> case do
                    {:ok, _} -> {:cont, acc}
                    {:error, cs} -> {:halt, {:error, cs}}
                  end

                to_inv ->
                  to_inv
                  |> InventoryRecord.changeset(%{
                    quantity_on_hand: Decimal.add(to_inv.quantity_on_hand, item.quantity)
                  })
                  |> Repo.update()
                  |> case do
                    {:ok, _} -> {:cont, acc}
                    {:error, cs} -> {:halt, {:error, cs}}
                  end
              end
            end
          end)
        end)
        |> Repo.transaction()
        |> case do
          {:ok, %{transfer: t}} -> {:ok, t}
          {:error, _op, reason, _} -> {:error, reason}
        end
    end
  end
end
