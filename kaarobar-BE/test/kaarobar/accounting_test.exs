defmodule Kaarobar.AccountingTest do
  use Kaarobar.DataCase

  alias Kaarobar.{Accounts, Accounting, Tenancy}
  alias Kaarobar.Schemas.{Customer, JournalEntry, Supplier}
  alias Kaarobar.Repo

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "owner-p4-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner"
      })

    {:ok, business} = Tenancy.create_business(owner.id, %{name: "Books Co"})
    {:ok, branch} = Tenancy.create_branch(business.id, owner, %{name: "HQ"})

    cash = Accounting.get_account_by_code(business.id, "1000")
    capital = Accounting.get_account_by_code(business.id, "3000")
    revenue = Accounting.get_account_by_code(business.id, "4000")
    ar = Accounting.get_account_by_code(business.id, "1100")
    ap = Accounting.get_account_by_code(business.id, "2000")
    inventory = Accounting.get_account_by_code(business.id, "1200")

    %{
      owner: owner,
      business: business,
      branch: branch,
      cash: cash,
      capital: capital,
      revenue: revenue,
      ar: ar,
      ap: ap,
      inventory: inventory
    }
  end

  test "ACC-FR-001 COA seeded on business create", %{cash: cash, capital: capital} do
    assert cash
    assert capital
    assert cash.type == "Asset"
  end

  test "ACC-FR-003 rejects unbalanced journals", %{
    owner: owner,
    business: business,
    cash: cash,
    capital: capital
  } do
    assert {:error, :unbalanced_entry} =
             Accounting.create_manual_journal(business.id, owner.id, owner.id, %{
               description: "Bad",
               lines: [
                 %{account_id: cash.id, debit: "100", credit: "0"},
                 %{account_id: capital.id, debit: "0", credit: "50"}
               ]
             })
  end

  test "ACC-FR-005/010 posts locked journal and forbids mutation", %{
    owner: owner,
    business: business,
    cash: cash,
    capital: capital
  } do
    assert {:ok, entry} =
             Accounting.create_manual_journal(business.id, owner.id, owner.id, %{
               description: "Opening",
               lines: [
                 %{account_id: cash.id, debit: "1000", credit: "0"},
                 %{account_id: capital.id, debit: "0", credit: "1000"}
               ]
             })

    assert entry.is_locked
    assert length(entry.lines) == 2

    assert_raise Postgrex.Error, fn ->
      Repo.delete!(entry)
    end
  end

  test "ACC-FR-010 reverse creates linked reversing entry", %{
    owner: owner,
    business: business,
    cash: cash,
    capital: capital
  } do
    {:ok, entry} =
      Accounting.create_manual_journal(business.id, owner.id, owner.id, %{
        description: "To reverse",
        lines: [
          %{account_id: cash.id, debit: "200", credit: "0"},
          %{account_id: capital.id, debit: "0", credit: "200"}
        ]
      })

    assert {:ok, rev} = Accounting.reverse_journal(entry.id, owner.id, owner.id)
    assert rev.reversed_entry_id == entry.id
    assert rev.is_locked
    assert {:error, :already_reversed} = Accounting.reverse_journal(entry.id, owner.id, owner.id)
  end

  test "ACC-FR-006/007 GL and period trial balance", %{
    owner: owner,
    business: business,
    cash: cash,
    capital: capital
  } do
    {:ok, _} =
      Accounting.create_manual_journal(business.id, owner.id, owner.id, %{
        description: "Float",
        date: ~D[2026-01-15],
        lines: [
          %{account_id: cash.id, debit: "500", credit: "0"},
          %{account_id: capital.id, debit: "0", credit: "500"}
        ]
      })

    tb = Accounting.trial_balance(business.id, owner.id, ~D[2026-01-01], ~D[2026-01-31])
    cash_row = Enum.find(tb, &(&1.code == "1000"))
    assert cash_row
    assert Decimal.eq?(Decimal.new(cash_row.debit), Decimal.new("500"))

    gl =
      Accounting.general_ledger(
        business.id,
        owner.id,
        cash.id,
        ~D[2026-01-01],
        ~D[2026-12-31]
      )

    assert length(gl) >= 1
    assert Decimal.eq?(Decimal.new(List.last(gl).balance), Decimal.new("500"))
  end

  test "ACC-FR-008 P&L and balance sheet shapes", %{
    owner: owner,
    business: business,
    cash: cash,
    revenue: revenue
  } do
    {:ok, _} =
      Accounting.create_manual_journal(business.id, owner.id, owner.id, %{
        description: "Sale cash",
        date: ~D[2026-03-01],
        lines: [
          %{account_id: cash.id, debit: "118", credit: "0"},
          %{account_id: revenue.id, debit: "0", credit: "118"}
        ]
      })

    pl = Accounting.profit_and_loss(business.id, owner.id, ~D[2026-01-01], ~D[2026-12-31])
    assert Decimal.eq?(Decimal.new(pl.total_revenue), Decimal.new("118"))
    assert Decimal.eq?(Decimal.new(pl.net_income), Decimal.new("118"))

    bs = Accounting.balance_sheet(business.id, owner.id, ~D[2026-12-31])
    assert is_binary(bs.total_assets)
    assert length(bs.lines) >= 1
  end

  test "ACC-FR-012 AR invoice, payment, aging", %{
    owner: owner,
    business: business,
    branch: branch
  } do
    {:ok, customer} =
      %Customer{}
      |> Customer.changeset(%{
        name: "Walk-in Corp",
        business_id: business.id,
        owner_id: owner.id
      })
      |> Repo.insert()

    assert {:ok, inv} =
             Accounting.create_ar_invoice(business.id, owner.id, owner.id, %{
               customer_id: customer.id,
               branch_id: branch.id,
               invoice_number: "AR-100",
               subtotal: "1000",
               tax_amount: "180",
               invoice_date: Date.utc_today() |> Date.add(-45),
               due_date: Date.utc_today() |> Date.add(-15)
             })

    assert inv.status == "open"
    assert Decimal.eq?(inv.balance_due, Decimal.new("1180"))

    assert {:ok, _} =
             Accounting.record_ar_payment(inv.id, owner.id, owner.id, %{
               amount: "180",
               method: "cash"
             })

    inv = Repo.get!(Kaarobar.Schemas.ArInvoice, inv.id)
    assert inv.status == "partial"

    aging = Accounting.ar_aging(business.id, owner.id)
    assert Enum.any?(aging, &(&1.id == inv.id and &1.bucket in ["1_30", "31_60"]))
  end

  test "ACC-FR-013 AP bill, payment, aging", %{
    owner: owner,
    business: business,
    inventory: inventory
  } do
    {:ok, supplier} =
      %Supplier{}
      |> Supplier.changeset(%{
        name: "Vendor Ltd",
        business_id: business.id,
        owner_id: owner.id
      })
      |> Repo.insert()

    assert {:ok, bill} =
             Accounting.create_ap_bill(business.id, owner.id, owner.id, %{
               supplier_id: supplier.id,
               bill_number: "AP-55",
               total_amount: "400",
               account_code: "1200",
               bill_date: Date.utc_today(),
               due_date: Date.utc_today() |> Date.add(-5)
             })

    assert Decimal.eq?(bill.balance_due, Decimal.new("400"))

    assert {:ok, _} =
             Accounting.record_ap_payment(bill.id, owner.id, owner.id, %{
               amount: "400",
               method: "bank"
             })

    bill = Repo.get!(Kaarobar.Schemas.ApBill, bill.id)
    assert bill.status == "paid"

    # inventory account exists for debit side of bill
    assert inventory
  end

  test "locked journal cannot be updated", %{
    owner: owner,
    business: business,
    cash: cash,
    capital: capital
  } do
    {:ok, entry} =
      Accounting.create_manual_journal(business.id, owner.id, owner.id, %{
        description: "Lock me",
        lines: [
          %{account_id: cash.id, debit: "10", credit: "0"},
          %{account_id: capital.id, debit: "0", credit: "10"}
        ]
      })

    assert_raise Postgrex.Error, fn ->
      entry
      |> JournalEntry.changeset(%{description: "hacked"})
      |> Repo.update!()
    end
  end
end
