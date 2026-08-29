defmodule Kaarobar.Inventory do
  @moduledoc """
  Stock levels, movements, batches, transfers, counts and valuation.

  Everything that changes a stock level goes through
  `Kaarobar.Inventory.Ledger`. This context is the operations built on top of
  it — adjustments, transfers, counts — plus the reads a shop actually asks
  for: what is low, what is expiring, what is it all worth.

  ## Valuation reconciles by construction

  `valuation/2` sums `on_hand × average_cost` from `stock_items`, and
  `ledger_valuation/2` sums `total_cost` across every move. Under weighted
  average those agree to the rounding of the average; under FIFO the layers are
  authoritative and `layer_valuation/2` is exact. `reconcile/2` reports the
  three side by side, because a valuation nobody can tie back to the movements
  behind it is a number an accountant will not sign.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Catalog.Product
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Ecto.UUIDv7
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Inventory.CostLayer
  alias Kaarobar.Inventory.Ledger
  alias Kaarobar.Inventory.SerialNumber
  alias Kaarobar.Inventory.StockCount
  alias Kaarobar.Inventory.StockCountItem
  alias Kaarobar.Inventory.StockItem
  alias Kaarobar.Inventory.StockMove
  alias Kaarobar.Inventory.StockTransfer
  alias Kaarobar.Inventory.StockTransferItem
  alias Kaarobar.Money
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Sequences

  # ===========================================================================
  # Stock levels
  # ===========================================================================

  @doc """
  A query for stock levels, filtered.

  ## Filters

    * `"branch_id"` — one branch rather than all the caller can see
    * `"variant_id"`, `"category_id"`
    * `"low_stock"` — `"true"` for lines at or below their reorder point
    * `"in_stock"` — `"true"` to exclude lines at zero
    * `"q"` — product name or SKU
  """
  @spec stock_query(Scope.t(), map()) :: Ecto.Query.t()
  def stock_query(%Scope{} = scope, filters \\ %{}) do
    StockItem
    |> Scoped.for_business(scope)
    |> Scoped.within_branches(scope)
    |> apply_stock_filters(filters)
    |> preload([:branch, variant: :product])
  end

  @doc "Lists stock levels."
  @spec list_stock(Scope.t(), map()) :: [StockItem.t()]
  def list_stock(%Scope{} = scope, filters \\ %{}) do
    scope |> stock_query(filters) |> order_by([item], asc: item.id) |> Repo.all()
  end

  @doc "The stock level for one variant at one branch, if it has ever had one."
  @spec fetch_stock_item(Scope.t(), Ecto.UUID.t(), Ecto.UUID.t()) ::
          {:ok, StockItem.t()} | {:error, :not_found}
  def fetch_stock_item(%Scope{} = scope, variant_id, branch_id) do
    if UUIDv7.valid?(variant_id) and UUIDv7.valid?(branch_id) do
      StockItem
      |> Scoped.for_business(scope)
      |> where([item], item.variant_id == ^variant_id and item.branch_id == ^branch_id)
      |> preload([:branch, variant: :product])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        item -> {:ok, item}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  How much of a variant is available to sell at a branch.

  Zero when the variant has never been at that branch, which is the honest
  answer and lets a caller treat "never stocked" and "sold out" the same way.
  """
  @spec available(Scope.t(), Ecto.UUID.t(), Ecto.UUID.t()) :: Decimal.t()
  def available(%Scope{} = scope, variant_id, branch_id) do
    case fetch_stock_item(scope, variant_id, branch_id) do
      {:ok, item} -> StockItem.available(item)
      {:error, :not_found} -> Money.zero()
    end
  end

  @doc """
  Moves the `incoming` figure for a stock line.

  `incoming` counts what is expected rather than what exists, so it is not a
  ledger quantity and deliberately does not go through
  `Kaarobar.Inventory.Ledger` — that writes `on_hand`, which must always equal
  the sum of the moves. Approving a purchase order adds to `incoming`;
  receiving, cancelling or closing one takes it away.

  Clamped at zero: a double release would otherwise leave a negative figure
  that quietly inflates every reorder suggestion afterwards.
  """
  @spec adjust_incoming(Scope.t(), Ecto.UUID.t(), Ecto.UUID.t(), Decimal.t()) :: :ok
  def adjust_incoming(%Scope{} = scope, variant_id, branch_id, delta) do
    if Money.zero?(delta) do
      :ok
    else
      from(item in StockItem,
        where: item.branch_id == ^branch_id and item.variant_id == ^variant_id,
        where: item.business_id == ^Scope.business_id(scope),
        update: [set: [incoming: fragment("GREATEST(? + ?, 0)", item.incoming, ^delta)]]
      )
      |> Repo.update_all([])

      :ok
    end
  end

  @doc "Updates the reorder settings for a stock line."
  @spec update_stock_settings(Scope.t(), StockItem.t(), map()) ::
          {:ok, StockItem.t()} | {:error, Ecto.Changeset.t()}
  def update_stock_settings(%Scope{}, %StockItem{} = item, attrs) do
    item |> StockItem.changeset(attrs) |> Repo.update()
  end

  defp apply_stock_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"branch_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [i], i.branch_id == ^value), else: acc

      {"variant_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [i], i.variant_id == ^value), else: acc

      {"low_stock", "true"}, acc ->
        where(acc, [i], not is_nil(i.reorder_point) and i.on_hand - i.reserved <= i.reorder_point)

      {"in_stock", "true"}, acc ->
        where(acc, [i], i.on_hand > 0)

      {"category_id", value}, acc ->
        filter_by_category(acc, value)

      {"q", term}, acc when is_binary(term) and term != "" ->
        search_stock(acc, term)

      _other, acc ->
        acc
    end)
  end

  defp filter_by_category(query, category_id) do
    if UUIDv7.valid?(category_id) do
      from item in query,
        join: variant in ProductVariant,
        on: variant.id == item.variant_id,
        join: product in Product,
        on: product.id == variant.product_id,
        where: product.category_id == ^category_id
    else
      query
    end
  end

  defp search_stock(query, term) do
    pattern = "%#{String.trim(term)}%"

    from item in query,
      join: variant in ProductVariant,
      on: variant.id == item.variant_id,
      join: product in Product,
      on: product.id == variant.product_id,
      where: ilike(product.name, ^pattern) or ilike(variant.sku, ^pattern)
  end

  # ===========================================================================
  # Movements
  # ===========================================================================

  @doc "A query for the movement history, filtered."
  @spec move_query(Scope.t(), map()) :: Ecto.Query.t()
  def move_query(%Scope{} = scope, filters \\ %{}) do
    StockMove
    |> Scoped.for_business(scope)
    |> Scoped.within_branches(scope)
    |> apply_move_filters(filters)
    |> preload([:branch, :batch, variant: :product])
  end

  @doc """
  The ledger for one variant at one branch, oldest first.

  Oldest first because it is read as a running account — each row's
  `balance_after` should follow from the one above it.
  """
  @spec variant_ledger(Scope.t(), Ecto.UUID.t(), Ecto.UUID.t()) :: [StockMove.t()]
  def variant_ledger(%Scope{} = scope, variant_id, branch_id) do
    StockMove
    |> Scoped.for_business(scope)
    |> where([move], move.variant_id == ^variant_id and move.branch_id == ^branch_id)
    |> order_by([move], asc: move.occurred_at, asc: move.id)
    |> preload([:batch])
    |> Repo.all()
  end

  @doc """
  Corrects a stock level, with a reason.

  Deliberately requires one. An adjustment is the only way a number changes
  without a document behind it, so it is also the first thing anyone looks at
  when stock does not add up.
  """
  @spec adjust(Scope.t(), map()) :: {:ok, StockMove.t()} | {:error, term()}
  def adjust(%Scope{} = scope, attrs) do
    attrs = atomize(attrs)

    with :ok <- require_reason(attrs),
         {:ok, move} <-
           Ledger.post(scope, Map.merge(attrs, %{kind: "adjustment", reference_type: "adjustment"})) do
      Audit.log(scope, "stock.adjusted", nil,
        entity_type: "stock_move",
        entity_id: move.id,
        summary: "Adjusted by #{Decimal.to_string(move.quantity, :normal)}: #{move.reason}",
        metadata: %{variant_id: move.variant_id, branch_id: move.branch_id}
      )

      {:ok, move}
    end
  end

  @doc "Writes stock off — breakage, spoilage, theft."
  @spec write_off(Scope.t(), map()) :: {:ok, StockMove.t()} | {:error, term()}
  def write_off(%Scope{} = scope, attrs) do
    attrs = atomize(attrs)

    with :ok <- require_reason(attrs),
         {:ok, move} <-
           Ledger.post(scope, Map.merge(attrs, %{kind: "wastage", reference_type: "wastage"})) do
      Audit.log(scope, "stock.written_off", nil,
        entity_type: "stock_move",
        entity_id: move.id,
        summary: "Wrote off #{Decimal.to_string(Decimal.abs(move.quantity), :normal)}: #{move.reason}",
        metadata: %{value: move.total_cost && Decimal.to_string(move.total_cost, :normal)}
      )

      {:ok, move}
    end
  end

  @doc "Records the stock a business is starting with."
  @spec set_opening_stock(Scope.t(), map()) :: {:ok, StockMove.t()} | {:error, term()}
  def set_opening_stock(%Scope{} = scope, attrs) do
    attrs = atomize(attrs)

    Ledger.post(scope, Map.merge(attrs, %{kind: "opening", reference_type: "opening"}))
  end

  defp require_reason(attrs) do
    case Map.get(attrs, :reason) do
      reason when is_binary(reason) and reason != "" -> :ok
      _missing -> {:error, :reason_required}
    end
  end

  defp apply_move_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"branch_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [m], m.branch_id == ^value), else: acc

      {"variant_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [m], m.variant_id == ^value), else: acc

      {"batch_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [m], m.batch_id == ^value), else: acc

      {"kind", value}, acc when is_binary(value) ->
        where(acc, [m], m.kind == ^value)

      {"from", %DateTime{} = value}, acc ->
        where(acc, [m], m.occurred_at >= ^value)

      {"to", %DateTime{} = value}, acc ->
        where(acc, [m], m.occurred_at <= ^value)

      _other, acc ->
        acc
    end)
  end

  # ===========================================================================
  # Batches
  # ===========================================================================

  @doc "Lists batches, newest first."
  @spec list_batches(Scope.t(), map()) :: [Batch.t()]
  def list_batches(%Scope{} = scope, filters \\ %{}) do
    Batch
    |> Scoped.for_business(scope)
    |> apply_batch_filters(filters)
    |> order_by([batch], desc: batch.id)
    |> preload(variant: :product)
    |> Repo.all()
  end

  @doc "Fetches a batch."
  @spec fetch_batch(Scope.t(), Ecto.UUID.t()) :: {:ok, Batch.t()} | {:error, :not_found}
  def fetch_batch(%Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      Batch
      |> Scoped.for_business(scope)
      |> where([batch], batch.id == ^id)
      |> preload(variant: :product)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        batch -> {:ok, batch}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Creates a batch.

  Normally done by receiving a delivery. This exists for opening stock and for
  the correction that follows someone mistyping a lot number.
  """
  @spec create_batch(Scope.t(), map()) :: {:ok, Batch.t()} | {:error, Ecto.Changeset.t()}
  def create_batch(%Scope{} = scope, attrs) do
    attrs =
      attrs
      |> stringify()
      |> Map.put("organization_id", Scope.organization_id(scope))
      |> Map.put("business_id", Scope.business_id(scope))

    %Batch{} |> Batch.changeset(attrs) |> Repo.insert()
  end

  @doc """
  Quarantines or recalls a batch, taking it out of every pick list at once.

  The one operation that has to be immediate: a recall announced this morning
  must stop that lot being sold this afternoon, across every branch.
  """
  @spec set_batch_status(Scope.t(), Batch.t(), String.t()) ::
          {:ok, Batch.t()} | {:error, Ecto.Changeset.t()}
  def set_batch_status(%Scope{} = scope, %Batch{} = batch, status) do
    case batch |> Batch.status_changeset(status) |> Repo.update() do
      {:ok, updated} ->
        Audit.log(scope, "batch.status_changed", updated,
          entity_type: "batch",
          label: batch.batch_number,
          summary: "Batch #{batch.batch_number} marked #{status}",
          changes: %{before: %{status: batch.status}, after: %{status: status}}
        )

        {:ok, updated}

      {:error, failed} ->
        {:error, failed}
    end
  end

  @doc """
  Batches expiring within `days`, soonest first.

  The difference between marking stock down while it can still be sold and
  writing it off after it cannot.
  """
  @spec expiring_batches(Scope.t(), pos_integer()) :: [Batch.t()]
  def expiring_batches(%Scope{} = scope, days \\ 30) do
    cutoff = Date.add(Date.utc_today(), days)

    Batch
    |> Scoped.for_business(scope)
    |> where([batch], batch.status == "active" and batch.remaining_quantity > 0)
    |> where([batch], not is_nil(batch.expires_on) and batch.expires_on <= ^cutoff)
    |> order_by([batch], asc: batch.expires_on)
    |> preload(variant: :product)
    |> Repo.all()
  end

  @doc """
  The batch to sell from next: soonest expiry with stock left.

  First-expiry-first-out rather than first-in-first-out. In a shop with
  perishables they are usually the same, and where they differ the expiry is
  what matters — selling a fresher lot first guarantees the older one is
  written off.
  """
  @spec next_batch(Scope.t(), Ecto.UUID.t()) :: Batch.t() | nil
  def next_batch(%Scope{} = scope, variant_id) do
    today = Date.utc_today()

    Batch
    |> Scoped.for_business(scope)
    |> where([batch], batch.variant_id == ^variant_id)
    |> where([batch], batch.status == "active" and batch.remaining_quantity > 0)
    |> where([batch], is_nil(batch.expires_on) or batch.expires_on >= ^today)
    |> order_by([batch], asc_nulls_last: batch.expires_on, asc: batch.id)
    |> limit(1)
    |> Repo.one()
  end

  defp apply_batch_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"variant_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [b], b.variant_id == ^value), else: acc

      {"status", value}, acc when is_binary(value) ->
        where(acc, [b], b.status == ^value)

      {"in_stock", "true"}, acc ->
        where(acc, [b], b.remaining_quantity > 0)

      _other, acc ->
        acc
    end)
  end

  # ===========================================================================
  # Serial numbers
  # ===========================================================================

  @doc "Lists tracked units."
  @spec list_serials(Scope.t(), map()) :: [SerialNumber.t()]
  def list_serials(%Scope{} = scope, filters \\ %{}) do
    SerialNumber
    |> Scoped.for_business(scope)
    |> apply_serial_filters(filters)
    |> order_by([serial], desc: serial.id)
    |> preload(variant: :product)
    |> Repo.all()
  end

  @doc "Finds one unit by its serial — the warranty lookup."
  @spec find_serial(Scope.t(), String.t()) :: {:ok, SerialNumber.t()} | {:error, :not_found}
  def find_serial(%Scope{} = scope, serial) when is_binary(serial) do
    SerialNumber
    |> Scoped.for_business(scope)
    |> where([record], record.serial == ^String.trim(serial))
    |> preload(variant: :product)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      record -> {:ok, record}
    end
  end

  def find_serial(%Scope{}, _serial), do: {:error, :not_found}

  defp apply_serial_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"variant_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [s], s.variant_id == ^value), else: acc

      {"status", value}, acc when is_binary(value) ->
        where(acc, [s], s.status == ^value)

      {"branch_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [s], s.branch_id == ^value), else: acc

      _other, acc ->
        acc
    end)
  end

  # ===========================================================================
  # Transfers
  # ===========================================================================

  @doc "Lists transfers, newest first."
  @spec list_transfers(Scope.t(), map()) :: [StockTransfer.t()]
  def list_transfers(%Scope{} = scope, filters \\ %{}) do
    StockTransfer
    |> Scoped.for_business(scope)
    |> apply_transfer_filters(filters)
    |> order_by([transfer], desc: transfer.id)
    |> preload([:source_branch, :destination_branch, items: [variant: :product]])
    |> Repo.all()
  end

  @doc "Fetches a transfer with its lines."
  @spec fetch_transfer(Scope.t(), Ecto.UUID.t()) ::
          {:ok, StockTransfer.t()} | {:error, :not_found}
  def fetch_transfer(%Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      StockTransfer
      |> Scoped.for_business(scope)
      |> where([transfer], transfer.id == ^id)
      |> preload([:source_branch, :destination_branch, items: [variant: :product]])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        transfer -> {:ok, transfer}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Creates a transfer in draft, with its lines.

  Nothing moves until it is dispatched.
  """
  @spec create_transfer(Scope.t(), map()) ::
          {:ok, StockTransfer.t()} | {:error, Ecto.Changeset.t() | term()}
  def create_transfer(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      with {:ok, number} <- Sequences.next(scope, "stock_transfer"),
           {:ok, transfer} <- insert_transfer(scope, attrs, number),
           :ok <- insert_transfer_items(scope, transfer, Map.get(attrs, "items", [])) do
        reload_transfer(scope, transfer.id)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp insert_transfer(%Scope{} = scope, attrs, number) do
    %StockTransfer{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      number: number,
      created_by_id: Scope.user_id(scope)
    }
    |> StockTransfer.changeset(attrs)
    |> Repo.insert()
  end

  defp insert_transfer_items(%Scope{} = scope, %StockTransfer{} = transfer, items) do
    items
    |> List.wrap()
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {item, position}, _acc ->
      attrs =
        item
        |> stringify()
        |> Map.merge(%{
          "business_id" => Scope.business_id(scope),
          "stock_transfer_id" => transfer.id,
          "position" => position
        })

      case %StockTransferItem{} |> StockTransferItem.changeset(attrs) |> Repo.insert() do
        {:ok, _inserted} -> {:cont, :ok}
        {:error, failed} -> {:halt, {:error, failed}}
      end
    end)
  end

  @doc """
  Dispatches a transfer: the goods leave the source branch.

  Writes one `transfer_out` per line. From here the stock belongs to neither
  branch until it is received.
  """
  @spec dispatch_transfer(Scope.t(), StockTransfer.t()) ::
          {:ok, StockTransfer.t()} | {:error, term()}
  def dispatch_transfer(%Scope{} = scope, %StockTransfer{} = transfer) do
    if StockTransfer.editable?(transfer) do
      Repo.transaction(fn ->
        moves =
          Enum.map(transfer.items, fn item ->
            %{
              variant_id: item.variant_id,
              branch_id: transfer.source_branch_id,
              kind: "transfer_out",
              quantity: item.quantity,
              batch_id: item.batch_id,
              reference_type: "stock_transfer",
              reference_id: transfer.id,
              reason: "Transfer #{transfer.number}"
            }
          end)

        with {:ok, posted} <- Ledger.post_many(scope, moves),
             :ok <- carry_transfer_costs(transfer, posted),
             {:ok, dispatched} <-
               transfer
               |> StockTransfer.dispatch_changeset(Scope.user_id(scope))
               |> Repo.update() do
          Audit.log(scope, "stock_transfer.dispatched", dispatched,
            entity_type: "stock_transfer",
            label: transfer.number
          )

          reload_transfer(scope, dispatched.id)
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, :conflict}
    end
  end

  # The cost the goods left at, recorded on the line so the destination values
  # them at what they cost rather than at its own average.
  defp carry_transfer_costs(%StockTransfer{} = transfer, moves) do
    by_variant = Map.new(moves, &{&1.variant_id, &1.unit_cost})

    Enum.each(transfer.items, fn item ->
      case Map.get(by_variant, item.variant_id) do
        nil -> :ok
        cost -> item |> Ecto.Changeset.change(unit_cost: Decimal.abs(cost)) |> Repo.update!()
      end
    end)

    :ok
  end

  @doc """
  Receives a transfer: the goods arrive at the destination.

  `received` maps line ids to what actually turned up. A line not mentioned is
  taken as arriving in full — the common case, and one that should not require
  retyping every line.
  """
  @spec receive_transfer(Scope.t(), StockTransfer.t(), map()) ::
          {:ok, StockTransfer.t()} | {:error, term()}
  def receive_transfer(%Scope{} = scope, %StockTransfer{} = transfer, received \\ %{}) do
    if StockTransfer.in_transit?(transfer) do
      Repo.transaction(fn ->
        with :ok <- record_received_quantities(transfer, received),
             {:ok, reloaded} <- fetch_transfer(scope, transfer.id),
             {:ok, _posted} <- post_transfer_in(scope, reloaded),
             {:ok, done} <-
               reloaded
               |> StockTransfer.receive_changeset(Scope.user_id(scope))
               |> Repo.update() do
          log_transfer_receipt(scope, reloaded, done)
          reload_transfer(scope, done.id)
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, :conflict}
    end
  end

  defp record_received_quantities(%StockTransfer{} = transfer, received) do
    received = stringify(received)

    Enum.reduce_while(transfer.items, :ok, fn item, _acc ->
      quantity = Map.get(received, item.id, item.quantity)

      case item |> StockTransferItem.receive_changeset(quantity) |> Repo.update() do
        {:ok, _updated} -> {:cont, :ok}
        {:error, failed} -> {:halt, {:error, failed}}
      end
    end)
  end

  defp post_transfer_in(%Scope{} = scope, %StockTransfer{} = transfer) do
    moves =
      transfer.items
      |> Enum.reject(&Money.zero?(&1.received_quantity || Money.zero()))
      |> Enum.map(fn item ->
        %{
          variant_id: item.variant_id,
          branch_id: transfer.destination_branch_id,
          kind: "transfer_in",
          quantity: item.received_quantity,
          unit_cost: item.unit_cost,
          batch_id: item.batch_id,
          reference_type: "stock_transfer",
          reference_id: transfer.id,
          reason: "Transfer #{transfer.number}"
        }
      end)

    Ledger.post_many(scope, moves)
  end

  # A shortfall is the only signal a shop gets that stock is going missing
  # between two of its own branches, so it is called out rather than buried.
  defp log_transfer_receipt(%Scope{} = scope, %StockTransfer{} = before, transfer) do
    shortfalls = StockTransfer.discrepancies(before)

    summary =
      if shortfalls == [] do
        "Transfer #{transfer.number} received in full"
      else
        "Transfer #{transfer.number} received with #{length(shortfalls)} shortfall(s)"
      end

    Audit.log(scope, "stock_transfer.received", transfer,
      entity_type: "stock_transfer",
      label: transfer.number,
      summary: summary,
      metadata: %{shortfall_lines: Enum.map(shortfalls, & &1.variant_id)}
    )
  end

  @doc "Cancels a transfer that has not been dispatched."
  @spec cancel_transfer(Scope.t(), StockTransfer.t()) ::
          {:ok, StockTransfer.t()} | {:error, :conflict | Ecto.Changeset.t()}
  def cancel_transfer(%Scope{}, %StockTransfer{} = transfer) do
    if StockTransfer.editable?(transfer) do
      transfer |> StockTransfer.cancel_changeset() |> Repo.update()
    else
      {:error, :conflict}
    end
  end

  defp reload_transfer(%Scope{} = scope, id) do
    {:ok, transfer} = fetch_transfer(scope, id)
    transfer
  end

  defp apply_transfer_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"status", value}, acc when is_binary(value) -> where(acc, [t], t.status == ^value)
      {"branch_id", value}, acc -> transfer_branch_filter(acc, value)
      _other, acc -> acc
    end)
  end

  defp transfer_branch_filter(query, value) do
    if UUIDv7.valid?(value) do
      where(query, [t], t.source_branch_id == ^value or t.destination_branch_id == ^value)
    else
      query
    end
  end

  # ===========================================================================
  # Counts
  # ===========================================================================

  @doc "Lists stock counts, newest first."
  @spec list_counts(Scope.t(), map()) :: [StockCount.t()]
  def list_counts(%Scope{} = scope, filters \\ %{}) do
    StockCount
    |> Scoped.for_business(scope)
    |> Scoped.within_branches(scope)
    |> apply_count_filters(filters)
    |> order_by([count], desc: count.id)
    |> preload([:branch])
    |> Repo.all()
  end

  @doc "Fetches a count with its lines."
  @spec fetch_count(Scope.t(), Ecto.UUID.t()) :: {:ok, StockCount.t()} | {:error, :not_found}
  def fetch_count(%Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      StockCount
      |> Scoped.for_business(scope)
      |> where([count], count.id == ^id)
      |> preload([:branch, items: [variant: :product]])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        count -> {:ok, count}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Opens a count, snapshotting what the system currently believes.

  The expected quantities are frozen here rather than read at approval, so a
  sale rung up while counting does not become a phantom discrepancy the person
  counting gets blamed for.
  """
  @spec create_count(Scope.t(), map()) :: {:ok, StockCount.t()} | {:error, term()}
  def create_count(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      with {:ok, number} <- Sequences.next(scope, "stock_count"),
           {:ok, count} <- insert_count(scope, attrs, number),
           :ok <- snapshot_count_lines(scope, count, attrs) do
        reload_count(scope, count.id)
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp insert_count(%Scope{} = scope, attrs, number) do
    %StockCount{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      number: number,
      status: "counting",
      started_at: DateTime.utc_now(),
      created_by_id: Scope.user_id(scope)
    }
    |> StockCount.changeset(attrs)
    |> Repo.insert()
  end

  defp snapshot_count_lines(%Scope{} = scope, %StockCount{} = count, attrs) do
    filters =
      %{"branch_id" => count.branch_id}
      |> maybe_put("category_id", Map.get(attrs, "category_id"))

    scope
    |> list_stock(filters)
    |> Enum.reduce_while(:ok, fn item, _acc ->
      line = %{
        business_id: count.business_id,
        stock_count_id: count.id,
        variant_id: item.variant_id,
        expected_quantity: item.on_hand,
        unit_cost: item.average_cost
      }

      case %StockCountItem{} |> StockCountItem.changeset(line) |> Repo.insert() do
        {:ok, _inserted} -> {:cont, :ok}
        {:error, failed} -> {:halt, {:error, failed}}
      end
    end)
  end

  @doc "Records what was found on one line."
  @spec record_count(Scope.t(), StockCountItem.t(), map()) ::
          {:ok, StockCountItem.t()} | {:error, Ecto.Changeset.t()}
  def record_count(%Scope{} = scope, %StockCountItem{} = item, attrs) do
    item
    |> StockCountItem.count_changeset(stringify(attrs), Scope.user_id(scope))
    |> Repo.update()
  end

  @doc "Submits a finished count for approval, with its variance summarised."
  @spec submit_count(Scope.t(), StockCount.t()) :: {:ok, StockCount.t()} | {:error, term()}
  def submit_count(%Scope{} = _scope, %StockCount{} = count) do
    if StockCount.open?(count) do
      summary = summarise_count(count)

      with {:ok, submitted} <- count |> StockCount.submit_changeset(summary) |> Repo.update() do
        {:ok, %{submitted | items: count.items}}
      end
    else
      {:error, :conflict}
    end
  end

  defp summarise_count(%StockCount{items: items}) when is_list(items) do
    adjusting = Enum.filter(items, &StockCountItem.adjusts_stock?/1)

    %{
      variance_quantity: adjusting |> Enum.map(&StockCountItem.variance_of/1) |> Money.sum(),
      variance_value: adjusting |> Enum.map(&(&1.variance_value || Money.zero())) |> Money.sum(),
      line_count: length(adjusting)
    }
  end

  defp summarise_count(%StockCount{}) do
    %{variance_quantity: Money.zero(), variance_value: Money.zero(), line_count: 0}
  end

  @doc """
  Approves a count, posting one move per differing line.

  Only differing lines produce a move: writing a zero-variance move for every
  line of a full count would bury the real corrections in noise.
  """
  @spec approve_count(Scope.t(), StockCount.t()) :: {:ok, StockCount.t()} | {:error, term()}
  def approve_count(%Scope{} = scope, %StockCount{} = count) do
    if StockCount.awaiting_approval?(count) do
      Repo.transaction(fn ->
        moves =
          count.items
          |> Enum.filter(&StockCountItem.adjusts_stock?/1)
          |> Enum.map(fn item ->
            %{
              variant_id: item.variant_id,
              branch_id: count.branch_id,
              kind: "count",
              quantity: StockCountItem.variance_of(item),
              batch_id: item.batch_id,
              reference_type: "stock_count",
              reference_id: count.id,
              reason: item.reason || "Stock count #{count.number}"
            }
          end)

        with {:ok, posted} <- Ledger.post_many(scope, moves),
             {:ok, approved} <-
               count |> StockCount.approve_changeset(Scope.user_id(scope)) |> Repo.update() do
          touch_counted_at(count)

          Audit.log(scope, "stock_count.approved", approved,
            entity_type: "stock_count",
            label: count.number,
            summary:
              "Approved count #{count.number}: #{length(posted)} correction(s), " <>
                "value #{Decimal.to_string(count.variance_value, :normal)}"
          )

          reload_count(scope, approved.id)
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, :conflict}
    end
  end

  defp touch_counted_at(%StockCount{} = count) do
    variant_ids = Enum.map(count.items, & &1.variant_id)
    now = DateTime.utc_now()

    from(item in StockItem,
      where: item.branch_id == ^count.branch_id and item.variant_id in ^variant_ids
    )
    |> Repo.update_all(set: [last_counted_at: now])
  end

  @doc "Cancels a count without touching stock."
  @spec cancel_count(Scope.t(), StockCount.t()) ::
          {:ok, StockCount.t()} | {:error, :conflict | Ecto.Changeset.t()}
  def cancel_count(%Scope{}, %StockCount{status: "approved"}), do: {:error, :conflict}

  def cancel_count(%Scope{}, %StockCount{} = count) do
    count |> StockCount.cancel_changeset() |> Repo.update()
  end

  defp reload_count(%Scope{} = scope, id) do
    {:ok, count} = fetch_count(scope, id)
    count
  end

  defp apply_count_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"status", value}, acc when is_binary(value) -> where(acc, [c], c.status == ^value)
      {"branch_id", value}, acc ->
        if UUIDv7.valid?(value), do: where(acc, [c], c.branch_id == ^value), else: acc

      _other, acc ->
        acc
    end)
  end

  # ===========================================================================
  # Valuation
  # ===========================================================================

  @doc """
  What the stock is worth, from the projections.

  `on_hand × average_cost`, which is the fast answer and the one a dashboard
  shows.
  """
  @spec valuation(Scope.t(), map()) :: %{quantity: Decimal.t(), value: Decimal.t()}
  def valuation(%Scope{} = scope, filters \\ %{}) do
    query =
      scope
      |> stock_query(filters)
      |> exclude(:preload)
      |> select([item], %{
        quantity: sum(item.on_hand),
        value: sum(fragment("? * ?", item.on_hand, item.average_cost))
      })

    case Repo.one(query) do
      %{quantity: quantity, value: value} ->
        %{quantity: quantity || Money.zero(), value: value || Money.zero()}

      nil ->
        %{quantity: Money.zero(), value: Money.zero()}
    end
  end

  @doc """
  What the stock is worth according to the movement ledger.

  Sums `total_cost` across every move. Under weighted average this agrees with
  `valuation/2` to the rounding of the average; a wider gap means a projection
  has drifted from the ledger, which is the thing worth knowing.
  """
  @spec ledger_valuation(Scope.t(), map()) :: %{quantity: Decimal.t(), value: Decimal.t()}
  def ledger_valuation(%Scope{} = scope, filters \\ %{}) do
    query =
      scope
      |> move_query(filters)
      |> exclude(:preload)
      |> select([move], %{quantity: sum(move.quantity), value: sum(move.total_cost)})

    case Repo.one(query) do
      %{quantity: quantity, value: value} ->
        %{quantity: quantity || Money.zero(), value: value || Money.zero()}

      nil ->
        %{quantity: Money.zero(), value: Money.zero()}
    end
  end

  @doc """
  What the open FIFO layers are worth. Exact, for a business on FIFO.
  """
  @spec layer_valuation(Scope.t()) :: %{quantity: Decimal.t(), value: Decimal.t()}
  def layer_valuation(%Scope{} = scope) do
    query =
      CostLayer
      |> Scoped.for_business(scope)
      |> where([layer], layer.remaining_quantity > 0)
      |> select([layer], %{
        quantity: sum(layer.remaining_quantity),
        value: sum(fragment("? * ?", layer.remaining_quantity, layer.unit_cost))
      })

    case Repo.one(query) do
      %{quantity: quantity, value: value} ->
        %{quantity: quantity || Money.zero(), value: value || Money.zero()}

      nil ->
        %{quantity: Money.zero(), value: Money.zero()}
    end
  end

  @doc """
  The three valuations side by side, and whether they agree.

  A valuation nobody can tie back to the movements behind it is a number an
  accountant will not sign. This is the tie-back.
  """
  @spec reconcile(Scope.t(), map()) :: map()
  def reconcile(%Scope{} = scope, filters \\ %{}) do
    projected = valuation(scope, filters)
    ledger = ledger_valuation(scope, filters)
    layers = layer_valuation(scope)

    quantity_difference = Money.sub(projected.quantity, ledger.quantity)

    %{
      projected: projected,
      ledger: ledger,
      layers: layers,
      quantity_difference: quantity_difference,
      value_difference: Money.sub(projected.value, ledger.value),
      # Quantities must agree exactly: the projection is the sum of the moves,
      # so any difference at all means one of them is wrong.
      balanced: Money.zero?(quantity_difference)
    }
  end

  @doc """
  Stock lines at or below their reorder point, with a suggested order.

  What is already `incoming` counts against the suggestion, so a shop does not
  order the same thing three times while a delivery is in transit.
  """
  @spec reorder_suggestions(Scope.t(), map()) :: [map()]
  def reorder_suggestions(%Scope{} = scope, filters \\ %{}) do
    scope
    |> list_stock(Map.put(filters, "low_stock", "true"))
    |> Enum.map(fn item ->
      %{
        stock_item: item,
        variant: item.variant,
        available: StockItem.available(item),
        reorder_point: item.reorder_point,
        incoming: item.incoming,
        suggested_quantity: StockItem.suggested_order_quantity(item)
      }
    end)
    |> Enum.reject(&Money.zero?(&1.suggested_quantity))
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
  end

  defp stringify(_attrs), do: %{}

  # The ledger takes atom keys; controllers hand over string ones.
  defp atomize(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {key, value} when is_binary(key) -> {safe_atom(key), value}
      {key, value} -> {key, value}
    end)
  end

  @ledger_keys ~w(variant_id branch_id kind quantity unit_cost batch_id serial_id
                  reference_type reference_id reason note occurred_at)a

  # Only keys the ledger understands are converted, so a caller cannot grow the
  # atom table by posting arbitrary fields.
  defp safe_atom(key) do
    Enum.find(@ledger_keys, key, &(Atom.to_string(&1) == key))
  end
end
