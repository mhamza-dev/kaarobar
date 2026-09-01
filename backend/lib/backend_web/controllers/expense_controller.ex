defmodule KaarobarWeb.ExpenseController do
  @moduledoc """
  What the shop spends, and the accounts it spends from.

  ## Recording is not approving

  Most shops have one person who spends and the same person who writes it
  down, so an expense is `recorded` by default and never waits for anybody.
  `approve` and `reject` exist for the shops that do separate the two, and are
  gated on their own permission so the split is real where it is used.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Finance

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "expense:view"] when action in [:index, :show, :categories, :by_category]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "expense:create"]
       when action in [:create, :update_category, :create_category, :delete_category]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "expense:approve"] when action in [:approve, :reject, :delete]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "bank_account:manage"]
       when action in [:bank_accounts, :create_bank_account, :update_bank_account,
                       :delete_bank_account]

  # --- Expenses ---------------------------------------------------------------

  def index(conn, params) do
    render(conn, :expenses, expenses: Finance.list_expenses(conn.assigns.scope, filters(params)))
  end

  def show(conn, %{"id" => id}) do
    with {:ok, expense} <- Finance.fetch_expense(conn.assigns.scope, id) do
      render(conn, :expense, expense: expense)
    end
  end

  def create(conn, params) do
    with {:ok, expense} <- Finance.create_expense(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:expense, expense: expense)
    end
  end

  def approve(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, expense} <- Finance.fetch_expense(scope, id),
         {:ok, approved} <- Finance.approve_expense(scope, expense) do
      render(conn, :expense, expense: approved)
    end
  end

  def reject(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, expense} <- Finance.fetch_expense(scope, id),
         {:ok, rejected} <- Finance.reject_expense(scope, expense) do
      render(conn, :expense, expense: rejected)
    end
  end

  def delete(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, expense} <- Finance.fetch_expense(scope, id),
         {:ok, deleted} <- Finance.delete_expense(scope, expense) do
      render(conn, :expense, expense: deleted)
    end
  end

  def by_category(conn, params) do
    {from, to} = period(params)

    render(conn, :spend,
      spend: Finance.spend_by_category(conn.assigns.scope, from, to),
      operating: Finance.operating_spend(conn.assigns.scope, from, to)
    )
  end

  # --- Categories -------------------------------------------------------------

  def categories(conn, _params) do
    render(conn, :categories, categories: Finance.list_categories(conn.assigns.scope))
  end

  def create_category(conn, params) do
    with {:ok, category} <- Finance.create_category(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:category, category: category)
    end
  end

  def update_category(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, category} <- Finance.fetch_category(scope, id),
         {:ok, updated} <- Finance.update_category(scope, category, params) do
      render(conn, :category, category: updated)
    end
  end

  def delete_category(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, category} <- Finance.fetch_category(scope, id),
         {:ok, deleted} <- Finance.delete_category(scope, category) do
      render(conn, :category, category: deleted)
    end
  end

  # --- Bank accounts ----------------------------------------------------------

  def bank_accounts(conn, _params) do
    render(conn, :bank_accounts, accounts: Finance.list_bank_accounts(conn.assigns.scope))
  end

  def create_bank_account(conn, params) do
    with {:ok, account} <- Finance.create_bank_account(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:bank_account, account: account)
    end
  end

  def update_bank_account(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, account} <- Finance.fetch_bank_account(scope, id),
         {:ok, updated} <- Finance.update_bank_account(scope, account, params) do
      render(conn, :bank_account, account: updated)
    end
  end

  def delete_bank_account(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, account} <- Finance.fetch_bank_account(scope, id),
         {:ok, deleted} <- Finance.delete_bank_account(scope, account) do
      render(conn, :bank_account, account: deleted)
    end
  end

  # --- Parameters -------------------------------------------------------------

  defp filters(params) do
    []
    |> put_date(:from, params["from"])
    |> put_date(:to, params["to"])
    |> put_present(:category_id, params["category_id"])
    |> put_present(:branch_id, params["branch_id"])
    |> put_present(:status, params["status"])
  end

  defp period(params) do
    to = parse_date(params["to"]) || Date.utc_today()
    from = parse_date(params["from"]) || Date.add(to, -29)
    if Date.compare(from, to) == :gt, do: {to, from}, else: {from, to}
  end

  defp put_date(opts, key, value) do
    case parse_date(value) do
      nil -> opts
      date -> Keyword.put(opts, key, date)
    end
  end

  defp put_present(opts, _key, nil), do: opts
  defp put_present(opts, _key, ""), do: opts
  defp put_present(opts, key, value), do: Keyword.put(opts, key, value)

  defp parse_date(value) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, date} -> date
      {:error, _reason} -> nil
    end
  end

  defp parse_date(_value), do: nil
end
