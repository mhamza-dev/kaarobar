defmodule Kaarobar.PurchasingTest do
  @moduledoc """
  Bills, payments and the supplier ledger — the money half of purchasing.

  The stock half is covered by the phase gate in `Kaarobar.InventoryTest`.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Purchasing
  alias Kaarobar.Purchasing.SupplierBill
  alias Kaarobar.Purchasing.SupplierProduct

  defp d(value), do: Decimal.new(value)

  defp assert_money(actual, expected) do
    assert Decimal.equal?(actual, Decimal.new(expected)),
           "expected #{expected}, got #{Decimal.to_string(actual, :normal)}"
  end

  setup do
    %{scope: scope, branch: branch} = owner_scope()
    supplier = supplier_fixture(scope, %{"name" => "AgriCo", "payment_terms_days" => 30})
    variant = variant_fixture(scope, %{"price" => "150.00"})

    %{scope: scope, branch: branch, supplier: supplier, variant: variant}
  end

  describe "suppliers" do
    test "start with a zero balance", %{supplier: supplier} do
      assert_money(supplier.balance, "0")
    end

    test "compute a due date from their own agreed terms", %{supplier: supplier} do
      # A bill is not overdue because it is old, but because it is older than
      # what was agreed with that particular supplier.
      due = Kaarobar.Purchasing.Supplier.due_date(supplier, ~D[2026-03-01])

      assert due == ~D[2026-03-31]
    end

    test "cannot be archived while money is owed", %{scope: scope, supplier: supplier} do
      {:ok, _entry} =
        Purchasing.record_ledger_entry(scope, supplier.id, %{
          kind: "adjustment",
          amount: d("500")
        })

      {:ok, reloaded} = Purchasing.fetch_supplier(scope, supplier.id)

      # A supplier with an outstanding balance that vanishes from the list is a
      # debt nobody is tracking.
      assert {:error, :conflict} = Purchasing.archive_supplier(scope, reloaded)
    end

    test "another shop's suppliers are invisible", %{scope: scope} do
      %{scope: other} = owner_scope()
      theirs = supplier_fixture(other, %{"name" => "Not yours"})

      assert {:error, :not_found} = Purchasing.fetch_supplier(scope, theirs.id)
      refute Enum.any?(Purchasing.list_suppliers(scope), &(&1.id == theirs.id))
    end
  end

  describe "supplier prices" do
    test "record the supplier's own code and cost", %{
      scope: scope,
      supplier: supplier,
      variant: variant
    } do
      {:ok, record} =
        Purchasing.put_supplier_product(scope, supplier, %{
          "variant_id" => variant.id,
          "supplier_sku" => "AGR-9981",
          "unit_cost" => "82.50",
          "minimum_order_quantity" => "24",
          "pack_size" => "12",
          "lead_time_days" => 7
        })

      assert record.supplier_sku == "AGR-9981"
      assert_money(record.unit_cost, "82.50")
    end

    test "round an order up to something the supplier will ship", %{
      scope: scope,
      supplier: supplier,
      variant: variant
    } do
      {:ok, record} =
        Purchasing.put_supplier_product(scope, supplier, %{
          "variant_id" => variant.id,
          "unit_cost" => "80.00",
          "minimum_order_quantity" => "24",
          "pack_size" => "12"
        })

      # Wanting seven of something sold in dozens with a two-dozen minimum
      # means ordering twenty-four, not seven.
      assert Decimal.equal?(SupplierProduct.orderable_quantity(record, d("7")), d("24"))
      # Wanting thirty means three cases, not two and a half.
      assert Decimal.equal?(SupplierProduct.orderable_quantity(record, d("30")), d("36"))
    end

    test "list cheapest first, preferred at the top", %{scope: scope, variant: variant} do
      cheap = supplier_fixture(scope, %{"name" => "Cheap"})
      dear = supplier_fixture(scope, %{"name" => "Dear"})

      {:ok, _cheap} =
        Purchasing.put_supplier_product(scope, cheap, %{
          "variant_id" => variant.id,
          "unit_cost" => "70.00"
        })

      {:ok, _dear} =
        Purchasing.put_supplier_product(scope, dear, %{
          "variant_id" => variant.id,
          "unit_cost" => "95.00",
          "is_preferred" => true
        })

      names =
        scope
        |> Purchasing.suppliers_for_variant(variant.id)
        |> Enum.map(& &1.supplier.name)

      # Preferred wins over cheapest: a shop that named a preferred supplier
      # meant it.
      assert names == ["Dear", "Cheap"]
    end
  end

  describe "bills" do
    test "post to the supplier ledger and move the balance", %{
      scope: scope,
      supplier: supplier,
      variant: variant
    } do
      {:ok, bill} =
        Purchasing.create_bill(scope, %{
          "supplier_id" => supplier.id,
          "supplier_invoice_number" => "INV-5512",
          "items" => [
            %{
              "description" => "Widgets",
              "variant_id" => variant.id,
              "quantity" => "10",
              "unit_cost" => "80.00"
            }
          ]
        })

      assert bill.status == "draft"
      assert_money(bill.total, "800.00")
      # A draft owes nothing yet.
      {:ok, before} = Purchasing.fetch_supplier(scope, supplier.id)
      assert_money(before.balance, "0")

      {:ok, posted} = Purchasing.post_bill(scope, bill)

      assert posted.status == "posted"

      {:ok, after_post} = Purchasing.fetch_supplier(scope, supplier.id)
      assert_money(after_post.balance, "800.00")

      assert [entry] = Purchasing.supplier_ledger(scope, supplier)
      assert entry.kind == "bill"
      assert_money(entry.amount, "800.00")
      assert_money(entry.balance_after, "800.00")
    end

    test "default their due date from the supplier's terms", %{
      scope: scope,
      supplier: supplier
    } do
      {:ok, bill} =
        Purchasing.create_bill(scope, %{
          "supplier_id" => supplier.id,
          "issued_on" => "2026-03-01",
          "items" => [%{"description" => "Freight", "quantity" => "1", "unit_cost" => "500.00"}]
        })

      assert bill.due_on == ~D[2026-03-31]
    end

    test "refuse the same supplier invoice number twice", %{
      scope: scope,
      supplier: supplier
    } do
      attrs = %{
        "supplier_id" => supplier.id,
        "supplier_invoice_number" => "INV-DUPLICATE",
        "items" => [%{"description" => "Goods", "quantity" => "1", "unit_cost" => "100.00"}]
      }

      {:ok, _first} = Purchasing.create_bill(scope, attrs)

      # The single most common way a small business pays an invoice it has
      # already paid.
      assert {:error, changeset} = Purchasing.create_bill(scope, attrs)
      assert errors_on(changeset).supplier_invoice_number != []
    end

    test "report what is outstanding and whether it is overdue", %{
      scope: scope,
      supplier: supplier
    } do
      {:ok, bill} =
        Purchasing.create_bill(scope, %{
          "supplier_id" => supplier.id,
          "issued_on" => Date.add(Date.utc_today(), -60),
          "due_on" => Date.add(Date.utc_today(), -30),
          "items" => [%{"description" => "Goods", "quantity" => "1", "unit_cost" => "1000.00"}]
        })

      {:ok, posted} = Purchasing.post_bill(scope, bill)

      assert_money(SupplierBill.outstanding(posted), "1000.00")
      assert SupplierBill.overdue?(posted, Date.utc_today())
      refute SupplierBill.settled?(posted)
    end
  end

  describe "payments" do
    setup %{scope: scope, supplier: supplier} do
      {:ok, bill} =
        Purchasing.create_bill(scope, %{
          "supplier_id" => supplier.id,
          "items" => [%{"description" => "Goods", "quantity" => "1", "unit_cost" => "1000.00"}]
        })

      {:ok, posted} = Purchasing.post_bill(scope, bill)

      %{bill: posted}
    end

    test "reduce the supplier balance", %{scope: scope, supplier: supplier} do
      {:ok, payment} =
        Purchasing.record_payment(scope, %{
          "supplier_id" => supplier.id,
          "amount" => "400.00",
          "method" => "bank_transfer"
        })

      assert_money(payment.amount, "400.00")

      {:ok, reloaded} = Purchasing.fetch_supplier(scope, supplier.id)
      assert_money(reloaded.balance, "600.00")
    end

    test "sit on account when unallocated", %{scope: scope, supplier: supplier} do
      {:ok, payment} =
        Purchasing.record_payment(scope, %{"supplier_id" => supplier.id, "amount" => "400.00"})

      # A real and common state: the shop paid a round figure and the
      # bookkeeper decides later which invoices it clears.
      assert_money(payment.unallocated_amount, "400.00")
    end

    test "settle a bill when allocated to it", %{scope: scope, supplier: supplier, bill: bill} do
      {:ok, payment} =
        Purchasing.record_payment(scope, %{
          "supplier_id" => supplier.id,
          "amount" => "1000.00",
          "allocations" => %{bill.id => "1000.00"}
        })

      assert_money(payment.unallocated_amount, "0")

      {:ok, settled} = Purchasing.fetch_bill(scope, bill.id)
      assert settled.status == "paid"
      assert SupplierBill.settled?(settled)
    end

    test "partially pay a bill", %{scope: scope, supplier: supplier, bill: bill} do
      {:ok, _payment} =
        Purchasing.record_payment(scope, %{
          "supplier_id" => supplier.id,
          "amount" => "300.00",
          "allocations" => %{bill.id => "300.00"}
        })

      {:ok, partial} = Purchasing.fetch_bill(scope, bill.id)

      assert partial.status == "partially_paid"
      assert_money(SupplierBill.outstanding(partial), "700.00")
    end

    test "refuse to allocate more than a bill is for", %{
      scope: scope,
      supplier: supplier,
      bill: bill
    } do
      # A credit hiding inside a paid invoice is somewhere nobody would look
      # for it.
      assert {:error, :allocation_exceeds_bill} =
               Purchasing.record_payment(scope, %{
                 "supplier_id" => supplier.id,
                 "amount" => "2000.00",
                 "allocations" => %{bill.id => "2000.00"}
               })

      # And nothing was recorded.
      {:ok, untouched} = Purchasing.fetch_supplier(scope, supplier.id)
      assert_money(untouched.balance, "1000.00")
    end

    test "the ledger reads as a running account", %{scope: scope, supplier: supplier, bill: bill} do
      {:ok, _payment} =
        Purchasing.record_payment(scope, %{
          "supplier_id" => supplier.id,
          "amount" => "400.00",
          "allocations" => %{bill.id => "400.00"}
        })

      entries = Purchasing.supplier_ledger(scope, supplier)

      assert [%{kind: "bill", balance_after: first}, %{kind: "payment", balance_after: second}] =
               entries

      assert_money(first, "1000.00")
      assert_money(second, "600.00")
    end
  end

  describe "payables ageing" do
    test "buckets what is owed against each supplier's terms", %{
      scope: scope,
      supplier: supplier
    } do
      for {days_overdue, amount} <- [{-5, "100.00"}, {10, "200.00"}, {45, "300.00"}, {120, "400.00"}] do
        {:ok, bill} =
          Purchasing.create_bill(scope, %{
            "supplier_id" => supplier.id,
            "issued_on" => Date.add(Date.utc_today(), -(days_overdue + 30)),
            "due_on" => Date.add(Date.utc_today(), -days_overdue),
            "items" => [%{"description" => "Goods", "quantity" => "1", "unit_cost" => amount}]
          })

        {:ok, _posted} = Purchasing.post_bill(scope, bill)
      end

      ageing = Purchasing.payables_ageing(scope)

      assert_money(ageing.current, "100.00")
      assert_money(ageing.overdue_1_30, "200.00")
      assert_money(ageing.overdue_31_60, "300.00")
      assert_money(ageing.overdue_90_plus, "400.00")
      assert_money(ageing.total, "1000.00")
    end
  end

  describe "returns" do
    test "remove stock and credit the supplier together", %{
      scope: scope,
      branch: branch,
      supplier: supplier,
      variant: variant
    } do
      stock_fixture(scope, variant, "50", unit_cost: "80.00")

      {:ok, record} =
        Purchasing.create_return(scope, %{
          "supplier_id" => supplier.id,
          "branch_id" => branch.id,
          "reason" => "Recalled lot",
          "items" => [
            %{"variant_id" => variant.id, "quantity" => "10", "unit_cost" => "80.00"}
          ]
        })

      assert record.status == "draft"

      {:ok, posted} = Purchasing.post_return(scope, record)

      assert posted.status == "posted"
      # Stock left and the supplier owes us — both, or the books show either a
      # phantom loss or a phantom windfall.
      assert Decimal.equal?(Kaarobar.Inventory.available(scope, variant.id, branch.id), d("40"))

      {:ok, reloaded} = Purchasing.fetch_supplier(scope, supplier.id)
      assert_money(reloaded.balance, "-800.00")
    end
  end

  describe "document numbering" do
    test "is sequential and prefixed per document type", %{
      scope: scope,
      branch: branch,
      supplier: supplier,
      variant: variant
    } do
      numbers =
        for _n <- 1..3 do
          {:ok, order} =
            Purchasing.create_order(scope, %{
              "supplier_id" => supplier.id,
              "branch_id" => branch.id,
              "items" => [
                %{"variant_id" => variant.id, "ordered_quantity" => "1", "unit_cost" => "10.00"}
              ]
            })

          order.number
        end

      assert length(Enum.uniq(numbers)) == 3
      assert Enum.all?(numbers, &(&1 =~ ~r/^PO-\d{4}-\d{4}$/))

      # Gapless: a series with holes is the first thing an auditor asks about.
      suffixes = Enum.map(numbers, &(&1 |> String.split("-") |> List.last() |> String.to_integer()))
      assert suffixes == Enum.sort(suffixes)
      assert List.last(suffixes) - List.first(suffixes) == 2
    end

    test "numbers each document type in its own series", %{
      scope: scope,
      branch: branch,
      supplier: supplier
    } do
      {:ok, receipt} =
        Purchasing.create_receipt(scope, %{
          "supplier_id" => supplier.id,
          "branch_id" => branch.id,
          "items" => []
        })

      {:ok, bill} =
        Purchasing.create_bill(scope, %{
          "supplier_id" => supplier.id,
          "items" => [%{"description" => "Goods", "quantity" => "1", "unit_cost" => "1.00"}]
        })

      assert receipt.number =~ ~r/^GRN-/
      assert bill.number =~ ~r/^BILL-/
    end
  end
end
