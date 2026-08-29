defmodule Kaarobar.Purchasing do
  @moduledoc """
  Suppliers, orders, deliveries, invoices and payments.

  ## The shape of it

      purchase order   what we asked for      moves no stock
      goods receipt    what turned up         moves stock, creates batches
      supplier bill    what we were charged   moves the supplier ledger
      payment          what we paid           moves the supplier ledger back

  Four documents rather than one because in a real shop they diverge: the order
  is for a hundred, eighty arrive, the invoice covers those eighty plus a
  delivery from last week, and the payment clears three invoices at once.
  Collapsing any two of them makes a common case unrepresentable.

  ## Posting is the moment things become real

  Every document starts as a draft that changes nothing. Posting a receipt
  moves stock; posting a bill moves the ledger. That is what lets someone key a
  delivery in over an afternoon, and it is why a mistake caught before posting
  costs nothing.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Ecto.UUIDv7
  alias Kaarobar.Inventory
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Inventory.Ledger
  alias Kaarobar.Money
  alias Kaarobar.Purchasing.GoodsReceipt
  alias Kaarobar.Purchasing.GoodsReceiptItem
  alias Kaarobar.Purchasing.PurchaseOrder
  alias Kaarobar.Purchasing.PurchaseOrderItem
  alias Kaarobar.Purchasing.PurchaseReturn
  alias Kaarobar.Purchasing.PurchaseReturnItem
  alias Kaarobar.Purchasing.Supplier
  alias Kaarobar.Purchasing.SupplierBill
  alias Kaarobar.Purchasing.SupplierBillItem
  alias Kaarobar.Purchasing.SupplierLedgerEntry
  alias Kaarobar.Purchasing.SupplierPayment
  alias Kaarobar.Purchasing.SupplierPaymentAllocation
  alias Kaarobar.Purchasing.SupplierProduct
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Sequences

  # ===========================================================================
  # Suppliers
  # ===========================================================================

  @doc "Lists suppliers."
  @spec list_suppliers(Scope.t(), map()) :: [Supplier.t()]
  def list_suppliers(%Scope{} = scope, filters \\ %{}) do
    Supplier
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> apply_supplier_filters(filters)
    |> order_by([supplier], asc: supplier.name)
    |> Repo.all()
  end

  @doc "Fetches a supplier."
  @spec fetch_supplier(Scope.t(), Ecto.UUID.t()) :: {:ok, Supplier.t()} | {:error, :not_found}
  def fetch_supplier(%Scope{} = scope, id), do: fetch_scoped(Supplier, scope, id)

  @doc "Creates a supplier."
  @spec create_supplier(Scope.t(), map()) :: {:ok, Supplier.t()} | {:error, Ecto.Changeset.t()}
  def create_supplier(%Scope{} = scope, attrs) do
    %Supplier{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> Supplier.changeset(default_currency(scope, attrs))
    |> Repo.insert()
  end

  @doc "Updates a supplier."
  @spec update_supplier(Scope.t(), Supplier.t(), map()) ::
          {:ok, Supplier.t()} | {:error, Ecto.Changeset.t()}
  def update_supplier(%Scope{}, %Supplier{} = supplier, attrs) do
    supplier |> Supplier.changeset(attrs) |> Repo.update()
  end

  @doc """
  Archives a supplier.

  Refused while money is still owed: a supplier with an outstanding balance
  that disappears from the list is a debt nobody is tracking.
  """
  @spec archive_supplier(Scope.t(), Supplier.t()) ::
          {:ok, Supplier.t()} | {:error, :conflict | Ecto.Changeset.t()}
  def archive_supplier(%Scope{}, %Supplier{} = supplier) do
    if Money.zero?(supplier.balance) do
      supplier |> Supplier.soft_delete_changeset() |> Repo.update()
    else
      {:error, :conflict}
    end
  end

  defp apply_supplier_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"q", term}, acc when is_binary(term) and term != "" ->
        pattern = "%#{String.trim(term)}%"
        where(acc, [s], ilike(s.name, ^pattern) or ilike(s.code, ^pattern))

      {"active", "true"}, acc ->
        where(acc, [s], s.is_active)

      {"owing", "true"}, acc ->
        where(acc, [s], s.balance > 0)

      _other, acc ->
        acc
    end)
  end

  # ===========================================================================
  # Supplier prices
  # ===========================================================================

  @doc "Lists what a supplier sells and at what price."
  @spec list_supplier_products(Scope.t(), Supplier.t()) :: [SupplierProduct.t()]
  def list_supplier_products(%Scope{} = scope, %Supplier{} = supplier) do
    SupplierProduct
    |> Scoped.for_business(scope)
    |> where([sp], sp.supplier_id == ^supplier.id and sp.is_active)
    |> preload(variant: :product)
    |> Repo.all()
  end

  @doc "Lists every supplier who sells a variant, cheapest first."
  @spec suppliers_for_variant(Scope.t(), Ecto.UUID.t()) :: [SupplierProduct.t()]
  def suppliers_for_variant(%Scope{} = scope, variant_id) do
    SupplierProduct
    |> Scoped.for_business(scope)
    |> where([sp], sp.variant_id == ^variant_id and sp.is_active)
    |> order_by([sp], desc: sp.is_preferred, asc: sp.unit_cost)
    |> preload(:supplier)
    |> Repo.all()
  end

  @doc "Records or updates what a supplier charges for a variant."
  @spec put_supplier_product(Scope.t(), Supplier.t(), map()) ::
          {:ok, SupplierProduct.t()} | {:error, Ecto.Changeset.t()}
  def put_supplier_product(%Scope{} = scope, %Supplier{} = supplier, attrs) do
    attrs =
      attrs
      |> stringify()
      |> Map.merge(%{
        "business_id" => Scope.business_id(scope),
        "supplier_id" => supplier.id
      })

    %SupplierProduct{}
    |> SupplierProduct.changeset(attrs)
    |> Repo.insert(
      on_conflict:
        {:replace,
         [:supplier_sku, :supplier_name, :unit_cost, :minimum_order_quantity, :pack_size,
          :lead_time_days, :is_active, :updated_at]},
      conflict_target: [:supplier_id, :variant_id]
    )
  end

  # ===========================================================================
  # Purchase orders
  # ===========================================================================

  @doc "A query for purchase orders, filtered."
  @spec order_query(Scope.t(), map()) :: Ecto.Query.t()
  def order_query(%Scope{} = scope, filters \\ %{}) do
    PurchaseOrder
    |> Scoped.for_business(scope)
    |> Scoped.within_branches(scope)
    |> apply_order_filters(filters)
    |> preload([:supplier, :branch])
  end

  @doc "Lists purchase orders, newest first."
  @spec list_orders(Scope.t(), map()) :: [PurchaseOrder.t()]
  def list_orders(%Scope{} = scope, filters \\ %{}) do
    scope |> order_query(filters) |> order_by([order], desc: order.id) |> Repo.all()
  end

  @doc "Fetches a purchase order with its lines."
  @spec fetch_order(Scope.t(), Ecto.UUID.t()) :: {:ok, PurchaseOrder.t()} | {:error, :not_found}
  def fetch_order(%Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      PurchaseOrder
      |> Scoped.for_business(scope)
      |> where([order], order.id == ^id)
      |> preload([:supplier, :branch, items: [variant: :product]])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        order -> {:ok, order}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Creates a purchase order in draft, with its lines.

  Moves no stock. Totals are computed from the lines rather than accepted from
  the client, so an order cannot claim a total its lines do not add up to.
  """
  @spec create_order(Scope.t(), map()) :: {:ok, PurchaseOrder.t()} | {:error, term()}
  def create_order(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      with {:ok, number} <- Sequences.next(scope, "purchase_order"),
           {:ok, order} <- insert_order(scope, attrs, number),
           :ok <- replace_order_items(scope, order, Map.get(attrs, "items", [])),
           {:ok, totalled} <- recompute_order_totals(scope, order.id) do
        totalled
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp insert_order(%Scope{} = scope, attrs, number) do
    %PurchaseOrder{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      number: number,
      created_by_id: Scope.user_id(scope)
    }
    |> PurchaseOrder.changeset(default_currency(scope, attrs))
    |> Repo.insert()
  end

  @doc "Updates a draft order and its lines."
  @spec update_order(Scope.t(), PurchaseOrder.t(), map()) ::
          {:ok, PurchaseOrder.t()} | {:error, term()}
  def update_order(%Scope{} = scope, %PurchaseOrder{} = order, attrs) do
    if PurchaseOrder.editable?(order) do
      attrs = stringify(attrs)

      Repo.transaction(fn ->
        with {:ok, updated} <- order |> PurchaseOrder.changeset(attrs) |> Repo.update(),
             :ok <- maybe_replace_items(scope, updated, attrs),
             {:ok, totalled} <- recompute_order_totals(scope, updated.id) do
          totalled
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, :conflict}
    end
  end

  defp maybe_replace_items(%Scope{} = scope, order, attrs) do
    if Map.has_key?(attrs, "items") do
      replace_order_items(scope, order, Map.get(attrs, "items", []))
    else
      :ok
    end
  end

  defp replace_order_items(%Scope{} = scope, %PurchaseOrder{} = order, items) do
    Repo.delete_all(from item in PurchaseOrderItem, where: item.purchase_order_id == ^order.id)

    items
    |> List.wrap()
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {item, position}, _acc ->
      attrs =
        item
        |> stringify()
        |> Map.merge(%{
          "business_id" => Scope.business_id(scope),
          "purchase_order_id" => order.id,
          "position" => position
        })

      case %PurchaseOrderItem{} |> PurchaseOrderItem.changeset(attrs) |> Repo.insert() do
        {:ok, _inserted} -> {:cont, :ok}
        {:error, failed} -> {:halt, {:error, failed}}
      end
    end)
  end

  # Totals are derived, never accepted. A document whose total disagrees with
  # its lines is the sort of thing a supplier notices before the shop does.
  defp recompute_order_totals(%Scope{} = scope, order_id) do
    with {:ok, order} <- fetch_order(scope, order_id) do
      subtotal = order.items |> Enum.map(&PurchaseOrderItem.net_amount/1) |> Money.sum()
      tax_total = order.items |> Enum.map(& &1.tax_total) |> Money.sum()

      total =
        subtotal
        |> Money.add(tax_total)
        |> Money.add(order.shipping_total)

      totals = %{
        subtotal: Money.round(subtotal, order.currency),
        discount_total: Money.zero(),
        tax_total: Money.round(tax_total, order.currency),
        total: Money.round(total, order.currency)
      }

      with {:ok, _updated} <- order |> PurchaseOrder.totals_changeset(totals) |> Repo.update() do
        fetch_order(scope, order_id)
      end
    end
  end

  @doc """
  Approves an order: stock becomes expected.

  Increments `incoming` on each stock line so reorder suggestions stop
  proposing what is already on its way.
  """
  @spec approve_order(Scope.t(), PurchaseOrder.t()) ::
          {:ok, PurchaseOrder.t()} | {:error, term()}
  def approve_order(%Scope{} = scope, %PurchaseOrder{} = order) do
    if PurchaseOrder.editable?(order) do
      Repo.transaction(fn ->
        with {:ok, approved} <-
               order |> PurchaseOrder.approve_changeset(Scope.user_id(scope)) |> Repo.update(),
             :ok <- adjust_incoming(scope, order, :add) do
          Audit.log(scope, "purchase_order.approved", approved,
            entity_type: "purchase_order",
            label: order.number,
            summary: "Approved #{order.number} for #{Decimal.to_string(order.total, :normal)}"
          )

          reload_order(scope, approved.id)
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, :conflict}
    end
  end

  @doc "Cancels an order, releasing anything it had marked as incoming."
  @spec cancel_order(Scope.t(), PurchaseOrder.t()) ::
          {:ok, PurchaseOrder.t()} | {:error, term()}
  def cancel_order(%Scope{} = scope, %PurchaseOrder{} = order) do
    Repo.transaction(fn ->
      with :ok <- release_incoming_if_expected(scope, order),
           {:ok, cancelled} <- order |> PurchaseOrder.cancel_changeset() |> Repo.update() do
        Audit.log(scope, "purchase_order.cancelled", cancelled,
          entity_type: "purchase_order",
          label: order.number
        )

        cancelled
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Closes an order short.

  A supplier who is never going to send the last twelve units leaves an order
  sitting open forever, holding phantom `incoming` stock against every reorder
  calculation. Closing releases it.
  """
  @spec close_order(Scope.t(), PurchaseOrder.t()) :: {:ok, PurchaseOrder.t()} | {:error, term()}
  def close_order(%Scope{} = scope, %PurchaseOrder{} = order) do
    Repo.transaction(fn ->
      with :ok <- release_incoming_if_expected(scope, order),
           {:ok, closed} <- order |> PurchaseOrder.close_changeset() |> Repo.update() do
        closed
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp release_incoming_if_expected(%Scope{} = scope, %PurchaseOrder{} = order) do
    if order.status in PurchaseOrder.open_statuses() do
      adjust_incoming(scope, order, :remove)
    else
      :ok
    end
  end

  # `incoming` is a purchasing projection rather than a ledger one — it counts
  # what is expected, not what exists — so it is maintained here rather than by
  # the ledger, which only ever touches `on_hand`.
  defp adjust_incoming(%Scope{} = scope, %PurchaseOrder{} = order, direction) do
    order = if Ecto.assoc_loaded?(order.items), do: order, else: reload_order(scope, order.id)

    Enum.each(order.items, fn item ->
      outstanding = PurchaseOrderItem.outstanding_quantity(item)

      delta =
        case direction do
          :add -> outstanding
          :remove -> Decimal.negate(outstanding)
        end

      Inventory.adjust_incoming(scope, item.variant_id, order.branch_id, delta)
    end)

    :ok
  end

  defp reload_order(%Scope{} = scope, id) do
    {:ok, order} = fetch_order(scope, id)
    order
  end

  defp apply_order_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"status", value}, acc when is_binary(value) -> where(acc, [o], o.status == ^value)
      {"supplier_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [o], o.supplier_id == ^value), else: acc

      {"branch_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [o], o.branch_id == ^value), else: acc

      {"open", "true"}, acc ->
        statuses = PurchaseOrder.open_statuses()
        where(acc, [o], o.status in ^statuses)

      _other, acc ->
        acc
    end)
  end

  # ===========================================================================
  # Goods receipts
  # ===========================================================================

  @doc "Lists goods receipts, newest first."
  @spec list_receipts(Scope.t(), map()) :: [GoodsReceipt.t()]
  def list_receipts(%Scope{} = scope, filters \\ %{}) do
    GoodsReceipt
    |> Scoped.for_business(scope)
    |> Scoped.within_branches(scope)
    |> apply_receipt_filters(filters)
    |> order_by([receipt], desc: receipt.id)
    |> preload([:supplier, :branch, :purchase_order])
    |> Repo.all()
  end

  @doc "Fetches a receipt with its lines."
  @spec fetch_receipt(Scope.t(), Ecto.UUID.t()) :: {:ok, GoodsReceipt.t()} | {:error, :not_found}
  def fetch_receipt(%Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      GoodsReceipt
      |> Scoped.for_business(scope)
      |> where([receipt], receipt.id == ^id)
      |> preload([:supplier, :branch, :purchase_order, items: [:batch, variant: :product]])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        receipt -> {:ok, receipt}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Records a delivery as a draft. Nothing moves yet.

  Lines may name a `purchase_order_item_id` to book against an order, or stand
  alone — goods do turn up without an order behind them.
  """
  @spec create_receipt(Scope.t(), map()) :: {:ok, GoodsReceipt.t()} | {:error, term()}
  def create_receipt(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      with {:ok, number} <- Sequences.next(scope, "goods_receipt"),
           {:ok, receipt} <- insert_receipt(scope, attrs, number),
           :ok <- insert_receipt_items(scope, receipt, Map.get(attrs, "items", [])) do
        reload_receipt(scope, receipt.id)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp insert_receipt(%Scope{} = scope, attrs, number) do
    %GoodsReceipt{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      number: number,
      received_by_id: Scope.user_id(scope)
    }
    |> GoodsReceipt.changeset(Map.put_new(attrs, "received_on", Date.utc_today()))
    |> Repo.insert()
  end

  defp insert_receipt_items(%Scope{} = scope, %GoodsReceipt{} = receipt, items) do
    items
    |> List.wrap()
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {item, position}, _acc ->
      attrs =
        item
        |> stringify()
        |> Map.merge(%{
          "business_id" => Scope.business_id(scope),
          "goods_receipt_id" => receipt.id,
          "position" => position
        })

      case %GoodsReceiptItem{} |> GoodsReceiptItem.changeset(attrs) |> Repo.insert() do
        {:ok, _inserted} -> {:cont, :ok}
        {:error, failed} -> {:halt, {:error, failed}}
      end
    end)
  end

  @doc """
  Posts a delivery: stock arrives.

  In one transaction it creates any batches the lines describe, posts a
  `purchase` move per line at the cost actually charged, writes off anything
  that arrived broken, updates the order's received quantities and status, and
  releases the matching `incoming`.

  All of it or none of it. A half-posted delivery is stock that exists in one
  table and not another.
  """
  @spec post_receipt(Scope.t(), GoodsReceipt.t()) :: {:ok, GoodsReceipt.t()} | {:error, term()}
  def post_receipt(%Scope{} = scope, %GoodsReceipt{} = receipt) do
    if GoodsReceipt.editable?(receipt) do
      Repo.transaction(fn ->
        with {:ok, with_batches} <- ensure_batches(scope, receipt),
             {:ok, _moves} <- post_receipt_moves(scope, with_batches),
             :ok <- write_off_rejected(scope, with_batches),
             :ok <- apply_receipt_to_order(scope, with_batches),
             {:ok, posted} <- mark_receipt_posted(with_batches) do
          Audit.log(scope, "goods_receipt.posted", posted,
            entity_type: "goods_receipt",
            label: receipt.number,
            summary: "Received #{receipt.number} into stock"
          )

          reload_receipt(scope, posted.id)
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, :conflict}
    end
  end

  # Batch details come off the box in front of the person receiving. Turning
  # them into real batches here is what makes a recall traceable later.
  defp ensure_batches(%Scope{} = scope, %GoodsReceipt{} = receipt) do
    result =
      Enum.reduce_while(receipt.items, :ok, fn item, _acc ->
        if GoodsReceiptItem.batched?(item) and is_nil(item.batch_id) do
          case upsert_batch(scope, receipt, item) do
            {:ok, batch} ->
              item |> Ecto.Changeset.change(batch_id: batch.id) |> Repo.update!()
              {:cont, :ok}

            {:error, failed} ->
              {:halt, {:error, failed}}
          end
        else
          {:cont, :ok}
        end
      end)

    with :ok <- result, do: fetch_receipt(scope, receipt.id)
  end

  defp upsert_batch(%Scope{} = scope, %GoodsReceipt{} = receipt, %GoodsReceiptItem{} = item) do
    existing =
      Batch
      |> Scoped.for_business(scope)
      |> where([batch], batch.variant_id == ^item.variant_id)
      |> where([batch], batch.batch_number == ^item.batch_number)
      |> Repo.one()

    case existing do
      %Batch{} = batch ->
        {:ok, batch}

      nil ->
        Inventory.create_batch(scope, %{
          "variant_id" => item.variant_id,
          "batch_number" => item.batch_number,
          "manufactured_on" => item.manufactured_on,
          "expires_on" => item.expires_on,
          "supplier_id" => receipt.supplier_id,
          "unit_cost" => item.unit_cost
        })
    end
  end

  defp post_receipt_moves(%Scope{} = scope, %GoodsReceipt{} = receipt) do
    moves =
      Enum.map(receipt.items, fn item ->
        %{
          variant_id: item.variant_id,
          branch_id: receipt.branch_id,
          kind: "purchase",
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          batch_id: item.batch_id,
          reference_type: "goods_receipt",
          reference_id: receipt.id,
          reason: "Receipt #{receipt.number}"
        }
      end)

    Ledger.post_many(scope, moves)
  end

  # Booked in, then immediately written off. The shop needs both numbers: one
  # for the invoice it is being charged, one for the claim it is making.
  defp write_off_rejected(%Scope{} = scope, %GoodsReceipt{} = receipt) do
    rejected =
      receipt.items
      |> Enum.reject(&Money.zero?(&1.rejected_quantity || Money.zero()))
      |> Enum.map(fn item ->
        %{
          variant_id: item.variant_id,
          branch_id: receipt.branch_id,
          kind: "wastage",
          quantity: item.rejected_quantity,
          unit_cost: item.unit_cost,
          batch_id: item.batch_id,
          reference_type: "goods_receipt",
          reference_id: receipt.id,
          reason: "Damaged on delivery #{receipt.number}"
        }
      end)

    case rejected do
      [] -> :ok
      moves -> with {:ok, _posted} <- Ledger.post_many(scope, moves), do: :ok
    end
  end

  defp apply_receipt_to_order(_scope, %GoodsReceipt{purchase_order_id: nil}), do: :ok

  defp apply_receipt_to_order(%Scope{} = scope, %GoodsReceipt{} = receipt) do
    with {:ok, order} <- fetch_order(scope, receipt.purchase_order_id) do
      Enum.each(receipt.items, fn item ->
        if item.purchase_order_item_id do
          apply_receipt_line_to_order(scope, order, item, receipt)
        end
      end)

      refresh_order_status(scope, receipt.purchase_order_id)
    end
  end

  defp apply_receipt_line_to_order(
         %Scope{} = scope,
         order,
         %GoodsReceiptItem{} = item,
         %GoodsReceipt{} = receipt
       ) do
    case Enum.find(order.items, &(&1.id == item.purchase_order_item_id)) do
      nil ->
        :ok

      order_item ->
        {:ok, _updated} =
          order_item
          |> PurchaseOrderItem.receive_changeset(item.quantity)
          |> Repo.update()

        # What has arrived is no longer on its way.
        Inventory.adjust_incoming(
          scope,
          order_item.variant_id,
          receipt.branch_id,
          Decimal.negate(item.quantity)
        )
    end
  end

  defp refresh_order_status(%Scope{} = scope, order_id) do
    with {:ok, order} <- fetch_order(scope, order_id) do
      status = PurchaseOrder.status_from_items(order.items, order.status)

      if status != order.status do
        {:ok, _updated} = order |> PurchaseOrder.status_changeset(status) |> Repo.update()
      end

      :ok
    end
  end

  defp mark_receipt_posted(%GoodsReceipt{} = receipt) do
    subtotal = receipt.items |> Enum.map(&GoodsReceiptItem.net_amount/1) |> Money.sum()

    totals = %{
      subtotal: subtotal,
      tax_total: Money.zero(),
      total: Money.add(subtotal, receipt.shipping_total)
    }

    receipt |> GoodsReceipt.post_changeset(totals) |> Repo.update()
  end

  defp reload_receipt(%Scope{} = scope, id) do
    {:ok, receipt} = fetch_receipt(scope, id)
    receipt
  end

  defp apply_receipt_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"status", value}, acc when is_binary(value) -> where(acc, [r], r.status == ^value)
      {"supplier_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [r], r.supplier_id == ^value), else: acc

      {"purchase_order_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [r], r.purchase_order_id == ^value), else: acc

      _other, acc ->
        acc
    end)
  end

  # ===========================================================================
  # Bills and payments
  # ===========================================================================

  @doc "Lists supplier bills, newest first."
  @spec list_bills(Scope.t(), map()) :: [SupplierBill.t()]
  def list_bills(%Scope{} = scope, filters \\ %{}) do
    SupplierBill
    |> Scoped.for_business(scope)
    |> apply_bill_filters(filters)
    |> order_by([bill], desc: bill.id)
    |> preload([:supplier])
    |> Repo.all()
  end

  @doc "Fetches a bill with its lines."
  @spec fetch_bill(Scope.t(), Ecto.UUID.t()) :: {:ok, SupplierBill.t()} | {:error, :not_found}
  def fetch_bill(%Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      SupplierBill
      |> Scoped.for_business(scope)
      |> where([bill], bill.id == ^id)
      |> preload([:supplier, :goods_receipt, items: [variant: :product]])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        bill -> {:ok, bill}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Creates a bill in draft.

  The due date defaults to the supplier's agreed terms, which is what makes an
  ageing report mean anything later.
  """
  @spec create_bill(Scope.t(), map()) :: {:ok, SupplierBill.t()} | {:error, term()}
  def create_bill(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      with {:ok, supplier} <- fetch_supplier(scope, Map.get(attrs, "supplier_id")),
           {:ok, number} <- Sequences.next(scope, "supplier_bill"),
           {:ok, bill} <- insert_bill(scope, supplier, attrs, number),
           :ok <- insert_bill_items(scope, bill, Map.get(attrs, "items", [])),
           {:ok, totalled} <- recompute_bill_totals(scope, bill.id) do
        totalled
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp insert_bill(%Scope{} = scope, %Supplier{} = supplier, attrs, number) do
    issued_on = parse_date(Map.get(attrs, "issued_on")) || Date.utc_today()

    attrs =
      attrs
      |> Map.put("issued_on", issued_on)
      |> Map.put_new("due_on", Supplier.due_date(supplier, issued_on))
      |> then(&default_currency(scope, &1))

    %SupplierBill{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      number: number,
      created_by_id: Scope.user_id(scope)
    }
    |> SupplierBill.changeset(attrs)
    |> Repo.insert()
  end

  defp insert_bill_items(%Scope{} = scope, %SupplierBill{} = bill, items) do
    items
    |> List.wrap()
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {item, position}, _acc ->
      attrs =
        item
        |> stringify()
        |> Map.merge(%{
          "business_id" => Scope.business_id(scope),
          "supplier_bill_id" => bill.id,
          "position" => position
        })

      case %SupplierBillItem{} |> SupplierBillItem.changeset(attrs) |> Repo.insert() do
        {:ok, _inserted} -> {:cont, :ok}
        {:error, failed} -> {:halt, {:error, failed}}
      end
    end)
  end

  defp recompute_bill_totals(%Scope{} = scope, bill_id) do
    with {:ok, bill} <- fetch_bill(scope, bill_id) do
      subtotal = bill.items |> Enum.map(&SupplierBillItem.net_amount/1) |> Money.sum()
      tax_total = bill.items |> Enum.map(& &1.tax_total) |> Money.sum()

      total =
        subtotal
        |> Money.add(tax_total)
        |> Money.add(bill.shipping_total)
        |> Money.sub(bill.discount_total)

      {:ok, _updated} =
        bill
        |> Ecto.Changeset.change(%{
          subtotal: Money.round(subtotal, bill.currency),
          tax_total: Money.round(tax_total, bill.currency),
          total: Money.round(total, bill.currency)
        })
        |> Repo.update()

      fetch_bill(scope, bill_id)
    end
  end

  @doc """
  Posts a bill: the debt becomes real and hits the supplier ledger.
  """
  @spec post_bill(Scope.t(), SupplierBill.t()) :: {:ok, SupplierBill.t()} | {:error, term()}
  def post_bill(%Scope{} = scope, %SupplierBill{} = bill) do
    if SupplierBill.editable?(bill) do
      Repo.transaction(fn ->
        totals = %{subtotal: bill.subtotal, tax_total: bill.tax_total, total: bill.total}

        with {:ok, posted} <- bill |> SupplierBill.post_changeset(totals) |> Repo.update(),
             {:ok, _entry} <-
               record_ledger_entry(scope, bill.supplier_id, %{
                 kind: "bill",
                 amount: bill.total,
                 reference_type: "supplier_bill",
                 reference_id: bill.id,
                 note: "Bill #{bill.number}"
               }) do
          Audit.log(scope, "supplier_bill.posted", posted,
            entity_type: "supplier_bill",
            label: bill.number,
            summary: "Posted #{bill.number} for #{Decimal.to_string(bill.total, :normal)}"
          )

          posted
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, :conflict}
    end
  end

  @doc """
  Records a payment to a supplier, optionally allocating it to bills.

  `allocations` maps bill ids to amounts. Anything unallocated stays on
  account, which is a legitimate and common state — a shop pays a round figure
  and the bookkeeper decides later what it clears.
  """
  @spec record_payment(Scope.t(), map()) :: {:ok, SupplierPayment.t()} | {:error, term()}
  def record_payment(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)
    allocations = Map.get(attrs, "allocations", %{})

    Repo.transaction(fn ->
      with {:ok, _supplier} <- fetch_supplier(scope, Map.get(attrs, "supplier_id")),
           {:ok, number} <- Sequences.next(scope, "supplier_payment"),
           {:ok, payment} <- insert_payment(scope, attrs, number),
           :ok <- allocate_payment(scope, payment, allocations),
           {:ok, _entry} <-
             record_ledger_entry(scope, payment.supplier_id, %{
               kind: "payment",
               amount: Decimal.negate(payment.amount),
               reference_type: "supplier_payment",
               reference_id: payment.id,
               note: "Payment #{payment.number}"
             }) do
        Audit.log(scope, "supplier_payment.recorded", payment,
          entity_type: "supplier_payment",
          label: payment.number,
          summary: "Paid #{Decimal.to_string(payment.amount, :normal)}"
        )

        Repo.preload(payment, :allocations, force: true)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp insert_payment(%Scope{} = scope, attrs, number) do
    amount = attrs |> Map.get("amount") |> Money.to_decimal()

    attrs =
      attrs
      |> Map.put_new("paid_on", Date.utc_today())
      |> then(&default_currency(scope, &1))

    %SupplierPayment{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      branch_id: Scope.branch_id(scope),
      number: number,
      unallocated_amount: amount,
      created_by_id: Scope.user_id(scope)
    }
    |> SupplierPayment.changeset(attrs)
    |> Repo.insert()
  end

  defp allocate_payment(%Scope{} = scope, %SupplierPayment{} = payment, allocations) do
    allocations
    |> stringify()
    |> Enum.reduce_while(:ok, fn {bill_id, amount}, _acc ->
      case allocate_to_bill(scope, payment, bill_id, Money.to_decimal(amount)) do
        :ok -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp allocate_to_bill(%Scope{} = scope, %SupplierPayment{} = payment, bill_id, amount) do
    with {:ok, bill} <- fetch_bill(scope, bill_id),
         :ok <- ensure_allocation_fits(bill, amount),
         {:ok, _allocation} <- insert_allocation(scope, payment, bill, amount),
         {:ok, _bill} <- bill |> SupplierBill.payment_changeset(amount) |> Repo.update(),
         {:ok, _payment} <- payment |> SupplierPayment.allocate_changeset(amount) |> Repo.update() do
      :ok
    end
  end

  # Allocating more to a bill than it is for would leave a credit hiding inside
  # a paid invoice, where nobody would look for it.
  defp ensure_allocation_fits(%SupplierBill{} = bill, amount) do
    if Decimal.compare(amount, SupplierBill.outstanding(bill)) == :gt do
      {:error, :allocation_exceeds_bill}
    else
      :ok
    end
  end

  defp insert_allocation(%Scope{} = scope, payment, bill, amount) do
    %SupplierPaymentAllocation{}
    |> SupplierPaymentAllocation.changeset(%{
      business_id: Scope.business_id(scope),
      supplier_payment_id: payment.id,
      supplier_bill_id: bill.id,
      amount: amount
    })
    |> Repo.insert()
  end

  defp apply_bill_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"status", value}, acc when is_binary(value) -> where(acc, [b], b.status == ^value)
      {"supplier_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [b], b.supplier_id == ^value), else: acc

      {"outstanding", "true"}, acc ->
        where(acc, [b], b.status in ["posted", "partially_paid"])

      {"overdue", "true"}, acc ->
        today = Date.utc_today()

        where(
          acc,
          [b],
          b.status in ["posted", "partially_paid"] and not is_nil(b.due_on) and b.due_on < ^today
        )

      _other, acc ->
        acc
    end)
  end

  # ===========================================================================
  # Returns
  # ===========================================================================

  @doc "Lists returns to suppliers."
  @spec list_returns(Scope.t(), map()) :: [PurchaseReturn.t()]
  def list_returns(%Scope{} = scope, _filters \\ %{}) do
    PurchaseReturn
    |> Scoped.for_business(scope)
    |> order_by([record], desc: record.id)
    |> preload([:supplier, :branch])
    |> Repo.all()
  end

  @doc "Fetches a return with its lines."
  @spec fetch_return(Scope.t(), Ecto.UUID.t()) ::
          {:ok, PurchaseReturn.t()} | {:error, :not_found}
  def fetch_return(%Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      PurchaseReturn
      |> Scoped.for_business(scope)
      |> where([record], record.id == ^id)
      |> preload([:supplier, :branch, items: [variant: :product]])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        record -> {:ok, record}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Creates a return in draft."
  @spec create_return(Scope.t(), map()) :: {:ok, PurchaseReturn.t()} | {:error, term()}
  def create_return(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      with {:ok, number} <- Sequences.next(scope, "purchase_return"),
           {:ok, record} <- insert_return(scope, attrs, number),
           :ok <- insert_return_items(scope, record, Map.get(attrs, "items", [])) do
        reload_return(scope, record.id)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp insert_return(%Scope{} = scope, attrs, number) do
    %PurchaseReturn{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      number: number,
      created_by_id: Scope.user_id(scope)
    }
    |> PurchaseReturn.changeset(Map.put_new(attrs, "returned_on", Date.utc_today()))
    |> Repo.insert()
  end

  defp insert_return_items(%Scope{} = scope, %PurchaseReturn{} = record, items) do
    items
    |> List.wrap()
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {item, position}, _acc ->
      attrs =
        item
        |> stringify()
        |> Map.merge(%{
          "business_id" => Scope.business_id(scope),
          "purchase_return_id" => record.id,
          "position" => position
        })

      case %PurchaseReturnItem{} |> PurchaseReturnItem.changeset(attrs) |> Repo.insert() do
        {:ok, _inserted} -> {:cont, :ok}
        {:error, failed} -> {:halt, {:error, failed}}
      end
    end)
  end

  @doc """
  Posts a return: stock leaves and the supplier is credited.

  Both in one transaction. Stock that left the shop but is still owed for shows
  up as a loss; a credit against stock still on the shelf shows up as a
  windfall.
  """
  @spec post_return(Scope.t(), PurchaseReturn.t()) ::
          {:ok, PurchaseReturn.t()} | {:error, term()}
  def post_return(%Scope{} = scope, %PurchaseReturn{} = record) do
    if PurchaseReturn.editable?(record) do
      Repo.transaction(fn ->
        moves =
          Enum.map(record.items, fn item ->
            %{
              variant_id: item.variant_id,
              branch_id: record.branch_id,
              kind: "purchase_return",
              quantity: item.quantity,
              unit_cost: item.unit_cost,
              batch_id: item.batch_id,
              reference_type: "purchase_return",
              reference_id: record.id,
              reason: record.reason || "Return #{record.number}"
            }
          end)

        subtotal = record.items |> Enum.map(&PurchaseReturnItem.net_amount/1) |> Money.sum()
        totals = %{subtotal: subtotal, tax_total: Money.zero(), total: subtotal}

        with {:ok, _posted_moves} <- Ledger.post_many(scope, moves),
             {:ok, posted} <- record |> PurchaseReturn.post_changeset(totals) |> Repo.update(),
             {:ok, _entry} <-
               record_ledger_entry(scope, record.supplier_id, %{
                 kind: "credit_note",
                 amount: Decimal.negate(totals.total),
                 reference_type: "purchase_return",
                 reference_id: record.id,
                 note: "Return #{record.number}"
               }) do
          Audit.log(scope, "purchase_return.posted", posted,
            entity_type: "purchase_return",
            label: record.number,
            summary: "Returned goods worth #{Decimal.to_string(totals.total, :normal)}"
          )

          reload_return(scope, posted.id)
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, :conflict}
    end
  end

  defp reload_return(%Scope{} = scope, id) do
    {:ok, record} = fetch_return(scope, id)
    record
  end

  # ===========================================================================
  # Supplier ledger
  # ===========================================================================

  @doc "The running account with one supplier, oldest first."
  @spec supplier_ledger(Scope.t(), Supplier.t()) :: [SupplierLedgerEntry.t()]
  def supplier_ledger(%Scope{} = scope, %Supplier{} = supplier) do
    SupplierLedgerEntry
    |> Scoped.for_business(scope)
    |> where([entry], entry.supplier_id == ^supplier.id)
    |> order_by([entry], asc: entry.occurred_at, asc: entry.id)
    |> Repo.all()
  end

  @doc """
  Writes a ledger entry and moves the supplier balance with it.

  The supplier row is locked first, for the same reason a stock item is: the
  entry's `balance_after` has to follow from a value nobody else can change in
  between.
  """
  @spec record_ledger_entry(Scope.t(), Ecto.UUID.t(), map()) ::
          {:ok, SupplierLedgerEntry.t()} | {:error, term()}
  def record_ledger_entry(%Scope{} = scope, supplier_id, attrs) do
    locked =
      Supplier
      |> where([supplier], supplier.id == ^supplier_id)
      |> lock("FOR UPDATE")
      |> Repo.one()

    case locked do
      nil ->
        {:error, :not_found}

      %Supplier{} = supplier ->
        amount = Money.to_decimal(Map.fetch!(attrs, :amount))
        balance_after = Money.add(supplier.balance, amount)

        entry_attrs =
          attrs
          |> Map.merge(%{
            organization_id: Scope.organization_id(scope),
            business_id: Scope.business_id(scope),
            supplier_id: supplier_id,
            amount: amount,
            balance_after: balance_after,
            occurred_at: Map.get(attrs, :occurred_at) || DateTime.utc_now(),
            actor_user_id: Scope.user_id(scope),
            actor_label: scope.user && scope.user.name
          })

        with {:ok, entry} <-
               %SupplierLedgerEntry{} |> SupplierLedgerEntry.changeset(entry_attrs) |> Repo.insert(),
             {:ok, _supplier} <-
               supplier |> Ecto.Changeset.change(balance: balance_after) |> Repo.update() do
          {:ok, entry}
        end
    end
  end

  @doc """
  What is owed, bucketed by how overdue it is.

  The buckets are against each supplier's own agreed terms rather than a flat
  thirty days, because that is what makes the number actionable.
  """
  @spec payables_ageing(Scope.t()) :: map()
  def payables_ageing(%Scope{} = scope) do
    today = Date.utc_today()

    bills =
      SupplierBill
      |> Scoped.for_business(scope)
      |> where([bill], bill.status in ["posted", "partially_paid"])
      |> preload(:supplier)
      |> Repo.all()

    Enum.reduce(bills, empty_ageing(), fn bill, acc ->
      bucket = ageing_bucket(bill, today)
      outstanding = SupplierBill.outstanding(bill)

      acc
      |> Map.update!(bucket, &Money.add(&1, outstanding))
      |> Map.update!(:total, &Money.add(&1, outstanding))
    end)
  end

  defp empty_ageing do
    %{
      current: Money.zero(),
      overdue_1_30: Money.zero(),
      overdue_31_60: Money.zero(),
      overdue_61_90: Money.zero(),
      overdue_90_plus: Money.zero(),
      total: Money.zero()
    }
  end

  defp ageing_bucket(%SupplierBill{due_on: nil}, _today), do: :current

  defp ageing_bucket(%SupplierBill{due_on: due_on}, today) do
    case Date.diff(today, due_on) do
      days when days <= 0 -> :current
      days when days <= 30 -> :overdue_1_30
      days when days <= 60 -> :overdue_31_60
      days when days <= 90 -> :overdue_61_90
      _older -> :overdue_90_plus
    end
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp fetch_scoped(schema, %Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      schema
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([record], record.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        record -> {:ok, record}
      end
    else
      {:error, :not_found}
    end
  end

  defp default_currency(%Scope{business: nil}, attrs), do: stringify(attrs)

  defp default_currency(%Scope{business: business}, attrs) do
    attrs |> stringify() |> Map.put_new("currency", business.currency)
  end

  defp parse_date(%Date{} = date), do: date

  defp parse_date(value) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, date} -> date
      {:error, _reason} -> nil
    end
  end

  defp parse_date(_value), do: nil

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
  end

  defp stringify(_attrs), do: %{}
end
