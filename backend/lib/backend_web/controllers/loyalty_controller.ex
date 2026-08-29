defmodule KaarobarWeb.LoyaltyController do
  @moduledoc """
  Points.

  Setting the rules and spending against them are separate grants. A cashier
  redeems; changing the earn rate changes what every future sale costs the
  shop, and that is an owner's decision.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Customers
  alias Kaarobar.Loyalty

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "loyalty:view"] when action in [:program, :account, :transactions]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "loyalty:manage"] when action in [:create_program, :update_program, :expire]

  plug KaarobarWeb.Plugs.Authorize, [permission: "loyalty:redeem"] when action in [:redeem]
  plug KaarobarWeb.Plugs.Authorize, [permission: "loyalty:adjust"] when action in [:adjust]

  def program(conn, _params) do
    case Loyalty.active_program(conn.assigns.scope) do
      nil -> {:error, :not_found}
      program -> render(conn, :program, program: program)
    end
  end

  def create_program(conn, params) do
    with {:ok, program} <- Loyalty.create_program(conn.assigns.scope, params) do
      conn |> put_status(:created) |> render(:program, program: program)
    end
  end

  def update_program(conn, params) do
    scope = conn.assigns.scope

    with %Loyalty.Program{} = program <- Loyalty.active_program(scope) || {:error, :not_found},
         {:ok, updated} <- Loyalty.update_program(scope, program, params) do
      render(conn, :program, program: updated)
    end
  end

  @doc "A customer's standing, or 404 when they have never earned."
  def account(conn, %{"customer_id" => customer_id}) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id) do
      case Loyalty.account_for(scope, customer) do
        nil -> {:error, :not_found}
        account -> render(conn, :account, account: account)
      end
    end
  end

  def transactions(conn, %{"customer_id" => customer_id}) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id) do
      case Loyalty.account_for(scope, customer) do
        nil ->
          {:error, :not_found}

        account ->
          render(conn, :transactions,
            account: account,
            transactions: Loyalty.list_transactions(scope, account)
          )
      end
    end
  end

  @doc """
  Spends points, returning what they are worth in money.

  `bill_total` is what the cap is measured against. Omitting it skips the cap,
  so a client redeeming against a basket should always send it.
  """
  def redeem(conn, %{"customer_id" => customer_id, "points" => points} = params) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id),
         {:ok, count} <- to_points(points),
         {:ok, result} <- Loyalty.redeem(scope, customer, count, redeem_opts(params)) do
      render(conn, :redemption, result: result)
    end
  end

  def adjust(conn, %{"customer_id" => customer_id, "points" => points} = params) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id),
         {:ok, count} <- to_points(points),
         {:ok, entry} <- Loyalty.adjust(scope, customer, count, params["reason"]) do
      conn |> put_status(:created) |> render(:transaction, transaction: entry)
    end
  end

  @doc "Sweeps points that have passed their date. Normally a nightly job."
  def expire(conn, _params) do
    {:ok, count} = Loyalty.expire_due(conn.assigns.scope)
    json(conn, %{data: %{accounts_expired: count}})
  end

  defp redeem_opts(params) do
    %{
      bill_total: parse_money(params["bill_total"]),
      reference_type: params["reference_type"],
      reference_id: params["reference_id"],
      note: params["note"]
    }
  end

  defp to_points(value) when is_integer(value), do: {:ok, value}

  defp to_points(value) when is_binary(value) do
    case Integer.parse(value) do
      {points, ""} -> {:ok, points}
      _other -> {:error, :invalid_points}
    end
  end

  defp to_points(_value), do: {:error, :invalid_points}

  defp parse_money(nil), do: nil

  defp parse_money(value) do
    case Kaarobar.Money.cast(value) do
      {:ok, amount} -> amount
      :error -> nil
    end
  end
end
