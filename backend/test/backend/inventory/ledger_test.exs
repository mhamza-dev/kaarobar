defmodule Kaarobar.Inventory.LedgerTest do
  @moduledoc """
  The ledger is the only writer of stock levels, so its guarantees are the
  guarantees of the whole inventory system: the projection equals the sum of
  the moves, the last unit cannot be sold twice, and expired stock cannot be
  sold at all.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Catalog.Product
  alias Kaarobar.Inventory
  alias Kaarobar.Inventory.Ledger
  alias Kaarobar.Inventory.StockItem
  alias Kaarobar.Inventory.StockMove
  alias Kaarobar.Money
  alias Kaarobar.Tenancy

  defp d(value), do: Decimal.new(value)

  defp assert_qty(actual, expected) do
    assert Decimal.equal?(actual, Decimal.new(expected)),
           "expected #{expected}, got #{Decimal.to_string(actual, :normal)}"
  end

  setup do
    %{scope: scope, business: business, branch: branch} = owner_scope()
    variant = variant_fixture(scope, %{"price" => "150.00", "cost" => "100.00"})

    %{scope: scope, business: business, branch: branch, variant: variant}
  end

  describe "posting a move" do
    test "creates the stock line on first movement", %{scope: scope, variant: variant, branch: branch} do
      assert {:ok, move} =
               Ledger.post(scope, %{
                 variant_id: variant.id,
                 branch_id: branch.id,
                 kind: "purchase",
                 quantity: d("10"),
                 unit_cost: d("100.00")
               })

      assert_qty(move.quantity, "10")
      assert_qty(move.balance_after, "10")
      assert_qty(Inventory.available(scope, variant.id, branch.id), "10")
    end

    test "accumulates across moves", %{scope: scope, variant: variant, branch: branch} do
      stock_fixture(scope, variant, "10")
      stock_fixture(scope, variant, "5")

      assert_qty(Inventory.available(scope, variant.id, branch.id), "15")
    end

    test "normalises the sign to the kind", %{scope: scope, variant: variant, branch: branch} do
      stock_fixture(scope, variant, "10")

      # A caller asking to record a sale of 3 means minus three, whichever sign
      # they send. A mistyped minus must not turn a sale into a delivery.
      {:ok, positive} =
        Ledger.post(scope, %{
          variant_id: variant.id,
          branch_id: branch.id,
          kind: "sale",
          quantity: d("3")
        })

      assert_qty(positive.quantity, "-3")
      assert_qty(Inventory.available(scope, variant.id, branch.id), "7")
    end

    test "records who did it and when", %{scope: scope, variant: variant, branch: branch} do
      {:ok, move} =
        Ledger.post(scope, %{
          variant_id: variant.id,
          branch_id: branch.id,
          kind: "purchase",
          quantity: d("1")
        })

      assert move.actor_user_id == scope.user.id
      assert move.actor_label == scope.user.name
      assert %DateTime{} = move.occurred_at
    end

    test "refuses a move against a product that does not track stock", %{
      scope: scope,
      branch: branch
    } do
      service =
        product_fixture(scope, %{"name" => "Delivery fee", "kind" => "fee", "price" => "200"})

      variant = Product.default_variant(service)

      assert {:error, :variant_not_stocked} =
               Ledger.post(scope, %{
                 variant_id: variant.id,
                 branch_id: branch.id,
                 kind: "purchase",
                 quantity: d("1")
               })
    end
  end

  describe "the projection equals the ledger" do
    test "after an arbitrary sequence of moves", %{scope: scope, variant: variant, branch: branch} do
      stock_fixture(scope, variant, "100", unit_cost: "50.00")

      for {kind, quantity} <- [
            {"purchase", "40"},
            {"sale", "25"},
            {"wastage", "3"},
            {"sale_return", "5"},
            {"purchase", "10"},
            {"sale", "12"}
          ] do
        {:ok, _move} =
          Ledger.post(scope, %{
            variant_id: variant.id,
            branch_id: branch.id,
            kind: kind,
            quantity: d(quantity),
            unit_cost: d("50.00"),
            reason: "test"
          })
      end

      moves = Inventory.variant_ledger(scope, variant.id, branch.id)
      summed = moves |> Enum.map(& &1.quantity) |> Money.sum()

      {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)

      # 100 + 40 - 25 - 3 + 5 + 10 - 12
      assert_qty(item.on_hand, "115")
      assert Decimal.equal?(item.on_hand, summed)
    end

    test "balance_after follows the row above it", %{scope: scope, variant: variant, branch: branch} do
      stock_fixture(scope, variant, "50")

      for quantity <- ~w(10 5 20) do
        {:ok, _move} =
          Ledger.post(scope, %{
            variant_id: variant.id,
            branch_id: branch.id,
            kind: "sale",
            quantity: d(quantity)
          })
      end

      moves = Inventory.variant_ledger(scope, variant.id, branch.id)

      # Each row's balance is the one before it plus its own quantity. That is
      # what makes a discrepancy visible at the row it began.
      moves
      |> Enum.chunk_every(2, 1, :discard)
      |> Enum.each(fn [previous, current] ->
        expected = Money.add(previous.balance_after, current.quantity)

        assert Decimal.equal?(current.balance_after, expected),
               "balance broke between #{previous.id} and #{current.id}"
      end)
    end
  end

  describe "availability" do
    test "refuses to sell more than is there", %{scope: scope, variant: variant, branch: branch} do
      stock_fixture(scope, variant, "5")

      assert {:error, :insufficient_stock} =
               Ledger.post(scope, %{
                 variant_id: variant.id,
                 branch_id: branch.id,
                 kind: "sale",
                 quantity: d("6")
               })

      # And nothing changed.
      assert_qty(Inventory.available(scope, variant.id, branch.id), "5")
    end

    test "allows it when the business permits negative stock", %{
      scope: scope,
      business: business,
      variant: variant,
      branch: branch
    } do
      {:ok, _updated} =
        Tenancy.update_business(scope, business, %{"allow_negative_stock" => true})

      {:ok, reloaded} = Tenancy.fetch_business(scope, business.id)
      permissive = Kaarobar.Scope.put_business(scope, reloaded)

      stock_fixture(permissive, variant, "5")

      assert {:ok, move} =
               Ledger.post(permissive, %{
                 variant_id: variant.id,
                 branch_id: branch.id,
                 kind: "sale",
                 quantity: d("8")
               })

      assert_qty(move.balance_after, "-3")
    end

    test "reserved stock is not available", %{scope: scope, variant: variant, branch: branch} do
      stock_fixture(scope, variant, "10")
      {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)

      # Stock promised to an open ticket is physically present and not for sale.
      item |> Ecto.Changeset.change(reserved: d("4")) |> Repo.update!()

      assert_qty(Inventory.available(scope, variant.id, branch.id), "6")
    end
  end

  describe "weighted average costing" do
    test "moves only on the way in", %{scope: scope, variant: variant, branch: branch} do
      # 10 at 100, then 10 at 200, gives an average of 150.
      stock_fixture(scope, variant, "10", unit_cost: "100.00")
      stock_fixture(scope, variant, "10", unit_cost: "200.00")

      {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)
      assert Decimal.equal?(item.average_cost, d("150"))

      # Selling does not change what the remaining stock cost.
      {:ok, _move} =
        Ledger.post(scope, %{
          variant_id: variant.id,
          branch_id: branch.id,
          kind: "sale",
          quantity: d("5")
        })

      {:ok, after_sale} = Inventory.fetch_stock_item(scope, variant.id, branch.id)
      assert Decimal.equal?(after_sale.average_cost, d("150"))
    end

    test "a sale is costed at the running average", %{scope: scope, variant: variant, branch: branch} do
      stock_fixture(scope, variant, "10", unit_cost: "100.00")
      stock_fixture(scope, variant, "10", unit_cost: "200.00")

      {:ok, sale} =
        Ledger.post(scope, %{
          variant_id: variant.id,
          branch_id: branch.id,
          kind: "sale",
          quantity: d("4")
        })

      assert Decimal.equal?(sale.unit_cost, d("150"))
      assert Decimal.equal?(sale.total_cost, d("-600"))
    end
  end

  describe "FIFO costing" do
    setup %{scope: scope, business: business} do
      {:ok, _updated} = Tenancy.update_business(scope, business, %{"costing_method" => "fifo"})
      {:ok, reloaded} = Tenancy.fetch_business(scope, business.id)

      %{scope: Kaarobar.Scope.put_business(scope, reloaded)}
    end

    test "consumes the oldest layer first", %{scope: scope, variant: variant, branch: branch} do
      stock_fixture(scope, variant, "10", unit_cost: "100.00")
      stock_fixture(scope, variant, "10", unit_cost: "200.00")

      # The first four out came from the 100 layer, not from an average.
      {:ok, sale} =
        Ledger.post(scope, %{
          variant_id: variant.id,
          branch_id: branch.id,
          kind: "sale",
          quantity: d("4")
        })

      assert Decimal.equal?(sale.unit_cost, d("100"))
      assert Decimal.equal?(sale.total_cost, d("-400"))
    end

    test "spans layers when one is not enough", %{scope: scope, variant: variant, branch: branch} do
      stock_fixture(scope, variant, "10", unit_cost: "100.00")
      stock_fixture(scope, variant, "10", unit_cost: "200.00")

      # Twelve out: ten at 100 plus two at 200 is 1,400, an average of 116.67.
      {:ok, sale} =
        Ledger.post(scope, %{
          variant_id: variant.id,
          branch_id: branch.id,
          kind: "sale",
          quantity: d("12")
        })

      assert Decimal.equal?(sale.total_cost, d("-1400"))
    end

    test "layers reconcile with the stock level", %{scope: scope, variant: variant, branch: branch} do
      stock_fixture(scope, variant, "10", unit_cost: "100.00")
      stock_fixture(scope, variant, "10", unit_cost: "200.00")

      {:ok, _sale} =
        Ledger.post(scope, %{
          variant_id: variant.id,
          branch_id: branch.id,
          kind: "sale",
          quantity: d("12")
        })

      layers = Inventory.layer_valuation(scope)
      {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)

      assert Decimal.equal?(layers.quantity, item.on_hand)
      # Eight units left, all from the 200 layer.
      assert Decimal.equal?(layers.value, d("1600"))
    end
  end

  describe "batches" do
    test "drawing down a batch reduces its remaining quantity", %{
      scope: scope,
      variant: variant,
      branch: branch
    } do
      batch = batch_fixture(scope, variant, %{"batch_number" => "LOT-A"})
      stock_fixture(scope, variant, "20", batch_id: batch.id)

      {:ok, _sale} =
        Ledger.post(scope, %{
          variant_id: variant.id,
          branch_id: branch.id,
          kind: "sale",
          quantity: d("5"),
          batch_id: batch.id
        })

      {:ok, reloaded} = Inventory.fetch_batch(scope, batch.id)
      assert_qty(reloaded.remaining_quantity, "15")
    end

    test "an emptied batch is marked depleted", %{scope: scope, variant: variant, branch: branch} do
      batch = batch_fixture(scope, variant, %{"batch_number" => "LOT-B"})
      stock_fixture(scope, variant, "5", batch_id: batch.id)

      {:ok, _sale} =
        Ledger.post(scope, %{
          variant_id: variant.id,
          branch_id: branch.id,
          kind: "sale",
          quantity: d("5"),
          batch_id: batch.id
        })

      {:ok, reloaded} = Inventory.fetch_batch(scope, batch.id)
      assert reloaded.status == "depleted"
    end

    test "an expired batch cannot be sold from", %{scope: scope, variant: variant, branch: branch} do
      batch = batch_fixture(scope, variant, %{"batch_number" => "LOT-OLD"})
      stock_fixture(scope, variant, "10", batch_id: batch.id)

      # Selling past expiry is an offence in the regulated verticals, so the
      # ledger refuses rather than warning.
      batch
      |> Ecto.Changeset.change(expires_on: Date.add(Date.utc_today(), -1))
      |> Repo.update!()

      assert {:error, :batch_expired} =
               Ledger.post(scope, %{
                 variant_id: variant.id,
                 branch_id: branch.id,
                 kind: "sale",
                 quantity: d("1"),
                 batch_id: batch.id
               })
    end

    test "a recalled batch cannot be sold from", %{scope: scope, variant: variant, branch: branch} do
      batch = batch_fixture(scope, variant, %{"batch_number" => "LOT-RECALL"})
      stock_fixture(scope, variant, "10", batch_id: batch.id)
      {:ok, batch} = Inventory.fetch_batch(scope, batch.id)
      {:ok, _recalled} = Inventory.set_batch_status(scope, batch, "recalled")

      assert {:error, :batch_not_sellable} =
               Ledger.post(scope, %{
                 variant_id: variant.id,
                 branch_id: branch.id,
                 kind: "sale",
                 quantity: d("1"),
                 batch_id: batch.id
               })
    end

    test "a batch cannot go further negative than it holds", %{
      scope: scope,
      variant: variant,
      branch: branch
    } do
      batch = batch_fixture(scope, variant, %{"batch_number" => "LOT-C"})
      stock_fixture(scope, variant, "3", batch_id: batch.id)
      # Plenty of unbatched stock, but only three in this lot.
      stock_fixture(scope, variant, "50")

      assert {:error, :insufficient_batch_stock} =
               Ledger.post(scope, %{
                 variant_id: variant.id,
                 branch_id: branch.id,
                 kind: "sale",
                 quantity: d("4"),
                 batch_id: batch.id
               })
    end
  end

  describe "post_many/2" do
    test "is all or nothing", %{scope: scope, variant: variant, branch: branch} do
      other = variant_fixture(scope, %{"price" => "50.00"})
      stock_fixture(scope, variant, "10")
      stock_fixture(scope, other, "1")

      # The second line cannot be satisfied, so neither happens.
      assert {:error, :insufficient_stock} =
               Ledger.post_many(scope, [
                 %{variant_id: variant.id, branch_id: branch.id, kind: "sale", quantity: d("2")},
                 %{variant_id: other.id, branch_id: branch.id, kind: "sale", quantity: d("5")}
               ])

      assert_qty(Inventory.available(scope, variant.id, branch.id), "10")
      assert_qty(Inventory.available(scope, other.id, branch.id), "1")
    end

    test "posts every line when they all succeed", %{scope: scope, variant: variant, branch: branch} do
      other = variant_fixture(scope, %{"price" => "50.00"})
      stock_fixture(scope, variant, "10")
      stock_fixture(scope, other, "10")

      assert {:ok, moves} =
               Ledger.post_many(scope, [
                 %{variant_id: variant.id, branch_id: branch.id, kind: "sale", quantity: d("2")},
                 %{variant_id: other.id, branch_id: branch.id, kind: "sale", quantity: d("5")}
               ])

      assert length(moves) == 2
      assert_qty(Inventory.available(scope, variant.id, branch.id), "8")
      assert_qty(Inventory.available(scope, other.id, branch.id), "5")
    end
  end

  describe "immutability" do
    test "a move cannot be updated", %{scope: scope, variant: variant, branch: branch} do
      {:ok, move} =
        Ledger.post(scope, %{
          variant_id: variant.id,
          branch_id: branch.id,
          kind: "purchase",
          quantity: d("5")
        })

      # Enforced by the database, not by convention: correcting stock means
      # posting an opposing move, which leaves the mistake on the record.
      assert_raise Postgrex.Error, ~r/append-only/, fn ->
        move |> Ecto.Changeset.change(quantity: d("500")) |> Repo.update()
      end
    end

    test "a move of zero is refused", %{scope: scope, variant: variant, branch: branch} do
      assert {:error, changeset} =
               Ledger.post(scope, %{
                 variant_id: variant.id,
                 branch_id: branch.id,
                 kind: "adjustment",
                 quantity: d("0")
               })

      assert %Ecto.Changeset{} = changeset
    end
  end

  describe "tenant isolation" do
    test "another shop's variant cannot be moved", %{scope: scope, branch: branch} do
      %{scope: other} = owner_scope()
      theirs = variant_fixture(other, %{"price" => "10.00"})

      assert {:error, :not_found} =
               Ledger.post(scope, %{
                 variant_id: theirs.id,
                 branch_id: branch.id,
                 kind: "purchase",
                 quantity: d("1")
               })
    end

    test "stock levels do not leak between shops", %{scope: scope, variant: variant} do
      %{scope: other} = owner_scope()
      theirs = variant_fixture(other, %{"price" => "10.00"})

      stock_fixture(scope, variant, "10")
      stock_fixture(other, theirs, "999")

      mine = Inventory.list_stock(scope)

      assert Enum.map(mine, & &1.variant_id) == [variant.id]
      assert %StockItem{} = hd(mine)
    end
  end

  describe "StockMove helpers" do
    test "classify inbound and outbound kinds" do
      assert StockMove.inbound?("purchase")
      assert StockMove.inbound?("transfer_in")
      assert StockMove.outbound?("sale")
      assert StockMove.outbound?("wastage")

      # Adjustments and counts carry their own sign, which is the point of them.
      refute StockMove.inbound?("adjustment")
      refute StockMove.outbound?("adjustment")
    end

    test "directional_quantity normalises by kind" do
      assert Decimal.equal?(StockMove.directional_quantity("purchase", d("-5")), d("5"))
      assert Decimal.equal?(StockMove.directional_quantity("sale", d("5")), d("-5"))
      # An adjustment means what it says.
      assert Decimal.equal?(StockMove.directional_quantity("adjustment", d("-5")), d("-5"))
    end
  end
end
