defmodule Kaarobar.Inventory.Ledger do
  @moduledoc """
  The only way stock ever changes.

  Every purchase, sale, transfer, count correction and spillage in the system
  goes through `post/2` or `post_many/2`. Nothing else writes `stock_items`,
  `cost_layers` or `batches.remaining_quantity`, because a second writer means
  the ledger and the projections can disagree — and then neither number is
  trustworthy.

  ## What one post does, in order

  1. **Lock** the `stock_items` row with `SELECT … FOR UPDATE`, creating it if
     this variant has never been at this branch. Everything downstream depends
     on this: without it, two tills selling the last unit both read the same
     `on_hand` and both succeed.
  2. **Check availability**, unless the business permits negative stock.
  3. **Cost it** — consume FIFO layers, or recompute the weighted average.
  4. **Write the move**, with `balance_after` computed from the locked row.
  5. **Update the projections** — the stock item, the batch, the layers.

  All inside one transaction. A caller already in a transaction — checkout,
  receiving a delivery — gets its writes joined to theirs, which is what makes
  a sale atomic across pricing, stock and payment.

  ## Why the lock rather than an atomic UPDATE

  `UPDATE … SET on_hand = on_hand - 1` is atomic and would be enough if
  `on_hand` were the only thing to maintain. It is not: `balance_after` on the
  move, the FIFO layers consumed, and the batch drawdown all have to agree with
  the same read. The lock is what makes those four writes describe one moment.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Catalog.Product
  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Inventory.CostLayer
  alias Kaarobar.Inventory.StockItem
  alias Kaarobar.Inventory.StockMove
  alias Kaarobar.Money
  alias Kaarobar.Repo
  alias Kaarobar.Scope

  @type post_attrs :: %{
          required(:variant_id) => Ecto.UUID.t(),
          required(:branch_id) => Ecto.UUID.t(),
          required(:kind) => String.t(),
          required(:quantity) => Decimal.t(),
          optional(:unit_cost) => Decimal.t() | nil,
          optional(:batch_id) => Ecto.UUID.t() | nil,
          optional(:serial_id) => Ecto.UUID.t() | nil,
          optional(:reference_type) => String.t() | nil,
          optional(:reference_id) => Ecto.UUID.t() | nil,
          optional(:reason) => String.t() | nil,
          optional(:note) => String.t() | nil,
          optional(:occurred_at) => DateTime.t()
        }

  @type error ::
          :insufficient_stock
          | :batch_expired
          | :batch_not_sellable
          | :insufficient_batch_stock
          | :variant_not_stocked
          | :not_found
          | Ecto.Changeset.t()

  @doc """
  Posts one movement.

  Returns the written move, or an error naming what stopped it. Runs in its own
  transaction unless one is already open, in which case it joins it.

  ## Example

      Ledger.post(scope, %{
        variant_id: variant.id,
        branch_id: branch.id,
        kind: "purchase",
        quantity: Decimal.new(50),
        unit_cost: Decimal.new("120.00"),
        reference_type: "goods_receipt",
        reference_id: receipt.id
      })
  """
  @spec post(Scope.t(), post_attrs()) :: {:ok, StockMove.t()} | {:error, error()}
  def post(%Scope{} = scope, attrs) do
    Repo.transaction(fn ->
      case do_post(scope, attrs) do
        {:ok, move} -> move
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Posts several movements as one unit.

  Either all of them land or none do. A transfer is two moves, a sale of a
  bundle is one per component, and a partial success in either case leaves
  stock that never existed.

  Moves are sorted by `{branch_id, variant_id}` before posting. Two concurrent
  transactions touching the same pair of stock lines in opposite orders would
  otherwise deadlock, and a deadlock at the till looks like the system hanging.
  """
  @spec post_many(Scope.t(), [post_attrs()]) :: {:ok, [StockMove.t()]} | {:error, error()}
  def post_many(%Scope{} = scope, moves) do
    ordered = Enum.sort_by(moves, &{&1.branch_id, &1.variant_id})

    Repo.transaction(fn ->
      Enum.reduce_while(ordered, [], fn attrs, acc ->
        case do_post(scope, attrs) do
          {:ok, move} -> {:cont, [move | acc]}
          {:error, reason} -> {:halt, Repo.rollback(reason)}
        end
      end)
      |> Enum.reverse()
    end)
  end

  # ===========================================================================
  # The core
  # ===========================================================================

  defp do_post(%Scope{} = scope, attrs) do
    kind = Map.fetch!(attrs, :kind)
    quantity = attrs |> Map.fetch!(:quantity) |> Money.to_decimal()
    signed = StockMove.directional_quantity(kind, quantity)

    with {:ok, variant} <- fetch_variant(scope, Map.fetch!(attrs, :variant_id)),
         :ok <- ensure_stocked(variant),
         {:ok, item} <- lock_stock_item(scope, variant, Map.fetch!(attrs, :branch_id)),
         :ok <- check_availability(scope, item, signed),
         {:ok, batch} <- resolve_batch(scope, attrs, signed),
         {:ok, costing} <- apply_costing(scope, item, signed, attrs, batch),
         {:ok, move} <- insert_move(scope, item, attrs, signed, costing, batch),
         :ok <- update_projections(item, signed, costing, batch, move) do
      {:ok, move}
    end
  end

  # A service has no stock to move. Posting against one is a caller bug that
  # would otherwise create a phantom stock line nobody can explain.
  defp ensure_stocked(%ProductVariant{product: %Product{tracks_stock: true}}), do: :ok
  defp ensure_stocked(%ProductVariant{product: %Product{}}), do: {:error, :variant_not_stocked}
  # The product is always preloaded by fetch_variant/2; an unloaded one here
  # would mean a caller bypassed it, and refusing is safer than guessing.
  defp ensure_stocked(%ProductVariant{}), do: {:error, :variant_not_stocked}

  defp fetch_variant(%Scope{} = scope, variant_id) do
    business_id = Scope.business_id(scope)

    query =
      from variant in ProductVariant,
        where: variant.id == ^variant_id and variant.business_id == ^business_id,
        preload: :product

    case Repo.one(query) do
      nil -> {:error, :not_found}
      variant -> {:ok, variant}
    end
  end

  # The lock. Everything after this point reads a value nobody else can change
  # until the transaction ends.
  defp lock_stock_item(%Scope{} = scope, %ProductVariant{} = variant, branch_id) do
    query =
      from item in StockItem,
        where: item.branch_id == ^branch_id and item.variant_id == ^variant.id,
        lock: "FOR UPDATE"

    case Repo.one(query) do
      %StockItem{} = item -> {:ok, item}
      nil -> create_and_lock(scope, variant, branch_id)
    end
  end

  # First movement of this variant at this branch. Two concurrent first
  # movements race here, so the loser re-reads rather than failing: the unique
  # index is the arbiter.
  defp create_and_lock(%Scope{} = scope, %ProductVariant{} = variant, branch_id) do
    attrs = %{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      branch_id: branch_id,
      variant_id: variant.id
    }

    case %StockItem{} |> StockItem.new(attrs) |> Repo.insert() do
      {:ok, item} ->
        {:ok, item}

      {:error, _changeset} ->
        query =
          from item in StockItem,
            where: item.branch_id == ^branch_id and item.variant_id == ^variant.id,
            lock: "FOR UPDATE"

        case Repo.one(query) do
          nil -> {:error, :not_found}
          item -> {:ok, item}
        end
    end
  end

  defp check_availability(%Scope{} = scope, %StockItem{} = item, signed) do
    cond do
      Money.positive?(signed) -> :ok
      allows_negative_stock?(scope) -> :ok
      Decimal.compare(Money.add(item.on_hand, signed), 0) == :lt -> {:error, :insufficient_stock}
      true -> :ok
    end
  end

  defp allows_negative_stock?(%Scope{business: %{allow_negative_stock: allow}}), do: allow
  defp allows_negative_stock?(%Scope{}), do: false

  # ===========================================================================
  # Batches
  # ===========================================================================

  defp resolve_batch(_scope, attrs, _signed) when not is_map_key(attrs, :batch_id), do: {:ok, nil}

  defp resolve_batch(_scope, %{batch_id: nil}, _signed), do: {:ok, nil}

  defp resolve_batch(%Scope{} = scope, %{batch_id: batch_id} = attrs, signed) do
    business_id = Scope.business_id(scope)

    query =
      from batch in Batch,
        where: batch.id == ^batch_id and batch.business_id == ^business_id,
        lock: "FOR UPDATE"

    case Repo.one(query) do
      nil ->
        {:error, :not_found}

      %Batch{} = batch ->
        validate_batch_draw(batch, signed, occurred_on(attrs))
    end
  end

  defp validate_batch_draw(%Batch{} = batch, signed, today) do
    cond do
      # Stock coming in may replenish any batch that is not withdrawn.
      Money.positive?(signed) and batch.status in ["recalled", "quarantined"] ->
        {:error, :batch_not_sellable}

      Money.positive?(signed) ->
        {:ok, batch}

      # Selling from an expired lot is an offence, not a warning.
      Batch.expired?(batch, today) ->
        {:error, :batch_expired}

      batch.status != "active" ->
        {:error, :batch_not_sellable}

      Decimal.compare(Money.add(batch.remaining_quantity, signed), 0) == :lt ->
        {:error, :insufficient_batch_stock}

      true ->
        {:ok, batch}
    end
  end

  # ===========================================================================
  # Costing
  # ===========================================================================

  # Returns the unit and total cost this move should carry, plus any FIFO layer
  # bookkeeping to apply once the move is written.
  defp apply_costing(%Scope{} = scope, %StockItem{} = item, signed, attrs, batch) do
    if Money.positive?(signed) do
      cost_inbound(scope, item, signed, attrs, batch)
    else
      cost_outbound(scope, item, signed)
    end
  end

  defp cost_inbound(%Scope{} = scope, %StockItem{} = item, signed, attrs, batch) do
    unit_cost =
      attrs
      |> Map.get(:unit_cost)
      |> case do
        nil -> item.average_cost
        cost -> Money.to_decimal(cost)
      end

    layer =
      if fifo?(scope) do
        %{
          quantity: signed,
          unit_cost: unit_cost,
          batch_id: batch && batch.id,
          received_at: occurred_at(attrs)
        }
      end

    {:ok,
     %{
       unit_cost: unit_cost,
       total_cost: Money.mult(signed, unit_cost),
       # Weighted average moves only on the way in — selling does not change
       # what the remaining stock cost.
       new_average: weighted_average(item, signed, unit_cost),
       layer: layer,
       consumed: []
     }}
  end

  defp cost_outbound(%Scope{} = scope, %StockItem{} = item, signed) do
    magnitude = Decimal.abs(signed)

    if fifo?(scope) do
      {consumed, cost} = consume_layers(item, magnitude)

      unit_cost = if Money.positive?(magnitude), do: Money.div(cost, magnitude), else: Money.zero()

      {:ok,
       %{
         unit_cost: Money.round_working(unit_cost),
         total_cost: Decimal.negate(cost),
         new_average: item.average_cost,
         layer: nil,
         consumed: consumed
       }}
    else
      {:ok,
       %{
         unit_cost: item.average_cost,
         total_cost: Money.mult(signed, item.average_cost),
         new_average: item.average_cost,
         layer: nil,
         consumed: []
       }}
    end
  end

  defp fifo?(%Scope{business: %{costing_method: "fifo"}}), do: true
  defp fifo?(%Scope{}), do: false

  # (existing value + incoming value) / (existing quantity + incoming quantity).
  # Guarded because a business that permits negative stock can reach a
  # non-positive denominator, and dividing by it would poison every later cost.
  defp weighted_average(%StockItem{} = item, incoming, unit_cost) do
    total_quantity = Money.add(item.on_hand, incoming)

    if Money.positive?(total_quantity) do
      existing_value = Money.mult(item.on_hand, item.average_cost)
      incoming_value = Money.mult(incoming, unit_cost)

      existing_value
      |> Money.add(incoming_value)
      |> Money.div(total_quantity)
      |> Money.round_working()
    else
      unit_cost
    end
  end

  # Walks the oldest open layers until the quantity is satisfied, returning
  # what to decrement and what it cost.
  defp consume_layers(%StockItem{} = item, magnitude) do
    layers =
      Repo.all(
        from layer in CostLayer,
          where: layer.branch_id == ^item.branch_id and layer.variant_id == ^item.variant_id,
          where: layer.remaining_quantity > 0,
          order_by: [asc: layer.received_at, asc: layer.id],
          lock: "FOR UPDATE"
      )

    {taken, remaining, cost} =
      Enum.reduce(layers, {[], magnitude, Money.zero()}, fn layer, {taken, left, cost} ->
        if Money.positive?(left) do
          take = Money.min(left, layer.remaining_quantity)

          {
            [{layer, take} | taken],
            Money.sub(left, take),
            Money.add(cost, Money.mult(take, layer.unit_cost))
          }
        else
          {taken, left, cost}
        end
      end)

    # More was sold than any layer accounts for — possible only where negative
    # stock is permitted. The shortfall is costed at the last known price so the
    # margin is approximately right rather than zero.
    cost =
      if Money.positive?(remaining) do
        Money.add(cost, Money.mult(remaining, fallback_cost(layers, item)))
      else
        cost
      end

    {Enum.reverse(taken), cost}
  end

  defp fallback_cost([], %StockItem{average_cost: average}), do: average
  defp fallback_cost(layers, _item), do: layers |> List.last() |> Map.fetch!(:unit_cost)

  # ===========================================================================
  # Writing
  # ===========================================================================

  defp insert_move(%Scope{} = scope, %StockItem{} = item, attrs, signed, costing, batch) do
    move_attrs = %{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      branch_id: item.branch_id,
      variant_id: item.variant_id,
      kind: Map.fetch!(attrs, :kind),
      quantity: signed,
      unit_cost: costing.unit_cost,
      total_cost: costing.total_cost,
      balance_after: Money.add(item.on_hand, signed),
      batch_id: batch && batch.id,
      serial_id: Map.get(attrs, :serial_id),
      reference_type: Map.get(attrs, :reference_type),
      reference_id: Map.get(attrs, :reference_id),
      reason: Map.get(attrs, :reason),
      note: Map.get(attrs, :note),
      actor_user_id: Scope.user_id(scope),
      actor_label: scope.user && scope.user.name,
      occurred_at: occurred_at(attrs)
    }

    %StockMove{}
    |> StockMove.changeset(move_attrs)
    |> Repo.insert()
  end

  defp update_projections(%StockItem{} = item, signed, costing, batch, %StockMove{} = move) do
    item
    |> Ecto.Changeset.change(%{
      on_hand: move.balance_after,
      average_cost: costing.new_average,
      last_movement_at: move.occurred_at
    })
    |> Repo.update()
    |> case do
      {:ok, _item} ->
        write_layer(item, costing, move)
        consume_layer_rows(costing.consumed)
        update_batch(batch, signed)
        :ok

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  defp write_layer(_item, %{layer: nil}, _move), do: :ok

  defp write_layer(%StockItem{} = item, %{layer: layer}, %StockMove{} = move) do
    %CostLayer{}
    |> CostLayer.changeset(%{
      business_id: item.business_id,
      branch_id: item.branch_id,
      variant_id: item.variant_id,
      batch_id: layer.batch_id,
      quantity: layer.quantity,
      remaining_quantity: layer.quantity,
      unit_cost: layer.unit_cost,
      source_move_id: move.id,
      received_at: layer.received_at
    })
    |> Repo.insert!()

    :ok
  end

  defp consume_layer_rows(consumed) do
    Enum.each(consumed, fn {layer, taken} ->
      layer
      |> Ecto.Changeset.change(remaining_quantity: Money.sub(layer.remaining_quantity, taken))
      |> Repo.update!()
    end)
  end

  defp update_batch(nil, _signed), do: :ok

  defp update_batch(%Batch{} = batch, signed) do
    remaining = Money.add(batch.remaining_quantity, signed)

    received =
      if Money.positive?(signed),
        do: Money.add(batch.received_quantity, signed),
        else: batch.received_quantity

    batch
    |> Ecto.Changeset.change(%{
      remaining_quantity: remaining,
      received_quantity: received,
      status: batch_status(batch, remaining)
    })
    |> Repo.update!()

    :ok
  end

  # A depleted batch is marked as such so it stops appearing in pick lists,
  # but a recall or quarantine is a human decision and is left alone.
  defp batch_status(%Batch{status: status}, _remaining) when status in ["recalled", "quarantined"],
    do: status

  defp batch_status(%Batch{}, remaining) do
    if Money.positive?(remaining), do: "active", else: "depleted"
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp occurred_at(attrs), do: Map.get(attrs, :occurred_at) || DateTime.utc_now()

  defp occurred_on(attrs), do: attrs |> occurred_at() |> DateTime.to_date()
end
