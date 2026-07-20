defmodule Kaarobar.Accounting do
  import Ecto.Query
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{ChartOfAccount, JournalEntry, JournalLine}
  alias Ecto.Multi

  def seed_pakistan_coa(business_id, owner_id) do
    accounts = [
      %{code: "1000", name: "Cash in Hand", type: "Asset"},
      %{code: "1010", name: "Cash at Bank", type: "Asset"},
      %{code: "1100", name: "Accounts Receivable", type: "Asset"},
      %{code: "1200", name: "Inventory", type: "Asset"},
      %{code: "1300", name: "Prepaid Expenses", type: "Asset"},
      %{code: "1500", name: "Furniture & Fixtures", type: "Asset"},
      %{code: "1510", name: "Equipment", type: "Asset"},
      %{code: "2000", name: "Accounts Payable", type: "Liability"},
      %{code: "2100", name: "Sales Tax Payable", type: "Liability"},
      %{code: "2200", name: "Salaries Payable", type: "Liability"},
      %{code: "2210", name: "EOBI Payable", type: "Liability"},
      %{code: "2300", name: "Loans Payable", type: "Liability"},
      %{code: "3000", name: "Owner Capital", type: "Equity"},
      %{code: "3100", name: "Retained Earnings", type: "Equity"},
      %{code: "3200", name: "Owner Drawings", type: "Equity"},
      %{code: "4000", name: "Sales Revenue", type: "Revenue"},
      %{code: "4100", name: "Sales Returns", type: "Revenue"},
      %{code: "4900", name: "Other Income", type: "Revenue"},
      %{code: "5000", name: "Cost of Goods Sold", type: "Expense"},
      %{code: "5100", name: "Salaries Expense", type: "Expense"},
      %{code: "5200", name: "Rent Expense", type: "Expense"},
      %{code: "5300", name: "Utilities Expense", type: "Expense"},
      %{code: "5400", name: "Marketing Expense", type: "Expense"},
      %{code: "5500", name: "Depreciation Expense", type: "Expense"},
      %{code: "5900", name: "Miscellaneous Expense", type: "Expense"}
    ]

    Enum.each(accounts, fn account_attrs ->
      %ChartOfAccount{}
      |> ChartOfAccount.changeset(Map.merge(account_attrs, %{business_id: business_id, owner_id: owner_id}))
      |> Repo.insert()
    end)

    {:ok, :seeded}
  end

  def get_account_by_code(business_id, code) do
    ChartOfAccount
    |> where([a], a.business_id == ^business_id and a.code == ^code)
    |> Repo.one()
  end

  def create_manual_journal(business_id, owner_id, posted_by_id, attrs) do
    lines = attrs[:lines] || []

    total_debit = Enum.reduce(lines, Decimal.new(0), fn line, acc ->
      Decimal.add(acc, line[:debit] || 0)
    end)

    total_credit = Enum.reduce(lines, Decimal.new(0), fn line, acc ->
      Decimal.add(acc, line[:credit] || 0)
    end)

    if Decimal.compare(total_debit, total_credit) != :eq do
      {:error, :unbalanced_entry}
    else
      Multi.new()
      |> Multi.insert(:journal_entry, fn _ ->
        %JournalEntry{}
        |> JournalEntry.changeset(%{
          business_id: business_id,
          owner_id: owner_id,
          posted_by_id: posted_by_id,
          date: attrs[:date] || Date.utc_today(),
          description: attrs[:description],
          source_type: attrs[:source_type] || "manual"
        })
      end)
      |> Multi.run(:journal_lines, fn _repo, %{journal_entry: entry} ->
        lines_result = Enum.map(lines, fn line_attrs ->
          %JournalLine{}
          |> JournalLine.changeset(Map.merge(line_attrs, %{journal_entry_id: entry.id}))
          |> Repo.insert()
        end)

        if Enum.all?(lines_result, fn {status, _} -> status == :ok end) do
          {:ok, Enum.map(lines_result, fn {:ok, line} -> line end)}
        else
          {:error, :line_insert_failed}
        end
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{journal_entry: entry}} -> {:ok, entry}
        {:error, _op, reason, _changes} -> {:error, reason}
      end
    end
  end

  def reverse_journal(journal_entry_id, owner_id, posted_by_id) do
    entry = Repo.get(JournalEntry, journal_entry_id) |> Repo.preload(:lines)

    if entry && entry.owner_id == owner_id && !entry.is_locked do
      reversed_lines = Enum.map(entry.lines, fn line ->
        %{
          account_id: line.account_id,
          debit: line.credit,
          credit: line.debit,
          memo: "Reversal: #{line.memo}"
        }
      end)

      create_manual_journal(entry.business_id, owner_id, posted_by_id, %{
        date: Date.utc_today(),
        description: "Reversal of: #{entry.description}",
        source_type: "reversal",
        lines: reversed_lines
      })
    else
      {:error, :cannot_reverse}
    end
  end

  def trial_balance(business_id, owner_id) do
    query = from jl in JournalLine,
      join: je in JournalEntry, on: jl.journal_entry_id == je.id,
      join: acc in ChartOfAccount, on: jl.account_id == acc.id,
      where: je.business_id == ^business_id and je.owner_id == ^owner_id,
      group_by: [acc.id, acc.code, acc.name, acc.type],
      select: %{
        account_id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        total_debit: sum(jl.debit),
        total_credit: sum(jl.credit)
      }

    Repo.all(query)
    |> Enum.map(fn row ->
      debit = row.total_debit || Decimal.new(0)
      credit = row.total_credit || Decimal.new(0)

      %{
        code: row.code,
        name: row.name,
        type: row.type,
        debit: to_string(debit),
        credit: to_string(credit)
      }
    end)
  end

  def profit_and_loss(business_id, owner_id, from_date, to_date) do
    query = from jl in JournalLine,
      join: je in JournalEntry, on: jl.journal_entry_id == je.id,
      join: acc in ChartOfAccount, on: jl.account_id == acc.id,
      where: je.business_id == ^business_id and je.owner_id == ^owner_id and
             je.date >= ^from_date and je.date <= ^to_date and
             acc.type in ["Revenue", "Expense"],
      group_by: [acc.id, acc.code, acc.name, acc.type],
      select: %{
        account_id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        total_debit: sum(jl.debit),
        total_credit: sum(jl.credit)
      }

    Repo.all(query)
  end

  def balance_sheet(business_id, owner_id, as_of_date) do
    query = from jl in JournalLine,
      join: je in JournalEntry, on: jl.journal_entry_id == je.id,
      join: acc in ChartOfAccount, on: jl.account_id == acc.id,
      where: je.business_id == ^business_id and je.owner_id == ^owner_id and
             je.date <= ^as_of_date and
             acc.type in ["Asset", "Liability", "Equity"],
      group_by: [acc.id, acc.code, acc.name, acc.type],
      select: %{
        account_id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        total_debit: sum(jl.debit),
        total_credit: sum(jl.credit)
      }

    Repo.all(query)
  end

  def post_sale_journal(sale_id, business_id, owner_id, posted_by_id) do
    sale = Repo.get(Kaarobar.Schemas.Sale, sale_id) |> Repo.preload([:items, :payments])

    cash_account = get_account_by_code(business_id, "1000")
    bank_account = get_account_by_code(business_id, "1010")
    revenue_account = get_account_by_code(business_id, "4000")
    sales_tax_account = get_account_by_code(business_id, "2100")
    cogs_account = get_account_by_code(business_id, "5000")
    inventory_account = get_account_by_code(business_id, "1200")

    tender_lines =
      (sale.payments || [])
      |> Enum.group_by(& &1.method)
      |> Enum.map(fn {method, payments} ->
        amount = Enum.reduce(payments, Decimal.new(0), &Decimal.add(&2, &1.amount))
        account = if method == "cash", do: cash_account, else: bank_account

        %{
          account_id: account.id,
          debit: amount,
          credit: 0,
          memo: "Sale #{sale.invoice_number} (#{method})"
        }
      end)

    tender_lines =
      if tender_lines == [] do
        [
          %{
            account_id: cash_account.id,
            debit: sale.total_amount,
            credit: 0,
            memo: "Sale #{sale.invoice_number}"
          }
        ]
      else
        tender_lines
      end

    net_revenue =
      Decimal.sub(sale.subtotal || Decimal.new(0), sale.discount_amount || Decimal.new(0))
      |> Decimal.round(2)

    lines =
      tender_lines ++
        [
          %{account_id: revenue_account.id, debit: 0, credit: net_revenue, memo: "Sale revenue"},
          %{
            account_id: sales_tax_account.id,
            debit: 0,
            credit: sale.tax_amount || Decimal.new(0),
            memo: "Sales tax"
          }
        ]

    # COGS uses avg cost * qty captured at post time (stock already decremented)
    total_cost =
      Enum.reduce(sale.items, Decimal.new(0), fn item, acc ->
        inventory_record =
          Repo.get_by(Kaarobar.Schemas.InventoryRecord,
            branch_id: sale.branch_id,
            product_id: item.product_id
          )

        cost =
          if inventory_record do
            Decimal.mult(inventory_record.avg_cost || Decimal.new(0), item.quantity)
          else
            Decimal.new(0)
          end

        Decimal.add(acc, cost)
      end)

    lines =
      if Decimal.compare(total_cost, 0) == :gt do
        lines ++
          [
            %{account_id: cogs_account.id, debit: total_cost, credit: 0, memo: "COGS"},
            %{
              account_id: inventory_account.id,
              debit: 0,
              credit: total_cost,
              memo: "Inventory reduction"
            }
          ]
      else
        lines
      end

    create_manual_journal(business_id, owner_id, posted_by_id, %{
      date: Date.utc_today(),
      description: "Sale #{sale.invoice_number}",
      source_type: "sale",
      source_id: sale_id,
      lines: lines
    })
  end

  def post_purchase_journal(gr_id, business_id, owner_id, posted_by_id) do
    gr =
      Repo.get(Kaarobar.Schemas.GoodsReceipt, gr_id)
      |> Repo.preload([:items, :purchase_order])

    inventory_account = get_account_by_code(business_id, "1200")
    ap_account = get_account_by_code(business_id, "2000")

    po = Repo.preload(gr.purchase_order, :items)

    total =
      Enum.reduce(gr.items, Decimal.new(0), fn gr_item, acc ->
        po_item = Enum.find(po.items || [], &(&1.product_id == gr_item.product_id))
        cost = if po_item, do: Decimal.mult(gr_item.quantity_received, po_item.unit_cost), else: Decimal.new(0)
        Decimal.add(acc, cost)
      end)

    if Decimal.compare(total, 0) == :eq do
      {:ok, :noop}
    else
      create_manual_journal(business_id, owner_id, posted_by_id, %{
        date: Date.utc_today(),
        description: "GRN #{gr.id}",
        source_type: "grn",
        source_id: gr_id,
        lines: [
          %{account_id: inventory_account.id, debit: total, credit: 0, memo: "Stock received"},
          %{account_id: ap_account.id, debit: 0, credit: total, memo: "Accounts payable"}
        ]
      })
    end
  end

  def post_payroll_journal(payroll_run_id, business_id, owner_id, posted_by_id) do
    payroll = Repo.get(Kaarobar.Schemas.PayrollRun, payroll_run_id) |> Repo.preload(:payslips)

    total_gross = Enum.reduce(payroll.payslips, Decimal.new(0), fn slip, acc ->
      Decimal.add(acc, slip.gross_pay)
    end)

    total_net = Enum.reduce(payroll.payslips, Decimal.new(0), fn slip, acc ->
      Decimal.add(acc, slip.net_pay)
    end)

    salary_expense = get_account_by_code(business_id, "5100")
    salary_payable = get_account_by_code(business_id, "2200")
    cash_account = get_account_by_code(business_id, "1000")

    lines = [
      %{account_id: salary_expense.id, debit: total_gross, credit: 0, memo: "Payroll expense"},
      %{account_id: salary_payable.id, debit: 0, credit: total_net, memo: "Payroll payable"},
      %{account_id: cash_account.id, debit: 0, credit: total_net, memo: "Cash disbursed"}
    ]

    create_manual_journal(business_id, owner_id, posted_by_id, %{
      date: Date.utc_today(),
      description: "Payroll #{payroll.period_start} to #{payroll.period_end}",
      source_type: "payroll",
      source_id: payroll_run_id,
      lines: lines
    })
  end
end
