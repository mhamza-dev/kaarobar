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

  def list_accounts(business_id, owner_id) do
    ChartOfAccount
    |> where([a], a.business_id == ^business_id and a.owner_id == ^owner_id)
    |> order_by([a], asc: a.code)
    |> Repo.all()
  end

  def create_account(business_id, owner_id, attrs) do
    %ChartOfAccount{}
    |> ChartOfAccount.changeset(
      Map.merge(normalize_attrs(attrs), %{business_id: business_id, owner_id: owner_id})
    )
    |> Repo.insert()
  end

  def update_account(account_id, owner_id, attrs) do
    case Repo.get_by(ChartOfAccount, id: account_id, owner_id: owner_id) do
      nil ->
        {:error, :not_found}

      account ->
        account
        |> ChartOfAccount.changeset(Map.take(normalize_attrs(attrs), [:name, :type, :parent_account_id]))
        |> Repo.update()
    end
  end

  def create_manual_journal(business_id, owner_id, posted_by_id, attrs) do
    source_type = attrs[:source_type] || attrs["source_type"] || "manual"
    source_id = attrs[:source_id] || attrs["source_id"]

    with :ok <- ensure_no_duplicate_source(source_type, source_id),
         lines <- attrs[:lines] || attrs["lines"] || [],
         :ok <- validate_lines(lines) do
      total_debit = sum_side(lines, :debit)
      total_credit = sum_side(lines, :credit)

      if Decimal.compare(total_debit, total_credit) != :eq do
        {:error, :unbalanced_entry}
      else
        date = parse_date(attrs[:date] || attrs["date"])

        Multi.new()
        |> Multi.insert(:journal_entry, fn _ ->
          %JournalEntry{}
          |> JournalEntry.changeset(%{
            business_id: business_id,
            owner_id: owner_id,
            posted_by_id: posted_by_id,
            branch_id: attrs[:branch_id] || attrs["branch_id"],
            date: date,
            description: attrs[:description] || attrs["description"],
            source_type: source_type,
            source_id: source_id,
            reversed_entry_id: attrs[:reversed_entry_id] || attrs["reversed_entry_id"],
            is_locked: false
          })
        end)
        |> Multi.run(:journal_lines, fn _repo, %{journal_entry: entry} ->
          results =
            Enum.map(lines, fn line_attrs ->
              %JournalLine{}
              |> JournalLine.changeset(Map.merge(normalize_line(line_attrs), %{journal_entry_id: entry.id}))
              |> Repo.insert()
            end)

          if Enum.all?(results, &match?({:ok, _}, &1)) do
            {:ok, Enum.map(results, fn {:ok, line} -> line end)}
          else
            {:error, :line_insert_failed}
          end
        end)
        |> Multi.run(:lock, fn _repo, %{journal_entry: entry} ->
          # Bypass immutability: lock while still unlocked (OLD.is_locked = false)
          {1, _} =
            from(j in JournalEntry, where: j.id == ^entry.id and j.is_locked == false)
            |> Repo.update_all(set: [is_locked: true])

          {:ok, Repo.get!(JournalEntry, entry.id) |> Repo.preload(:lines)}
        end)
        |> Repo.transaction()
        |> case do
          {:ok, %{lock: entry}} -> {:ok, entry}
          {:error, _op, reason, _changes} -> {:error, reason}
        end
      end
    end
  end

  defp ensure_no_duplicate_source(_type, nil), do: :ok

  defp ensure_no_duplicate_source(source_type, source_id) do
    existing =
      JournalEntry
      |> where([j], j.source_type == ^source_type and j.source_id == ^source_id)
      |> preload(:lines)
      |> Repo.one()

    if existing, do: {:ok, existing}, else: :ok
  end

  defp validate_lines([]), do: {:error, :empty_lines}

  defp validate_lines(lines) do
    Enum.reduce_while(lines, :ok, fn line, :ok ->
      debit = to_dec(line[:debit] || line["debit"] || 0)
      credit = to_dec(line[:credit] || line["credit"] || 0)
      account_id = line[:account_id] || line["account_id"]

      cond do
        is_nil(account_id) or account_id == "" ->
          {:halt, {:error, :account_required}}

        Decimal.compare(debit, 0) == :gt and Decimal.compare(credit, 0) == :gt ->
          {:halt, {:error, :line_both_sides}}

        Decimal.compare(debit, 0) == :eq and Decimal.compare(credit, 0) == :eq ->
          {:halt, {:error, :line_zero}}

        true ->
          {:cont, :ok}
      end
    end)
  end

  defp sum_side(lines, side) do
    Enum.reduce(lines, Decimal.new(0), fn line, acc ->
      Decimal.add(acc, to_dec(line[side] || line[Atom.to_string(side)] || 0))
    end)
  end

  defp normalize_line(line) when is_map(line) do
    %{
      account_id: line[:account_id] || line["account_id"],
      debit: to_dec(line[:debit] || line["debit"] || 0),
      credit: to_dec(line[:credit] || line["credit"] || 0),
      memo: line[:memo] || line["memo"]
    }
  end

  defp normalize_attrs(attrs) when is_map(attrs) do
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

  def reverse_journal(journal_entry_id, owner_id, posted_by_id) do
    entry = Repo.get_by(JournalEntry, id: journal_entry_id, owner_id: owner_id) |> then(&(&1 && Repo.preload(&1, :lines)))

    cond do
      is_nil(entry) ->
        {:error, :not_found}

      not entry.is_locked ->
        {:error, :not_posted}

      already_reversed?(entry.id) ->
        {:error, :already_reversed}

      true ->
        reversed_lines =
          Enum.map(entry.lines, fn line ->
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
          source_id: entry.id,
          reversed_entry_id: entry.id,
          branch_id: entry.branch_id,
          lines: reversed_lines
        })
    end
  end

  defp already_reversed?(entry_id) do
    from(j in JournalEntry, where: j.reversed_entry_id == ^entry_id)
    |> Repo.exists?()
  end

  def list_journals(business_id, owner_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 100)

    JournalEntry
    |> where([j], j.business_id == ^business_id and j.owner_id == ^owner_id)
    |> order_by([j], desc: j.date, desc: j.inserted_at)
    |> limit(^limit)
    |> preload(:lines)
    |> Repo.all()
  end

  def get_journal(journal_id, owner_id) do
    JournalEntry
    |> where([j], j.id == ^journal_id and j.owner_id == ^owner_id)
    |> preload(lines: :account)
    |> Repo.one()
  end

  def trial_balance(business_id, owner_id, from_date \\ nil, to_date \\ nil) do
    query =
      from jl in JournalLine,
        join: je in JournalEntry,
        on: jl.journal_entry_id == je.id,
        join: acc in ChartOfAccount,
        on: jl.account_id == acc.id,
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

    query =
      if from_date do
        where(query, [jl, je], je.date >= ^from_date)
      else
        query
      end

    query =
      if to_date do
        where(query, [jl, je], je.date <= ^to_date)
      else
        query
      end

    Repo.all(query)
    |> Enum.map(fn row ->
      debit = row.total_debit || Decimal.new(0)
      credit = row.total_credit || Decimal.new(0)

      %{
        account_id: row.account_id,
        code: row.code,
        name: row.name,
        type: row.type,
        debit: to_string(debit),
        credit: to_string(credit),
        balance: to_string(Decimal.sub(debit, credit))
      }
    end)
  end

  def general_ledger(business_id, owner_id, account_id, from_date, to_date) do
    lines =
      from(jl in JournalLine,
        join: je in JournalEntry,
        on: jl.journal_entry_id == je.id,
        where:
          je.business_id == ^business_id and je.owner_id == ^owner_id and
            jl.account_id == ^account_id and je.date >= ^from_date and je.date <= ^to_date,
        order_by: [asc: je.date, asc: je.inserted_at],
        select: %{
          journal_id: je.id,
          date: je.date,
          description: je.description,
          memo: jl.memo,
          debit: jl.debit,
          credit: jl.credit
        }
      )
      |> Repo.all()

    {rows, _} =
      Enum.map_reduce(lines, Decimal.new(0), fn row, bal ->
        bal =
          bal
          |> Decimal.add(row.debit || Decimal.new(0))
          |> Decimal.sub(row.credit || Decimal.new(0))

        {%{
           journal_id: row.journal_id,
           date: row.date,
           description: row.description,
           memo: row.memo,
           debit: to_string(row.debit || 0),
           credit: to_string(row.credit || 0),
           balance: to_string(bal)
         }, bal}
      end)

    rows
  end

  def profit_and_loss(business_id, owner_id, from_date, to_date, opts \\ []) do
    branch_id = Keyword.get(opts, :branch_id)

    query =
      from jl in JournalLine,
        join: je in JournalEntry,
        on: jl.journal_entry_id == je.id,
        join: acc in ChartOfAccount,
        on: jl.account_id == acc.id,
        where:
          je.business_id == ^business_id and je.owner_id == ^owner_id and
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

    query =
      if branch_id do
        where(query, [jl, je], je.branch_id == ^branch_id)
      else
        query
      end

    rows =
      Repo.all(query)
      |> Enum.map(fn row ->
        debit = row.total_debit || Decimal.new(0)
        credit = row.total_credit || Decimal.new(0)

        amount =
          if row.type == "Revenue" do
            Decimal.sub(credit, debit)
          else
            Decimal.sub(debit, credit)
          end

        %{
          code: row.code,
          name: row.name,
          type: row.type,
          amount: to_string(amount)
        }
      end)

    revenue =
      rows
      |> Enum.filter(&(&1.type == "Revenue"))
      |> Enum.reduce(Decimal.new(0), &Decimal.add(&2, to_dec(&1.amount)))

    expense =
      rows
      |> Enum.filter(&(&1.type == "Expense"))
      |> Enum.reduce(Decimal.new(0), &Decimal.add(&2, to_dec(&1.amount)))

    %{
      from: from_date,
      to: to_date,
      lines: rows,
      total_revenue: to_string(revenue),
      total_expense: to_string(expense),
      net_income: to_string(Decimal.sub(revenue, expense))
    }
  end

  def balance_sheet(business_id, owner_id, as_of_date, opts \\ []) do
    branch_id = Keyword.get(opts, :branch_id)

    query =
      from jl in JournalLine,
        join: je in JournalEntry,
        on: jl.journal_entry_id == je.id,
        join: acc in ChartOfAccount,
        on: jl.account_id == acc.id,
        where:
          je.business_id == ^business_id and je.owner_id == ^owner_id and
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

    query =
      if branch_id do
        where(query, [jl, je], je.branch_id == ^branch_id)
      else
        query
      end

    rows =
      Repo.all(query)
      |> Enum.map(fn row ->
        debit = row.total_debit || Decimal.new(0)
        credit = row.total_credit || Decimal.new(0)

        balance =
          case row.type do
            "Asset" -> Decimal.sub(debit, credit)
            _ -> Decimal.sub(credit, debit)
          end

        %{
          code: row.code,
          name: row.name,
          type: row.type,
          balance: to_string(balance)
        }
      end)

    total = fn type ->
      rows
      |> Enum.filter(&(&1.type == type))
      |> Enum.reduce(Decimal.new(0), &Decimal.add(&2, to_dec(&1.balance)))
    end

    %{
      as_of: as_of_date,
      lines: rows,
      total_assets: to_string(total.("Asset")),
      total_liabilities: to_string(total.("Liability")),
      total_equity: to_string(total.("Equity"))
    }
  end

  def consolidated_trial_balance(owner_id) do
    from(jl in JournalLine,
      join: je in JournalEntry,
      on: jl.journal_entry_id == je.id,
      join: acc in ChartOfAccount,
      on: jl.account_id == acc.id,
      where: je.owner_id == ^owner_id,
      group_by: [acc.code, acc.name, acc.type],
      select: %{
        code: acc.code,
        name: acc.name,
        type: acc.type,
        total_debit: sum(jl.debit),
        total_credit: sum(jl.credit)
      }
    )
    |> Repo.all()
    |> Enum.map(fn row ->
      %{
        code: row.code,
        name: row.name,
        type: row.type,
        debit: to_string(row.total_debit || 0),
        credit: to_string(row.total_credit || 0)
      }
    end)
  end

  defp parse_date(%Date{} = d), do: d
  defp parse_date(nil), do: Date.utc_today()

  defp parse_date(str) when is_binary(str) do
    case Date.from_iso8601(str) do
      {:ok, d} -> d
      _ -> Date.utc_today()
    end
  end

  defp to_dec(%Decimal{} = d), do: d
  defp to_dec(nil), do: Decimal.new(0)
  defp to_dec(v) when is_integer(v), do: Decimal.new(v)
  defp to_dec(v) when is_float(v), do: Decimal.from_float(v)

  defp to_dec(v) do
    cleaned =
      "#{v}"
      |> String.trim()
      |> String.replace(",", "")
      |> String.replace(" ", "")

    case cleaned do
      "" -> Decimal.new(0)
      _ -> Decimal.new(cleaned)
    end
  end

  ## —— Auto-post (ACC-FR-004) ————————————————————————————————————

  def post_sale_journal(sale_id, business_id, owner_id, posted_by_id) do
    sale = Repo.get(Kaarobar.Schemas.Sale, sale_id) |> Repo.preload([:items, :payments])

    cash_account = get_account_by_code(business_id, "1000")
    bank_account = get_account_by_code(business_id, "1010")
    ar_account = get_account_by_code(business_id, "1100")
    revenue_account = get_account_by_code(business_id, "4000")
    sales_tax_account = get_account_by_code(business_id, "2100")
    cogs_account = get_account_by_code(business_id, "5000")
    inventory_account = get_account_by_code(business_id, "1200")

    tender_lines =
      (sale.payments || [])
      |> Enum.group_by(& &1.method)
      |> Enum.map(fn {method, payments} ->
        amount = Enum.reduce(payments, Decimal.new(0), &Decimal.add(&2, &1.amount))

        account =
          case method do
            "cash" -> cash_account
            "khata" -> ar_account
            "credit" -> ar_account
            _ -> bank_account
          end

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
      branch_id: sale.branch_id,
      lines: lines
    })
  end

  def post_return_journal(return_id, business_id, owner_id, posted_by_id) do
    sale_return =
      Repo.get(Kaarobar.Schemas.SaleReturn, return_id)
      |> Repo.preload([:items, :sale])

    if is_nil(sale_return) or sale_return.status != "Approved" do
      {:error, :invalid_return}
    else
      cash_account = get_account_by_code(business_id, "1000")
      bank_account = get_account_by_code(business_id, "1010")
      returns_account = get_account_by_code(business_id, "4100")
      sales_tax_account = get_account_by_code(business_id, "2100")
      cogs_account = get_account_by_code(business_id, "5000")
      inventory_account = get_account_by_code(business_id, "1200")

      refund = sale_return.refund_amount || Decimal.new(0)

      # Approximate tax portion from original sale ratio
      sale = sale_return.sale
      tax_portion =
        if sale && Decimal.compare(sale.total_amount || Decimal.new(0), 0) == :gt do
          Decimal.mult(refund, Decimal.div(sale.tax_amount || Decimal.new(0), sale.total_amount))
          |> Decimal.round(2)
        else
          Decimal.new(0)
        end

      net_portion = Decimal.sub(refund, tax_portion) |> Decimal.round(2)

      tender_account =
        if sale_return.refund_method == "cash", do: cash_account, else: bank_account

      lines = [
        %{account_id: returns_account.id, debit: net_portion, credit: 0, memo: "Sales returns"},
        %{account_id: sales_tax_account.id, debit: tax_portion, credit: 0, memo: "Tax refund"},
        %{account_id: tender_account.id, debit: 0, credit: refund, memo: "Refund (#{sale_return.refund_method})"}
      ]

      # Reverse COGS using avg cost on restored items
      total_cost =
        Enum.reduce(sale_return.items || [], Decimal.new(0), fn item, acc ->
          inv =
            Repo.get_by(Kaarobar.Schemas.InventoryRecord,
              branch_id: sale_return.branch_id,
              product_id: item.product_id
            )

          cost =
            if inv do
              Decimal.mult(inv.avg_cost || Decimal.new(0), item.quantity)
            else
              Decimal.new(0)
            end

          Decimal.add(acc, cost)
        end)

      lines =
        if Decimal.compare(total_cost, 0) == :gt do
          lines ++
            [
              %{account_id: inventory_account.id, debit: total_cost, credit: 0, memo: "Stock restored"},
              %{account_id: cogs_account.id, debit: 0, credit: total_cost, memo: "COGS reversal"}
            ]
        else
          lines
        end

      create_manual_journal(business_id, owner_id, posted_by_id, %{
        date: Date.utc_today(),
        description: "Return #{sale_return.id}",
        source_type: "sale_return",
        source_id: return_id,
        branch_id: sale_return.branch_id,
        lines: lines
      })
    end
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
      with {:ok, journal} <-
             create_manual_journal(business_id, owner_id, posted_by_id, %{
               date: Date.utc_today(),
               description: "GRN #{gr.id}",
               source_type: "grn",
               source_id: gr_id,
               branch_id: gr.branch_id,
               lines: [
                 %{account_id: inventory_account.id, debit: total, credit: 0, memo: "Stock received"},
                 %{account_id: ap_account.id, debit: 0, credit: total, memo: "Accounts payable"}
               ]
             }) do
        maybe_create_ap_from_grn(gr, po, total, journal.id)
        {:ok, journal}
      end
    end
  end

  defp maybe_create_ap_from_grn(gr, po, total, journal_id) do
    supplier_id = po && po.supplier_id

    if supplier_id do
      %Kaarobar.Schemas.ApBill{}
      |> Kaarobar.Schemas.ApBill.changeset(%{
        owner_id: gr.owner_id,
        business_id: gr.business_id,
        branch_id: gr.branch_id,
        supplier_id: supplier_id,
        bill_number: "GRN-#{String.slice(gr.id, 0, 8)}",
        bill_date: Date.utc_today(),
        due_date: Date.add(Date.utc_today(), 30),
        total_amount: total,
        balance_due: total,
        status: "open",
        source_type: "grn",
        source_id: gr.id,
        journal_entry_id: journal_id
      })
      |> Repo.insert()
    else
      {:ok, :skipped}
    end
  end

  def post_payroll_journal(payroll_run_id, business_id, owner_id, posted_by_id) do
    payroll = Repo.get(Kaarobar.Schemas.PayrollRun, payroll_run_id) |> Repo.preload(:payslips)

    if is_nil(payroll) do
      {:error, :not_found}
    else
      total_gross =
        Enum.reduce(payroll.payslips, Decimal.new(0), fn slip, acc ->
          Decimal.add(acc, slip.gross_pay || Decimal.new(0))
        end)

      total_net =
        Enum.reduce(payroll.payslips, Decimal.new(0), fn slip, acc ->
          Decimal.add(acc, slip.net_pay || Decimal.new(0))
        end)

      total_tax =
        Enum.reduce(payroll.payslips, Decimal.new(0), fn slip, acc ->
          tax = Map.get(slip.deductions || %{}, "income_tax") || Map.get(slip.deductions || %{}, :income_tax) || 0
          Decimal.add(acc, to_dec(tax))
        end)

      total_eobi =
        Enum.reduce(payroll.payslips, Decimal.new(0), fn slip, acc ->
          eobi = Map.get(slip.deductions || %{}, "eobi") || Map.get(slip.deductions || %{}, :eobi) || 0
          Decimal.add(acc, to_dec(eobi))
        end)

      salary_expense = get_account_by_code(business_id, "5100")
      salary_payable = get_account_by_code(business_id, "2200")
      eobi_payable = get_account_by_code(business_id, "2210")
      cash_account = get_account_by_code(business_id, "1000")

      lines = [
        %{account_id: salary_expense.id, debit: total_gross, credit: 0, memo: "Payroll expense"},
        %{account_id: cash_account.id, debit: 0, credit: total_net, memo: "Net pay disbursed"}
      ]

      lines =
        if Decimal.compare(total_tax, 0) == :gt do
          lines ++
            [
              %{
                account_id: salary_payable.id,
                debit: 0,
                credit: Decimal.round(total_tax, 2),
                memo: "Income tax withheld"
              }
            ]
        else
          lines
        end

      lines =
        if Decimal.compare(total_eobi, 0) == :gt do
          lines ++
            [
              %{
                account_id: eobi_payable.id,
                debit: 0,
                credit: Decimal.round(total_eobi, 2),
                memo: "EOBI employee share"
              }
            ]
        else
          lines
        end

      case create_manual_journal(business_id, owner_id, posted_by_id, %{
             date: Date.utc_today(),
             description: "Payroll #{payroll.period_start} to #{payroll.period_end}",
             source_type: "payroll",
             source_id: payroll_run_id,
             lines: lines
           }) do
        {:ok, entry} ->
          Kaarobar.Hr.mark_payroll_posted(payroll_run_id, entry.id)
          {:ok, entry}

        other ->
          other
      end
    end
  end

  ## —— AR / AP (ACC-FR-012 / 013) ——————————————————————————————

  def create_ar_invoice(business_id, owner_id, posted_by_id, attrs) do
    customer_id = attrs[:customer_id] || attrs["customer_id"]
    subtotal = to_dec(attrs[:subtotal] || attrs["subtotal"] || 0)
    tax = to_dec(attrs[:tax_amount] || attrs["tax_amount"] || 0)
    total = Decimal.add(subtotal, tax) |> Decimal.round(2)
    invoice_number = attrs[:invoice_number] || attrs["invoice_number"] || "AR-#{System.unique_integer([:positive])}"

    ar_account = get_account_by_code(business_id, "1100")
    revenue_account = get_account_by_code(business_id, "4000")
    tax_account = get_account_by_code(business_id, "2100")

    lines = [
      %{account_id: ar_account.id, debit: total, credit: 0, memo: "AR invoice"},
      %{account_id: revenue_account.id, debit: 0, credit: subtotal, memo: "Revenue"}
    ]

    lines =
      if Decimal.compare(tax, 0) == :gt do
        lines ++ [%{account_id: tax_account.id, debit: 0, credit: tax, memo: "Sales tax"}]
      else
        lines
      end

    Multi.new()
    |> Multi.run(:journal, fn _repo, _ ->
      create_manual_journal(business_id, owner_id, posted_by_id, %{
        date: parse_date(attrs[:invoice_date] || attrs["invoice_date"]),
        description: "AR #{invoice_number}",
        source_type: "ar_invoice",
        branch_id: attrs[:branch_id] || attrs["branch_id"],
        lines: lines
      })
    end)
    |> Multi.insert(:invoice, fn %{journal: journal} ->
      %Kaarobar.Schemas.ArInvoice{}
      |> Kaarobar.Schemas.ArInvoice.changeset(%{
        owner_id: owner_id,
        business_id: business_id,
        branch_id: attrs[:branch_id] || attrs["branch_id"],
        customer_id: customer_id,
        invoice_number: invoice_number,
        invoice_date: parse_date(attrs[:invoice_date] || attrs["invoice_date"]),
        due_date: parse_date(attrs[:due_date] || attrs["due_date"] || Date.add(Date.utc_today(), 30)),
        subtotal: subtotal,
        tax_amount: tax,
        total_amount: total,
        balance_due: total,
        status: "open",
        notes: attrs[:notes] || attrs["notes"],
        journal_entry_id: journal.id
      })
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{invoice: inv}} -> {:ok, Repo.preload(inv, [:customer, :payments])}
      {:error, _op, reason, _} -> {:error, reason}
    end
  end

  def record_ar_payment(invoice_id, owner_id, posted_by_id, attrs) do
    invoice = Repo.get_by(Kaarobar.Schemas.ArInvoice, id: invoice_id, owner_id: owner_id)
    amount = to_dec(attrs[:amount] || attrs["amount"])

    cond do
      is_nil(invoice) ->
        {:error, :not_found}

      Decimal.compare(amount, 0) != :gt ->
        {:error, :invalid_amount}

      Decimal.compare(amount, invoice.balance_due) == :gt ->
        {:error, :overpayment}

      true ->
        method = attrs[:method] || attrs["method"] || "cash"
        cash = get_account_by_code(invoice.business_id, if(method == "cash", do: "1000", else: "1010"))
        ar = get_account_by_code(invoice.business_id, "1100")

        Multi.new()
        |> Multi.run(:journal, fn _repo, _ ->
          create_manual_journal(invoice.business_id, owner_id, posted_by_id, %{
            date: Date.utc_today(),
            description: "AR payment #{invoice.invoice_number}",
            source_type: "ar_payment",
            lines: [
              %{account_id: cash.id, debit: amount, credit: 0, memo: "Receipt"},
              %{account_id: ar.id, debit: 0, credit: amount, memo: "AR reduction"}
            ]
          })
        end)
        |> Multi.insert(:payment, fn %{journal: journal} ->
          %Kaarobar.Schemas.ArPayment{}
          |> Kaarobar.Schemas.ArPayment.changeset(%{
            owner_id: owner_id,
            business_id: invoice.business_id,
            ar_invoice_id: invoice.id,
            amount: amount,
            method: method,
            paid_at: DateTime.utc_now() |> DateTime.truncate(:second),
            reference: attrs[:reference] || attrs["reference"],
            journal_entry_id: journal.id
          })
        end)
        |> Multi.run(:update_invoice, fn _repo, _ ->
          balance = Decimal.sub(invoice.balance_due, amount) |> Decimal.round(2)

          status =
            cond do
              Decimal.compare(balance, 0) == :eq -> "paid"
              true -> "partial"
            end

          invoice
          |> Kaarobar.Schemas.ArInvoice.changeset(%{balance_due: balance, status: status})
          |> Repo.update()
        end)
        |> Repo.transaction()
        |> case do
          {:ok, %{payment: p}} -> {:ok, p}
          {:error, _op, reason, _} -> {:error, reason}
        end
    end
  end

  def ar_aging(business_id, owner_id, as_of \\ Date.utc_today()) do
    from(i in Kaarobar.Schemas.ArInvoice,
      where:
        i.business_id == ^business_id and i.owner_id == ^owner_id and
          i.status in ["open", "partial"] and i.balance_due > 0,
      preload: [:customer]
    )
    |> Repo.all()
    |> Enum.map(&age_row(&1, as_of, :ar))
  end

  def create_ap_bill(business_id, owner_id, posted_by_id, attrs) do
    supplier_id = attrs[:supplier_id] || attrs["supplier_id"]
    total = to_dec(attrs[:total_amount] || attrs["total_amount"])
    bill_number = attrs[:bill_number] || attrs["bill_number"] || "AP-#{System.unique_integer([:positive])}"

    expense_or_inv = get_account_by_code(business_id, attrs[:account_code] || attrs["account_code"] || "1200")
    ap = get_account_by_code(business_id, "2000")

    Multi.new()
    |> Multi.run(:journal, fn _repo, _ ->
      create_manual_journal(business_id, owner_id, posted_by_id, %{
        date: parse_date(attrs[:bill_date] || attrs["bill_date"]),
        description: "AP #{bill_number}",
        source_type: "ap_bill",
        branch_id: attrs[:branch_id] || attrs["branch_id"],
        lines: [
          %{account_id: expense_or_inv.id, debit: total, credit: 0, memo: "Bill"},
          %{account_id: ap.id, debit: 0, credit: total, memo: "AP"}
        ]
      })
    end)
    |> Multi.insert(:bill, fn %{journal: journal} ->
      %Kaarobar.Schemas.ApBill{}
      |> Kaarobar.Schemas.ApBill.changeset(%{
        owner_id: owner_id,
        business_id: business_id,
        branch_id: attrs[:branch_id] || attrs["branch_id"],
        supplier_id: supplier_id,
        bill_number: bill_number,
        bill_date: parse_date(attrs[:bill_date] || attrs["bill_date"]),
        due_date: parse_date(attrs[:due_date] || attrs["due_date"] || Date.add(Date.utc_today(), 30)),
        total_amount: total,
        balance_due: total,
        status: "open",
        notes: attrs[:notes] || attrs["notes"],
        journal_entry_id: journal.id
      })
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{bill: bill}} -> {:ok, Repo.preload(bill, [:supplier, :payments])}
      {:error, _op, reason, _} -> {:error, reason}
    end
  end

  def record_ap_payment(bill_id, owner_id, posted_by_id, attrs) do
    bill = Repo.get_by(Kaarobar.Schemas.ApBill, id: bill_id, owner_id: owner_id)
    amount = to_dec(attrs[:amount] || attrs["amount"])

    cond do
      is_nil(bill) ->
        {:error, :not_found}

      Decimal.compare(amount, 0) != :gt ->
        {:error, :invalid_amount}

      Decimal.compare(amount, bill.balance_due) == :gt ->
        {:error, :overpayment}

      true ->
        method = attrs[:method] || attrs["method"] || "cash"
        cash = get_account_by_code(bill.business_id, if(method == "cash", do: "1000", else: "1010"))
        ap = get_account_by_code(bill.business_id, "2000")

        Multi.new()
        |> Multi.run(:journal, fn _repo, _ ->
          create_manual_journal(bill.business_id, owner_id, posted_by_id, %{
            date: Date.utc_today(),
            description: "AP payment #{bill.bill_number}",
            source_type: "ap_payment",
            lines: [
              %{account_id: ap.id, debit: amount, credit: 0, memo: "AP reduction"},
              %{account_id: cash.id, debit: 0, credit: amount, memo: "Payment"}
            ]
          })
        end)
        |> Multi.insert(:payment, fn %{journal: journal} ->
          %Kaarobar.Schemas.ApPayment{}
          |> Kaarobar.Schemas.ApPayment.changeset(%{
            owner_id: owner_id,
            business_id: bill.business_id,
            ap_bill_id: bill.id,
            amount: amount,
            method: method,
            paid_at: DateTime.utc_now() |> DateTime.truncate(:second),
            reference: attrs[:reference] || attrs["reference"],
            journal_entry_id: journal.id
          })
        end)
        |> Multi.run(:update_bill, fn _repo, _ ->
          balance = Decimal.sub(bill.balance_due, amount) |> Decimal.round(2)
          status = if Decimal.compare(balance, 0) == :eq, do: "paid", else: "partial"

          bill
          |> Kaarobar.Schemas.ApBill.changeset(%{balance_due: balance, status: status})
          |> Repo.update()
        end)
        |> Repo.transaction()
        |> case do
          {:ok, %{payment: p}} -> {:ok, p}
          {:error, _op, reason, _} -> {:error, reason}
        end
    end
  end

  def ap_aging(business_id, owner_id, as_of \\ Date.utc_today()) do
    from(b in Kaarobar.Schemas.ApBill,
      where:
        b.business_id == ^business_id and b.owner_id == ^owner_id and
          b.status in ["open", "partial"] and b.balance_due > 0,
      preload: [:supplier]
    )
    |> Repo.all()
    |> Enum.map(&age_row(&1, as_of, :ap))
  end

  def list_ar_invoices(business_id, owner_id) do
    from(i in Kaarobar.Schemas.ArInvoice,
      where: i.business_id == ^business_id and i.owner_id == ^owner_id,
      order_by: [desc: i.invoice_date],
      preload: [:customer]
    )
    |> Repo.all()
  end

  def list_ap_bills(business_id, owner_id) do
    from(b in Kaarobar.Schemas.ApBill,
      where: b.business_id == ^business_id and b.owner_id == ^owner_id,
      order_by: [desc: b.bill_date],
      preload: [:supplier]
    )
    |> Repo.all()
  end

  defp age_row(doc, as_of, kind) do
    due = doc.due_date || doc.invoice_date || doc.bill_date || as_of
    days = Date.diff(as_of, due)

    bucket =
      cond do
        days <= 0 -> "current"
        days <= 30 -> "1_30"
        days <= 60 -> "31_60"
        days <= 90 -> "61_90"
        true -> "90_plus"
      end

    base = %{
      id: doc.id,
      balance_due: to_string(doc.balance_due),
      due_date: due,
      days_past_due: max(days, 0),
      bucket: bucket,
      status: doc.status
    }

    case kind do
      :ar ->
        Map.merge(base, %{
          invoice_number: doc.invoice_number,
          customer_name: doc.customer && doc.customer.name
        })

      :ap ->
        Map.merge(base, %{
          bill_number: doc.bill_number,
          supplier_name: doc.supplier && doc.supplier.name
        })
    end
  end

  def customer_balance(customer_id, business_id, owner_id) do
    open =
      from(i in Kaarobar.Schemas.ArInvoice,
        where:
          i.customer_id == ^customer_id and i.business_id == ^business_id and
            i.owner_id == ^owner_id and i.status in ["open", "partial"],
        select: coalesce(sum(i.balance_due), 0)
      )
      |> Repo.one()

    to_string(open || Decimal.new(0))
  end

  def customer_ledger(customer_id, business_id, owner_id) do
    invoices =
      from(i in Kaarobar.Schemas.ArInvoice,
        where:
          i.customer_id == ^customer_id and i.business_id == ^business_id and
            i.owner_id == ^owner_id,
        order_by: [desc: i.inserted_at],
        preload: [:payments]
      )
      |> Repo.all()

    sales =
      from(s in Kaarobar.Schemas.Sale,
        where:
          s.customer_id == ^customer_id and s.business_id == ^business_id and
            s.owner_id == ^owner_id,
        order_by: [desc: s.inserted_at],
        preload: [:payments]
      )
      |> Repo.all()

    inv_entries =
      Enum.flat_map(invoices, fn inv ->
        base = [
          %{
            id: inv.id,
            kind: "ar_invoice",
            date: inv.invoice_date || DateTime.to_date(inv.inserted_at),
            reference: inv.invoice_number,
            description: inv.notes || "AR invoice",
            debit: to_string(inv.total_amount),
            credit: "0",
            balance_due: to_string(inv.balance_due),
            sale_id: inv.sale_id
          }
        ]

        pays =
          Enum.map(inv.payments || [], fn p ->
            %{
              id: p.id,
              kind: "ar_payment",
              date: DateTime.to_date(p.inserted_at),
              reference: inv.invoice_number,
              description: "Payment (#{p.method})",
              debit: "0",
              credit: to_string(p.amount),
              balance_due: nil,
              sale_id: inv.sale_id
            }
          end)

        base ++ pays
      end)

    sale_entries =
      Enum.map(sales, fn s ->
        khata =
          (s.payments || [])
          |> Enum.filter(&(&1.method in ["khata", "credit"]))
          |> Enum.reduce(Decimal.new(0), &Decimal.add(&2, &1.amount))

        %{
          id: s.id,
          kind: "sale",
          date: DateTime.to_date(s.inserted_at),
          reference: s.invoice_number,
          description: if(Decimal.compare(khata, 0) == :gt, do: "POS khata sale", else: "POS sale"),
          debit: to_string(s.total_amount),
          credit: "0",
          balance_due: nil,
          sale_id: s.id
        }
      end)

    (inv_entries ++ sale_entries)
    |> Enum.uniq_by(&{&1.kind, &1.id})
    |> Enum.sort_by(& &1.date, {:desc, Date})
  end
end
