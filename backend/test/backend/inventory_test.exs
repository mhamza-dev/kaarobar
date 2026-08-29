defmodule Kaarobar.InventoryTest do
  @moduledoc """
  The phase gate: receive a purchase order into a batch, transfer stock between
  branches, run a cycle count with variance approval, and produce a valuation
  that reconciles exactly against the movement ledger.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Inventory
  alias Kaarobar.Inventory.StockCount
  alias Kaarobar.Inventory.StockTransfer
  alias Kaarobar.Purchasing
  alias Kaarobar.Tenancy

  defp d(value), do: Decimal.new(value)

  defp assert_qty(actual, expected) do
    assert Decimal.equal?(actual, Decimal.new(expected)),
           "expected #{expected}, got #{Decimal.to_string(actual, :normal)}"
  end

  # A business on FIFO rather than the default weighted average.
  defp fifo_business do
    %{scope: scope, business: business, branch: branch} = owner_scope()
    {:ok, _updated} = Tenancy.update_business(scope, business, %{"costing_method" => "fifo"})
    {:ok, reloaded} = Tenancy.fetch_business(scope, business.id)

    %{scope: Kaarobar.Scope.put_business(scope, reloaded), branch: branch}
  end

  setup do
    %{scope: scope, branch: branch} = owner_scope()
    variant = variant_fixture(scope, %{"name" => "Widget", "price" => "150.00"})

    %{scope: scope, branch: branch, variant: variant}
  end

  # ===========================================================================
  # Gate 1 — receive a purchase order into a batch
  # ===========================================================================

  describe "gate: a purchase order received into a batch" do
    setup do
      %{scope: scope, branch: branch} = owner_scope(business_type: "agri_supplies")
      supplier = supplier_fixture(scope, %{"name" => "AgriCo", "payment_terms_days" => 30})

      herbicide =
        product_fixture(scope, %{
          "name" => "Glyphosate 41%",
          "price" => "1450.00",
          "registration_number" => "PK-2026-0041"
        })

      %{
        scope: scope,
        branch: branch,
        supplier: supplier,
        product: herbicide,
        variant: Kaarobar.Catalog.Product.default_variant(herbicide)
      }
    end

    test "moves stock, creates the lot, and closes the order", %{
      scope: scope,
      branch: branch,
      supplier: supplier,
      variant: variant
    } do
      # 1. Order a hundred litres.
      {:ok, order} =
        Purchasing.create_order(scope, %{
          "supplier_id" => supplier.id,
          "branch_id" => branch.id,
          "items" => [
            %{"variant_id" => variant.id, "ordered_quantity" => "100", "unit_cost" => "900.00"}
          ]
        })

      assert order.status == "draft"
      assert order.number =~ ~r/^PO-\d{4}-\d{4}$/
      assert Decimal.equal?(order.total, d("90000"))
      # Ordering moves nothing.
      assert_qty(Inventory.available(scope, variant.id, branch.id), "0")

      # 2. Approve it: the stock becomes expected.
      {:ok, approved} = Purchasing.approve_order(scope, order)
      assert approved.status == "approved"

      {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)
      assert_qty(item.incoming, "100")
      assert_qty(item.on_hand, "0")

      # 3. Eighty arrive, in one lot, with an expiry off the drum.
      order_item = hd(approved.items)

      {:ok, receipt} =
        Purchasing.create_receipt(scope, %{
          "supplier_id" => supplier.id,
          "branch_id" => branch.id,
          "purchase_order_id" => approved.id,
          "supplier_reference" => "DN-88213",
          "items" => [
            %{
              "variant_id" => variant.id,
              "purchase_order_item_id" => order_item.id,
              "quantity" => "80",
              "unit_cost" => "900.00",
              "batch_number" => "GLY-2026-A",
              "manufactured_on" => "2026-01-15",
              "expires_on" => "2028-01-15"
            }
          ]
        })

      assert receipt.status == "draft"
      # A draft receipt moves nothing either.
      assert_qty(Inventory.available(scope, variant.id, branch.id), "0")

      # 4. Post it. Now everything happens at once.
      {:ok, posted} = Purchasing.post_receipt(scope, receipt)

      assert posted.status == "posted"
      assert_qty(Inventory.available(scope, variant.id, branch.id), "80")

      # The lot exists, traceable by number for a recall.
      posted_item = hd(posted.items)
      refute is_nil(posted_item.batch_id)

      {:ok, batch} = Inventory.fetch_batch(scope, posted_item.batch_id)
      assert batch.batch_number == "GLY-2026-A"
      assert batch.expires_on == ~D[2028-01-15]
      assert_qty(batch.remaining_quantity, "80")

      # The order knows twenty are still owed, and says so.
      {:ok, reloaded_order} = Purchasing.fetch_order(scope, approved.id)
      assert reloaded_order.status == "partially_received"

      reloaded_item = hd(reloaded_order.items)
      assert_qty(reloaded_item.received_quantity, "80")
      assert_qty(Kaarobar.Purchasing.PurchaseOrderItem.outstanding_quantity(reloaded_item), "20")

      # And only twenty are still on their way.
      {:ok, after_receipt} = Inventory.fetch_stock_item(scope, variant.id, branch.id)
      assert_qty(after_receipt.incoming, "20")

      # The move names the receipt that caused it.
      [move] =
        scope
        |> Inventory.variant_ledger(variant.id, branch.id)
        |> Enum.filter(&(&1.kind == "purchase"))

      assert move.reference_type == "goods_receipt"
      assert move.reference_id == posted.id
      assert Decimal.equal?(move.unit_cost, d("900.00"))
    end

    test "damaged goods are booked in and written off", %{
      scope: scope,
      branch: branch,
      supplier: supplier,
      variant: variant
    } do
      {:ok, receipt} =
        Purchasing.create_receipt(scope, %{
          "supplier_id" => supplier.id,
          "branch_id" => branch.id,
          "items" => [
            %{
              "variant_id" => variant.id,
              "quantity" => "50",
              "rejected_quantity" => "3",
              "unit_cost" => "900.00"
            }
          ]
        })

      {:ok, _posted} = Purchasing.post_receipt(scope, receipt)

      # Fifty on the invoice, three written off, forty-seven sellable. The shop
      # needs both numbers: one to be charged, one to claim against.
      assert_qty(Inventory.available(scope, variant.id, branch.id), "47")

      kinds =
        scope
        |> Inventory.variant_ledger(variant.id, branch.id)
        |> Enum.map(& &1.kind)

      assert "purchase" in kinds
      assert "wastage" in kinds
    end

    test "receiving more than was ordered is refused", %{
      scope: scope,
      branch: branch,
      supplier: supplier,
      variant: variant
    } do
      {:ok, order} =
        Purchasing.create_order(scope, %{
          "supplier_id" => supplier.id,
          "branch_id" => branch.id,
          "items" => [
            %{"variant_id" => variant.id, "ordered_quantity" => "10", "unit_cost" => "900.00"}
          ]
        })

      {:ok, approved} = Purchasing.approve_order(scope, order)
      order_item = hd(approved.items)

      {:ok, receipt} =
        Purchasing.create_receipt(scope, %{
          "supplier_id" => supplier.id,
          "branch_id" => branch.id,
          "purchase_order_id" => approved.id,
          "items" => [
            %{
              "variant_id" => variant.id,
              "purchase_order_item_id" => order_item.id,
              "quantity" => "15",
              "unit_cost" => "900.00"
            }
          ]
        })

      # A delivery error worth catching, not something to absorb into stock.
      assert {:error, _reason} = Purchasing.post_receipt(scope, receipt)
    end

    test "closing an order short releases what it was holding", %{
      scope: scope,
      branch: branch,
      supplier: supplier,
      variant: variant
    } do
      {:ok, order} =
        Purchasing.create_order(scope, %{
          "supplier_id" => supplier.id,
          "branch_id" => branch.id,
          "items" => [
            %{"variant_id" => variant.id, "ordered_quantity" => "100", "unit_cost" => "900.00"}
          ]
        })

      {:ok, approved} = Purchasing.approve_order(scope, order)
      {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)
      assert_qty(item.incoming, "100")

      {:ok, closed} = Purchasing.close_order(scope, approved)
      assert closed.status == "closed"

      # Otherwise the order sits open forever, holding phantom incoming stock
      # against every reorder calculation.
      {:ok, after_close} = Inventory.fetch_stock_item(scope, variant.id, branch.id)
      assert_qty(after_close.incoming, "0")
    end
  end

  # ===========================================================================
  # Gate 2 — transfer stock between branches
  # ===========================================================================

  describe "gate: transferring stock between branches" do
    setup %{scope: scope, variant: variant} do
      destination = branch_fixture(scope, "Second shop")
      stock_fixture(scope, variant, "100", unit_cost: "80.00")

      %{destination: destination, variant: variant, scope: scope}
    end

    test "leaves one branch, sits in transit, then arrives at the other", %{
      scope: scope,
      branch: source,
      destination: destination,
      variant: variant
    } do
      {:ok, transfer} =
        Inventory.create_transfer(scope, %{
          "source_branch_id" => source.id,
          "destination_branch_id" => destination.id,
          "items" => [%{"variant_id" => variant.id, "quantity" => "30"}]
        })

      assert transfer.status == "draft"
      assert transfer.number =~ ~r/^TRF-/
      # A draft moves nothing.
      assert_qty(Inventory.available(scope, variant.id, source.id), "100")

      {:ok, dispatched} = Inventory.dispatch_transfer(scope, transfer)

      assert dispatched.status == "dispatched"
      assert StockTransfer.in_transit?(dispatched)
      # Gone from the source, not yet at the destination. The goods are on a
      # van and belong to neither branch.
      assert_qty(Inventory.available(scope, variant.id, source.id), "70")
      assert_qty(Inventory.available(scope, variant.id, destination.id), "0")

      {:ok, received} = Inventory.receive_transfer(scope, dispatched)

      assert received.status == "received"
      assert_qty(Inventory.available(scope, variant.id, destination.id), "30")
      # Nothing was created or destroyed in the move.
      assert_qty(Inventory.available(scope, variant.id, source.id), "70")
    end

    test "carries the cost across so valuation does not change", %{
      scope: scope,
      branch: source,
      destination: destination,
      variant: variant
    } do
      before = Inventory.valuation(scope)

      {:ok, transfer} =
        Inventory.create_transfer(scope, %{
          "source_branch_id" => source.id,
          "destination_branch_id" => destination.id,
          "items" => [%{"variant_id" => variant.id, "quantity" => "40"}]
        })

      {:ok, dispatched} = Inventory.dispatch_transfer(scope, transfer)
      {:ok, _received} = Inventory.receive_transfer(scope, dispatched)

      # Moving stock between two of a business's own branches must not change
      # what the business believes its inventory is worth.
      after_transfer = Inventory.valuation(scope)

      assert Decimal.equal?(before.quantity, after_transfer.quantity)
      assert Decimal.equal?(before.value, after_transfer.value)
    end

    test "a shortfall is recorded rather than averaged away", %{
      scope: scope,
      branch: source,
      destination: destination,
      variant: variant
    } do
      {:ok, transfer} =
        Inventory.create_transfer(scope, %{
          "source_branch_id" => source.id,
          "destination_branch_id" => destination.id,
          "items" => [%{"variant_id" => variant.id, "quantity" => "20"}]
        })

      {:ok, dispatched} = Inventory.dispatch_transfer(scope, transfer)
      [line] = dispatched.items

      # Eighteen of twenty arrived.
      {:ok, received} = Inventory.receive_transfer(scope, dispatched, %{line.id => "18"})

      assert_qty(Inventory.available(scope, variant.id, destination.id), "18")
      # The two missing are the only signal a shop gets that something is going
      # astray between its own branches, so they stay visible.
      assert [short_line] = StockTransfer.discrepancies(received)
      assert_qty(Kaarobar.Inventory.StockTransferItem.shortfall(short_line), "2")
    end

    test "cannot send more than the source branch holds", %{
      scope: scope,
      branch: source,
      destination: destination,
      variant: variant
    } do
      {:ok, transfer} =
        Inventory.create_transfer(scope, %{
          "source_branch_id" => source.id,
          "destination_branch_id" => destination.id,
          "items" => [%{"variant_id" => variant.id, "quantity" => "500"}]
        })

      assert {:error, :insufficient_stock} = Inventory.dispatch_transfer(scope, transfer)
      assert_qty(Inventory.available(scope, variant.id, source.id), "100")
    end

    test "cannot transfer a branch to itself", %{scope: scope, branch: source, variant: variant} do
      assert {:error, changeset} =
               Inventory.create_transfer(scope, %{
                 "source_branch_id" => source.id,
                 "destination_branch_id" => source.id,
                 "items" => [%{"variant_id" => variant.id, "quantity" => "1"}]
               })

      assert errors_on(changeset).destination_branch_id != []
    end
  end

  # ===========================================================================
  # Gate 3 — a cycle count with variance approval
  # ===========================================================================

  describe "gate: a cycle count with variance approval" do
    setup %{scope: scope, variant: variant} do
      stock_fixture(scope, variant, "100", unit_cost: "80.00")
      %{scope: scope, variant: variant}
    end

    test "counting changes nothing until it is approved", %{
      scope: scope,
      branch: branch,
      variant: variant
    } do
      {:ok, count} = Inventory.create_count(scope, %{"branch_id" => branch.id, "kind" => "cycle"})

      assert count.status == "counting"
      assert [line] = count.items
      # What the system believed at the moment of counting.
      assert_qty(line.expected_quantity, "100")

      {:ok, _counted} = Inventory.record_count(scope, line, %{"counted_quantity" => "94"})
      {:ok, reloaded} = Inventory.fetch_count(scope, count.id)
      {:ok, submitted} = Inventory.submit_count(scope, reloaded)

      assert submitted.status == "awaiting_approval"
      assert_qty(submitted.variance_quantity, "-6")
      # Six units at eighty.
      assert Decimal.equal?(submitted.variance_value, d("-480"))

      # A stock take is exactly when a typo becomes a permanent correction, so
      # nothing has moved yet.
      assert_qty(Inventory.available(scope, variant.id, branch.id), "100")

      {:ok, approved} = Inventory.approve_count(scope, submitted)

      assert approved.status == "approved"
      assert_qty(Inventory.available(scope, variant.id, branch.id), "94")
    end

    test "approval posts one move per differing line and no more", %{
      scope: scope,
      branch: branch,
      variant: variant
    } do
      unchanged = variant_fixture(scope, %{"name" => "Unchanged", "price" => "50.00"})
      stock_fixture(scope, unchanged, "20", unit_cost: "40.00")

      {:ok, count} = Inventory.create_count(scope, %{"branch_id" => branch.id})

      Enum.each(count.items, fn item ->
        found = if item.variant_id == variant.id, do: "94", else: "20"
        {:ok, _recorded} = Inventory.record_count(scope, item, %{"counted_quantity" => found})
      end)

      {:ok, reloaded} = Inventory.fetch_count(scope, count.id)
      {:ok, submitted} = Inventory.submit_count(scope, reloaded)
      {:ok, _approved} = Inventory.approve_count(scope, submitted)

      # Writing a zero-variance move for every line of a full count would bury
      # the real corrections in noise.
      count_moves =
        scope
        |> Inventory.move_query(%{"kind" => "count"})
        |> Repo.all()

      assert length(count_moves) == 1
      assert hd(count_moves).variant_id == variant.id
    end

    test "a surplus is corrected upward too", %{scope: scope, branch: branch, variant: variant} do
      {:ok, count} = Inventory.create_count(scope, %{"branch_id" => branch.id})
      [line] = count.items

      {:ok, _recorded} = Inventory.record_count(scope, line, %{"counted_quantity" => "107"})
      {:ok, reloaded} = Inventory.fetch_count(scope, count.id)
      {:ok, submitted} = Inventory.submit_count(scope, reloaded)
      {:ok, _approved} = Inventory.approve_count(scope, submitted)

      assert_qty(Inventory.available(scope, variant.id, branch.id), "107")
    end

    test "an approved count cannot be cancelled", %{scope: scope, branch: branch} do
      {:ok, count} = Inventory.create_count(scope, %{"branch_id" => branch.id})
      [line] = count.items

      {:ok, _recorded} = Inventory.record_count(scope, line, %{"counted_quantity" => "99"})
      {:ok, reloaded} = Inventory.fetch_count(scope, count.id)
      {:ok, submitted} = Inventory.submit_count(scope, reloaded)
      {:ok, approved} = Inventory.approve_count(scope, submitted)

      assert {:error, :conflict} = Inventory.cancel_count(scope, approved)
    end

    test "the expected quantity is frozen at counting, not read at approval", %{
      scope: scope,
      branch: branch,
      variant: variant
    } do
      {:ok, count} = Inventory.create_count(scope, %{"branch_id" => branch.id})
      [line] = count.items

      {:ok, _recorded} = Inventory.record_count(scope, line, %{"counted_quantity" => "100"})

      # A sale rings up while the count is being approved.
      {:ok, _sale} =
        Kaarobar.Inventory.Ledger.post(scope, %{
          variant_id: variant.id,
          branch_id: branch.id,
          kind: "sale",
          quantity: d("5")
        })

      {:ok, reloaded} = Inventory.fetch_count(scope, count.id)
      {:ok, submitted} = Inventory.submit_count(scope, reloaded)

      # No variance: the shelf matched what the system believed when it was
      # counted. Blaming the counter for a sale made after them would be wrong.
      assert_qty(submitted.variance_quantity, "0")
      assert submitted.line_count == 0

      {:ok, _approved} = Inventory.approve_count(scope, submitted)
      assert_qty(Inventory.available(scope, variant.id, branch.id), "95")
    end

    test "a count only covers its own branch", %{scope: scope, variant: variant} do
      other_branch = branch_fixture(scope, "Elsewhere")
      stock_fixture(scope, variant, "7", branch_id: other_branch.id)

      {:ok, count} = Inventory.create_count(scope, %{"branch_id" => other_branch.id})

      assert [line] = count.items
      assert_qty(line.expected_quantity, "7")
    end
  end

  # ===========================================================================
  # Gate 4 — valuation reconciles against the ledger
  # ===========================================================================

  describe "gate: valuation reconciles against the ledger" do
    test "after a long sequence of every kind of movement", %{
      scope: scope,
      branch: branch,
      variant: variant
    } do
      second = variant_fixture(scope, %{"name" => "Second", "price" => "90.00"})
      destination = branch_fixture(scope, "Second shop")
      supplier = supplier_fixture(scope)

      stock_fixture(scope, variant, "200", unit_cost: "80.00")
      stock_fixture(scope, second, "50", unit_cost: "40.00")

      # A delivery.
      {:ok, receipt} =
        Purchasing.create_receipt(scope, %{
          "supplier_id" => supplier.id,
          "branch_id" => branch.id,
          "items" => [%{"variant_id" => variant.id, "quantity" => "60", "unit_cost" => "85.00"}]
        })

      {:ok, _posted} = Purchasing.post_receipt(scope, receipt)

      # Sales, wastage, an adjustment.
      for {kind, quantity} <- [{"sale", "30"}, {"wastage", "4"}, {"sale", "12"}] do
        {:ok, _move} =
          Kaarobar.Inventory.Ledger.post(scope, %{
            variant_id: variant.id,
            branch_id: branch.id,
            kind: kind,
            quantity: d(quantity),
            reason: "test"
          })
      end

      {:ok, _adjusted} =
        Inventory.adjust(scope, %{
          "variant_id" => second.id,
          "branch_id" => branch.id,
          "quantity" => "-5",
          "reason" => "Damaged in the stockroom"
        })

      # A transfer.
      {:ok, transfer} =
        Inventory.create_transfer(scope, %{
          "source_branch_id" => branch.id,
          "destination_branch_id" => destination.id,
          "items" => [%{"variant_id" => variant.id, "quantity" => "25"}]
        })

      {:ok, dispatched} = Inventory.dispatch_transfer(scope, transfer)
      {:ok, _received} = Inventory.receive_transfer(scope, dispatched)

      # A count.
      {:ok, count} = Inventory.create_count(scope, %{"branch_id" => branch.id})
      [line | _rest] = count.items
      {:ok, _recorded} = Inventory.record_count(scope, line, %{"counted_quantity" => "1"})
      {:ok, reloaded} = Inventory.fetch_count(scope, count.id)
      {:ok, submitted} = Inventory.submit_count(scope, reloaded)
      {:ok, _approved} = Inventory.approve_count(scope, submitted)

      # After all of that, the projection is still exactly the sum of the moves.
      reconciliation = Inventory.reconcile(scope)

      assert reconciliation.balanced,
             "quantities diverged by #{Decimal.to_string(reconciliation.quantity_difference, :normal)}"

      assert Decimal.equal?(reconciliation.quantity_difference, d("0"))
    end

    test "an empty business reconciles at zero", %{scope: scope} do
      reconciliation = Inventory.reconcile(scope)

      assert reconciliation.balanced
      assert Decimal.equal?(reconciliation.projected.value, d("0"))
    end

    test "the FIFO layers agree with the stock levels" do
      %{scope: fifo_scope, branch: branch} = fifo_business()
      variant = variant_fixture(fifo_scope, %{"price" => "100.00"})

      stock_fixture(fifo_scope, variant, "30", unit_cost: "50.00", branch_id: branch.id)
      stock_fixture(fifo_scope, variant, "20", unit_cost: "70.00", branch_id: branch.id)

      {:ok, _sale} =
        Kaarobar.Inventory.Ledger.post(fifo_scope, %{
          variant_id: variant.id,
          branch_id: branch.id,
          kind: "sale",
          quantity: d("35")
        })

      layers = Inventory.layer_valuation(fifo_scope)
      projected = Inventory.valuation(fifo_scope)

      assert Decimal.equal?(layers.quantity, projected.quantity)
      # Fifteen left, all from the 70 layer.
      assert Decimal.equal?(layers.value, d("1050"))
    end
  end

  # ===========================================================================
  # Reorder suggestions
  # ===========================================================================

  describe "reorder suggestions" do
    test "name what has fallen below its point", %{scope: scope, branch: branch, variant: variant} do
      stock_fixture(scope, variant, "5", unit_cost: "80.00")
      {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)

      {:ok, _settings} =
        Inventory.update_stock_settings(scope, item, %{
          "reorder_point" => "10",
          "max_stock" => "50"
        })

      assert [suggestion] = Inventory.reorder_suggestions(scope)
      assert suggestion.variant.id == variant.id
      assert_qty(suggestion.suggested_quantity, "45")
    end

    test "count what is already on its way", %{
      scope: scope,
      branch: branch,
      variant: variant
    } do
      supplier = supplier_fixture(scope)
      stock_fixture(scope, variant, "5", unit_cost: "80.00")
      {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)

      {:ok, _settings} =
        Inventory.update_stock_settings(scope, item, %{
          "reorder_point" => "10",
          "max_stock" => "50"
        })

      {:ok, order} =
        Purchasing.create_order(scope, %{
          "supplier_id" => supplier.id,
          "branch_id" => branch.id,
          "items" => [
            %{"variant_id" => variant.id, "ordered_quantity" => "30", "unit_cost" => "80.00"}
          ]
        })

      {:ok, _approved} = Purchasing.approve_order(scope, order)

      # Otherwise a shop orders the same thing three times while a delivery is
      # in transit.
      assert [suggestion] = Inventory.reorder_suggestions(scope)
      assert_qty(suggestion.suggested_quantity, "15")
    end

    test "stay quiet when stock is healthy", %{scope: scope, branch: branch, variant: variant} do
      stock_fixture(scope, variant, "100", unit_cost: "80.00")
      {:ok, item} = Inventory.fetch_stock_item(scope, variant.id, branch.id)

      {:ok, _settings} =
        Inventory.update_stock_settings(scope, item, %{"reorder_point" => "10"})

      assert Inventory.reorder_suggestions(scope) == []
    end
  end

  # ===========================================================================
  # Expiry
  # ===========================================================================

  describe "expiring stock" do
    test "surfaces lots inside the window, soonest first", %{scope: scope, variant: variant} do
      soon = batch_fixture(scope, variant, %{
        "batch_number" => "SOON",
        "expires_on" => Date.add(Date.utc_today(), 5)
      })

      later = batch_fixture(scope, variant, %{
        "batch_number" => "LATER",
        "expires_on" => Date.add(Date.utc_today(), 20)
      })

      _far = batch_fixture(scope, variant, %{
        "batch_number" => "FAR",
        "expires_on" => Date.add(Date.utc_today(), 200)
      })

      stock_fixture(scope, variant, "10", batch_id: soon.id)
      stock_fixture(scope, variant, "10", batch_id: later.id)

      numbers = scope |> Inventory.expiring_batches(30) |> Enum.map(& &1.batch_number)

      assert numbers == ["SOON", "LATER"]
    end

    test "picks the soonest-expiring lot to sell from next", %{scope: scope, variant: variant} do
      later = batch_fixture(scope, variant, %{
        "batch_number" => "LATER",
        "expires_on" => Date.add(Date.utc_today(), 90)
      })

      soon = batch_fixture(scope, variant, %{
        "batch_number" => "SOON",
        "expires_on" => Date.add(Date.utc_today(), 10)
      })

      stock_fixture(scope, variant, "10", batch_id: later.id)
      stock_fixture(scope, variant, "10", batch_id: soon.id)

      # First-expiry-first-out. Selling the fresher lot first guarantees the
      # older one gets written off.
      assert %{batch_number: "SOON"} = Inventory.next_batch(scope, variant.id)
    end

    test "skips lots already past their date", %{scope: scope, variant: variant} do
      expired = batch_fixture(scope, variant, %{"batch_number" => "EXPIRED"})
      stock_fixture(scope, variant, "10", batch_id: expired.id)

      Repo.get!(Kaarobar.Inventory.Batch, expired.id)
      |> Ecto.Changeset.change(expires_on: Date.add(Date.utc_today(), -1))
      |> Repo.update!()

      assert is_nil(Inventory.next_batch(scope, variant.id))
    end
  end

  # ===========================================================================
  # Adjustments
  # ===========================================================================

  describe "adjustments" do
    test "require a reason", %{scope: scope, branch: branch, variant: variant} do
      stock_fixture(scope, variant, "10")

      # An adjustment is the only way a number changes without a document
      # behind it, so it is also the first thing anyone looks at.
      assert {:error, :reason_required} =
               Inventory.adjust(scope, %{
                 "variant_id" => variant.id,
                 "branch_id" => branch.id,
                 "quantity" => "-2"
               })
    end

    test "record the reason on the move", %{scope: scope, branch: branch, variant: variant} do
      stock_fixture(scope, variant, "10")

      {:ok, move} =
        Inventory.adjust(scope, %{
          "variant_id" => variant.id,
          "branch_id" => branch.id,
          "quantity" => "-2",
          "reason" => "Found damaged in the back"
        })

      assert move.reason == "Found damaged in the back"
      assert move.kind == "adjustment"
      assert_qty(Inventory.available(scope, variant.id, branch.id), "8")
    end

    test "a write-off reduces stock and records why", %{
      scope: scope,
      branch: branch,
      variant: variant
    } do
      stock_fixture(scope, variant, "10", unit_cost: "80.00")

      {:ok, move} =
        Inventory.write_off(scope, %{
          "variant_id" => variant.id,
          "branch_id" => branch.id,
          "quantity" => "3",
          "reason" => "Spoiled"
        })

      assert move.kind == "wastage"
      assert_qty(move.quantity, "-3")
      assert_qty(Inventory.available(scope, variant.id, branch.id), "7")
    end
  end

  # ===========================================================================
  # Isolation
  # ===========================================================================

  describe "tenant isolation" do
    test "another shop's transfers and counts are invisible", %{scope: scope} do
      %{scope: other} = owner_scope()
      other_variant = variant_fixture(other, %{"price" => "10.00"})
      other_destination = branch_fixture(other, "Theirs")
      stock_fixture(other, other_variant, "10")

      {:ok, _transfer} =
        Inventory.create_transfer(other, %{
          "source_branch_id" => other.branch.id,
          "destination_branch_id" => other_destination.id,
          "items" => [%{"variant_id" => other_variant.id, "quantity" => "1"}]
        })

      {:ok, _count} = Inventory.create_count(other, %{"branch_id" => other.branch.id})

      assert Inventory.list_transfers(scope) == []
      assert Inventory.list_counts(scope) == []
    end

    test "another shop's stock does not appear in a valuation", %{scope: scope, variant: variant} do
      %{scope: other} = owner_scope()
      theirs = variant_fixture(other, %{"price" => "10.00"})

      stock_fixture(scope, variant, "10", unit_cost: "100.00")
      stock_fixture(other, theirs, "1000", unit_cost: "999.00")

      assert Decimal.equal?(Inventory.valuation(scope).value, d("1000"))
    end
  end

  describe "StockCount helpers" do
    test "report their state", %{scope: scope, branch: branch, variant: variant} do
      stock_fixture(scope, variant, "1")
      {:ok, count} = Inventory.create_count(scope, %{"branch_id" => branch.id})

      assert StockCount.open?(count)
      refute StockCount.awaiting_approval?(count)
    end
  end
end
