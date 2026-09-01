defmodule Kaarobar.Finance do
  @moduledoc """
  Money leaving the business, and the accounts it leaves from.

  The other half of a profit figure. Revenue without costs is turnover, and a
  shopkeeper asking "did I make money this month?" means rent, wages,
  electricity and stock — not just what went through the till.

  ## What belongs here and what does not

  A supplier bill is a running account with somebody the shop keeps trading
  with, and it lives in `Kaarobar.Purchasing` with its own ledger and
  allocations. An expense is one settled fact with a date and an amount. Filing
  them together would mean either an expense that can be part-paid or a
  supplier balance that cannot.

  ## The bank balance is a projection

  It moves only alongside the expense that explains the movement, under a row
  lock, the same shape as stock on hand and a customer's balance. A balance
  that can be set directly is a balance nobody can reconcile.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Finance.BankAccount
  alias Kaarobar.Finance.Category
  alias Kaarobar.Finance.Expense
  alias Kaarobar.Money
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Sequences

  # ===========================================================================
  # Categories
  # ===========================================================================

  @doc "The business's expense categories, alphabetically."
  @spec list_categories(Scope.t(), keyword()) :: [Category.t()]
  def list_categories(%Scope{} = scope, opts \\ []) do
    Category
    |> Scoped.for_business(scope)
    |> where([c], is_nil(c.deleted_at))
    |> filter_active(Keyword.get(opts, :active_only, false))
    |> order_by([c], asc: c.name)
    |> Repo.all()
  end

  @doc "One category."
  @spec fetch_category(Scope.t(), Ecto.UUID.t()) :: {:ok, Category.t()} | {:error, :not_found}
  def fetch_category(%Scope{} = scope, id), do: fetch_scoped(Category, scope, id)

  @doc "Creates a category."
  @spec create_category(Scope.t(), map()) :: {:ok, Category.t()} | {:error, Ecto.Changeset.t()}
  def create_category(%Scope{} = scope, attrs) do
    %Category{}
    |> Category.changeset(tenant_attrs(scope, attrs))
    |> Repo.insert()
  end

  @doc "Renames a category or moves it above or below the gross-profit line."
  @spec update_category(Scope.t(), Category.t(), map()) ::
          {:ok, Category.t()} | {:error, Ecto.Changeset.t()}
  def update_category(%Scope{}, %Category{} = category, attrs),
    do: category |> Category.changeset(attrs) |> Repo.update()

  @doc "Retires a category. Expenses already filed under it keep it."
  @spec delete_category(Scope.t(), Category.t()) ::
          {:ok, Category.t()} | {:error, Ecto.Changeset.t()}
  def delete_category(%Scope{}, %Category{} = category),
    do: Repo.update(Category.soft_delete_changeset(category))

  # ===========================================================================
  # Bank accounts
  # ===========================================================================

  @doc "The business's bank accounts."
  @spec list_bank_accounts(Scope.t(), keyword()) :: [BankAccount.t()]
  def list_bank_accounts(%Scope{} = scope, opts \\ []) do
    BankAccount
    |> Scoped.for_business(scope)
    |> where([a], is_nil(a.deleted_at))
    |> filter_active(Keyword.get(opts, :active_only, false))
    |> order_by([a], asc: a.name)
    |> Repo.all()
  end

  @doc "One bank account."
  @spec fetch_bank_account(Scope.t(), Ecto.UUID.t()) ::
          {:ok, BankAccount.t()} | {:error, :not_found}
  def fetch_bank_account(%Scope{} = scope, id), do: fetch_scoped(BankAccount, scope, id)

  @doc """
  Opens a bank account with whatever is already in it.

  The opening balance is set once here and cannot be edited afterwards —
  changing it later would silently restate every balance since.
  """
  @spec create_bank_account(Scope.t(), map()) ::
          {:ok, BankAccount.t()} | {:error, Ecto.Changeset.t()}
  def create_bank_account(%Scope{} = scope, attrs) do
    attrs =
      scope
      |> tenant_attrs(attrs)
      |> Map.put_new("currency", scope.business && scope.business.currency)

    with {:ok, account} <- Repo.insert(BankAccount.changeset(%BankAccount{}, attrs)) do
      Audit.log(scope, "bank_account.created", account,
        entity_type: "bank_account",
        label: account.name
      )

      {:ok, account}
    end
  end

  @doc "Renames an account or changes its details. The balance is not editable."
  @spec update_bank_account(Scope.t(), BankAccount.t(), map()) ::
          {:ok, BankAccount.t()} | {:error, Ecto.Changeset.t()}
  def update_bank_account(%Scope{}, %BankAccount{} = account, attrs),
    do: account |> BankAccount.changeset(attrs) |> Repo.update()

  @doc "Closes an account. Past expenses keep pointing at it."
  @spec delete_bank_account(Scope.t(), BankAccount.t()) ::
          {:ok, BankAccount.t()} | {:error, Ecto.Changeset.t()}
  def delete_bank_account(%Scope{}, %BankAccount{} = account),
    do: Repo.update(BankAccount.soft_delete_changeset(account))

  # ===========================================================================
  # Expenses
  # ===========================================================================

  @doc """
  The business's expenses, newest spend first.

  ## Options

    * `:from`, `:to` — a `Date` range on `spent_on`, which is the date the money
      belongs to rather than the day it was typed in.
    * `:category_id`, `:branch_id`, `:status` — narrowing.
    * `:limit` — defaults to 100.
  """
  @spec list_expenses(Scope.t(), keyword()) :: [Expense.t()]
  def list_expenses(%Scope{} = scope, opts \\ []) do
    Expense
    |> Scoped.for_business(scope)
    |> where([e], is_nil(e.deleted_at))
    |> filter_dates(Keyword.get(opts, :from), Keyword.get(opts, :to))
    |> filter_equal(:expense_category_id, Keyword.get(opts, :category_id))
    |> filter_equal(:branch_id, Keyword.get(opts, :branch_id))
    |> filter_equal(:status, Keyword.get(opts, :status))
    |> order_by([e], desc: e.spent_on, desc: e.inserted_at)
    |> limit(^Keyword.get(opts, :limit, 100))
    |> preload([:expense_category, :bank_account, :recorded_by])
    |> Repo.all()
  end

  @doc "One expense."
  @spec fetch_expense(Scope.t(), Ecto.UUID.t()) :: {:ok, Expense.t()} | {:error, :not_found}
  def fetch_expense(%Scope{} = scope, id) do
    Expense
    |> Scoped.for_business(scope)
    |> where([e], e.id == ^id and is_nil(e.deleted_at))
    |> preload([:expense_category, :bank_account, :recorded_by, :approved_by])
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      expense -> {:ok, expense}
    end
  end

  @doc """
  Records a spend.

  Paid from a bank account, the account's balance moves with it in the same
  transaction — an expense that debits nothing is a balance that will not
  reconcile at the end of the month.
  """
  @spec create_expense(Scope.t(), map()) :: {:ok, Expense.t()} | {:error, term()}
  def create_expense(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      with {:ok, number} <- Sequences.next(scope, "expense"),
           {:ok, expense} <- insert_expense(scope, attrs, number),
           :ok <- debit_bank_account(expense) do
        Audit.log(scope, "expense.recorded", expense,
          entity_type: "expense",
          label: expense.number,
          summary: "#{expense.description} — #{Money.to_string(expense.amount)}"
        )

        Repo.preload(expense, [:expense_category, :bank_account])
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Approves a pending expense.

  Separate from recording it so a shop that wants a second pair of eyes can
  have them. Most shops do not, which is why `recorded` is the default state
  and this is never on the path of an ordinary entry.
  """
  @spec approve_expense(Scope.t(), Expense.t()) :: {:ok, Expense.t()} | {:error, term()}
  def approve_expense(%Scope{} = scope, %Expense{} = expense) do
    with {:ok, approved} <-
           Repo.update(Expense.approve_changeset(expense, Scope.user_id(scope))) do
      Audit.log(scope, "expense.approved", approved,
        entity_type: "expense",
        label: approved.number
      )

      {:ok, approved}
    end
  end

  @doc "Refuses an expense, keeping it visible to whoever submitted it."
  @spec reject_expense(Scope.t(), Expense.t()) :: {:ok, Expense.t()} | {:error, term()}
  def reject_expense(%Scope{} = scope, %Expense{} = expense) do
    with {:ok, rejected} <-
           Repo.update(Expense.reject_changeset(expense, Scope.user_id(scope))) do
      Audit.log(scope, "expense.rejected", rejected,
        entity_type: "expense",
        label: rejected.number
      )

      {:ok, rejected}
    end
  end

  @doc """
  Removes an expense and puts the money back where it came from.

  Soft-deleted rather than erased: an expense that was entered and withdrawn is
  a thing that happened, and an audit trail with a hole in it is worth less
  than one with a reversal in it.
  """
  @spec delete_expense(Scope.t(), Expense.t()) :: {:ok, Expense.t()} | {:error, term()}
  def delete_expense(%Scope{} = scope, %Expense{} = expense) do
    Repo.transaction(fn ->
      case Repo.update(Expense.soft_delete_changeset(expense)) do
        {:ok, deleted} ->
          credit_bank_account(deleted)

          Audit.log(scope, "expense.deleted", deleted,
            entity_type: "expense",
            label: deleted.number
          )

          deleted

        {:error, reason} ->
          Repo.rollback(reason)
      end
    end)
  end

  @doc """
  What the business spent over a period, by category.

  Cost-of-sales categories are reported separately rather than folded in: that
  money already reaches the profit figure through each sale line's cost
  snapshot, and adding it here would take it off twice.
  """
  @spec spend_by_category(Scope.t(), Date.t(), Date.t()) :: [map()]
  def spend_by_category(%Scope{} = scope, from, to) do
    Expense
    |> Scoped.for_business(scope)
    |> where([e], is_nil(e.deleted_at) and e.status in ^Expense.counted_statuses())
    |> where([e], e.spent_on >= ^from and e.spent_on <= ^to)
    |> join(:inner, [e], c in Category, on: c.id == e.expense_category_id)
    |> group_by([e, c], [c.id, c.name, c.kind])
    |> select([e, c], %{
      category_id: c.id,
      category: c.name,
      kind: c.kind,
      total: sum(e.amount),
      tax_total: sum(e.tax_amount),
      count: count(e.id)
    })
    |> order_by([e, c], desc: sum(e.amount))
    |> Repo.all()
  end

  @doc """
  The total that should be subtracted from gross profit for a period.

  Excludes cost-of-sales, for the reason in `spend_by_category/3`.
  """
  @spec operating_spend(Scope.t(), Date.t(), Date.t()) :: Decimal.t()
  def operating_spend(%Scope{} = scope, from, to) do
    scope
    |> spend_by_category(from, to)
    |> Enum.reject(&(&1.kind == "cost_of_sales"))
    |> Enum.map(&Money.add(&1.total || Money.zero(), &1.tax_total || Money.zero()))
    |> Money.sum()
  end

  # ===========================================================================
  # Internals
  # ===========================================================================

  defp insert_expense(%Scope{} = scope, attrs, number) do
    attrs =
      attrs
      |> Map.merge(%{
        "organization_id" => Scope.organization_id(scope),
        "business_id" => Scope.business_id(scope),
        "number" => number,
        "recorded_by_id" => Scope.user_id(scope)
      })
      |> Map.put_new("branch_id", Scope.branch_id(scope))
      |> Map.put_new("currency", scope.business && scope.business.currency)
      |> Map.put_new("spent_on", Date.utc_today())

    %Expense{}
    |> Expense.changeset(attrs)
    |> Repo.insert()
  end

  # Under a row lock, because two people recording spends against the same
  # account at once would otherwise both read the old balance and both write
  # their own, losing one of the two movements.
  defp debit_bank_account(%Expense{bank_account_id: nil}), do: :ok

  defp debit_bank_account(%Expense{} = expense) do
    case lock_account(expense.bank_account_id) do
      nil ->
        {:error, :bank_account_not_found}

      account ->
        balance = Money.sub(account.balance, Expense.gross(expense))

        case Repo.update(BankAccount.balance_changeset(account, balance)) do
          {:ok, _account} -> :ok
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp credit_bank_account(%Expense{bank_account_id: nil}), do: :ok

  defp credit_bank_account(%Expense{} = expense) do
    case lock_account(expense.bank_account_id) do
      nil ->
        :ok

      account ->
        balance = Money.add(account.balance, Expense.gross(expense))
        Repo.update(BankAccount.balance_changeset(account, balance))
        :ok
    end
  end

  defp lock_account(id) do
    BankAccount
    |> where([a], a.id == ^id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp fetch_scoped(schema, %Scope{} = scope, id) do
    schema
    |> Scoped.for_business(scope)
    |> where([row], row.id == ^id and is_nil(row.deleted_at))
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      row -> {:ok, row}
    end
  end

  defp tenant_attrs(%Scope{} = scope, attrs) do
    attrs
    |> stringify()
    |> Map.merge(%{
      "organization_id" => Scope.organization_id(scope),
      "business_id" => Scope.business_id(scope)
    })
  end

  defp filter_active(query, true), do: where(query, [row], row.is_active)
  defp filter_active(query, _all), do: query

  defp filter_dates(query, nil, nil), do: query
  defp filter_dates(query, from, nil), do: where(query, [e], e.spent_on >= ^from)
  defp filter_dates(query, nil, to), do: where(query, [e], e.spent_on <= ^to)
  defp filter_dates(query, from, to), do: where(query, [e], e.spent_on >= ^from and e.spent_on <= ^to)

  defp filter_equal(query, _field, nil), do: query
  defp filter_equal(query, field, value), do: where(query, [row], field(row, ^field) == ^value)

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
  end
end
