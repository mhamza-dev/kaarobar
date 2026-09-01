defmodule KaarobarWeb.ExpenseJSON do
  @moduledoc """
  Serialising spends, the categories they are filed under, and the accounts
  they are paid from.
  """

  alias Kaarobar.Finance.BankAccount
  alias Kaarobar.Finance.Category
  alias Kaarobar.Finance.Expense
  alias KaarobarWeb.JSONHelpers, as: H

  def expenses(%{expenses: expenses}), do: %{data: Enum.map(expenses, &serialise_expense/1)}

  def expense(%{expense: expense}), do: %{data: serialise_expense(expense)}

  def categories(%{categories: categories}),
    do: %{data: Enum.map(categories, &serialise_category/1)}

  def category(%{category: category}), do: %{data: serialise_category(category)}

  def bank_accounts(%{accounts: accounts}),
    do: %{data: Enum.map(accounts, &serialise_account/1)}

  def bank_account(%{account: account}), do: %{data: serialise_account(account)}

  def spend(%{spend: spend, operating: operating}) do
    %{
      data: %{
        # What is subtracted from gross profit. Cost-of-sales rows are listed
        # below but excluded from this figure: that money already reached the
        # profit line through each sale's cost snapshot.
        operating_total: H.money(operating),
        categories:
          Enum.map(spend, fn row ->
            %{
              category_id: row.category_id,
              category: row.category,
              kind: row.kind,
              total: H.money(row.total),
              tax_total: H.money(row.tax_total),
              count: row.count,
              counted_against_profit: row.kind != "cost_of_sales"
            }
          end)
      }
    }
  end

  defp serialise_expense(%Expense{} = expense) do
    %{
      id: expense.id,
      number: expense.number,
      description: expense.description,
      amount: H.money(expense.amount),
      tax_amount: H.money(expense.tax_amount),
      gross: H.money(Expense.gross(expense)),
      currency: expense.currency,
      method: expense.method,
      reference: expense.reference,
      # The date the money belongs to, which is not the date it was typed in.
      spent_on: expense.spent_on,
      status: expense.status,
      counts_against_profit: Expense.counts?(expense),
      branch_id: expense.branch_id,
      category: preloaded(expense.expense_category, &serialise_category/1),
      bank_account: preloaded(expense.bank_account, &serialise_account/1),
      supplier_id: expense.supplier_id,
      recorded_by: preloaded_name(expense.recorded_by),
      approved_by: preloaded_name(expense.approved_by),
      approved_at: expense.approved_at,
      notes: expense.notes,
      attachment_path: expense.attachment_path,
      inserted_at: expense.inserted_at
    }
  end

  defp serialise_category(%Category{} = category) do
    %{
      id: category.id,
      name: category.name,
      code: category.code,
      kind: category.kind,
      is_active: category.is_active,
      counted_in_cost_of_sales: Category.counted_in_cost_of_sales?(category)
    }
  end

  defp serialise_account(%BankAccount{} = account) do
    %{
      id: account.id,
      name: account.name,
      bank_name: account.bank_name,
      account_number: account.account_number,
      iban: account.iban,
      currency: account.currency,
      balance: H.money(account.balance, account.currency),
      opening_balance: H.money(account.opening_balance, account.currency),
      is_active: account.is_active
    }
  end

  defp preloaded(%{} = record, fun) when not is_struct(record, Ecto.Association.NotLoaded),
    do: fun.(record)

  defp preloaded(_not_loaded, _fun), do: nil

  defp preloaded_name(%{name: name}) when is_binary(name), do: name
  defp preloaded_name(_not_loaded), do: nil
end
