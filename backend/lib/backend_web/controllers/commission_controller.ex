defmodule KaarobarWeb.CommissionController do
  @moduledoc """
  What staff earn, and the rules that decide it.

  Reading a statement, changing the rules and paying out are three grants. A
  stylist should be able to see their own figures; changing the rate that
  produces them, and signing off the money, are the owner's.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Commissions

  plug KaarobarWeb.Plugs.Authorize, module: "commissions"

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "commission:view"] when action in [:rules, :statement, :summary]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "commission:manage"]
       when action in [:create_rule, :update_rule, :delete_rule]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "commission:pay"] when action in [:approve, :pay]

  def rules(conn, _params) do
    render(conn, :rules, rules: Commissions.list_rules(conn.assigns.scope))
  end

  def create_rule(conn, params) do
    with {:ok, rule} <- Commissions.create_rule(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:rule, rule: rule)
    end
  end

  def update_rule(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, rule} <- Commissions.fetch_rule(scope, id),
         {:ok, updated} <- Commissions.update_rule(scope, rule, params) do
      render(conn, :rule, rule: updated)
    end
  end

  def delete_rule(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, rule} <- Commissions.fetch_rule(scope, id),
         {:ok, deleted} <- Commissions.delete_rule(scope, rule) do
      render(conn, :rule, rule: deleted)
    end
  end

  @doc """
  One person's earnings for a period, with the lines behind them.

  The lines matter as much as the total: "why is my commission short?" is
  answered by showing which sales it came from.
  """
  def statement(conn, %{"user_id" => user_id} = params) do
    with {:ok, from} <- parse_date(params["from"]),
         {:ok, to} <- parse_date(params["to"]) do
      statement = Commissions.statement(conn.assigns.scope, user_id, from, to)
      render(conn, :statement, statement: statement)
    end
  end

  @doc "What every earner is owed for a period."
  def summary(conn, params) do
    with {:ok, from} <- parse_date(params["from"]),
         {:ok, to} <- parse_date(params["to"]) do
      render(conn, :summary, rows: Commissions.summary(conn.assigns.scope, from, to))
    end
  end

  def approve(conn, %{"ids" => ids}) when is_list(ids) do
    {:ok, count} = Commissions.approve(conn.assigns.scope, ids)
    json(conn, %{data: %{approved: count}})
  end

  def pay(conn, %{"ids" => ids}) when is_list(ids) do
    {:ok, count} = Commissions.pay(conn.assigns.scope, ids)
    json(conn, %{data: %{paid: count}})
  end

  defp parse_date(value) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, date} -> {:ok, date}
      {:error, _reason} -> {:error, :invalid_date}
    end
  end

  defp parse_date(_value), do: {:error, :invalid_date}
end
