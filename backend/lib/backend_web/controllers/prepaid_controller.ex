defmodule KaarobarWeb.PrepaidController do
  @moduledoc """
  Gift cards and store credit.

  ## The code goes out exactly once

  `issue_gift_card` is the only response that carries a card's code. It is
  hashed on the way in and never stored in the clear, so a client that does not
  capture it there cannot ask for it again — and neither can anyone who later
  reads the database.

  Lookup is therefore by full code only. There is no partial search, and there
  cannot be one.
  """

  use KaarobarWeb, :controller

  alias Kaarobar.Customers
  alias Kaarobar.Prepaid

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "gift_card:view"] when action in [:show_gift_card, :gift_card_history]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "gift_card:issue"]
       when action in [:issue_gift_card, :activate_gift_card, :top_up_gift_card]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "gift_card:redeem"] when action in [:redeem_gift_card]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "store_credit:issue"] when action in [:issue_store_credit]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "store_credit:redeem"] when action in [:redeem_store_credit]

  plug KaarobarWeb.Plugs.Authorize,
       [permission: "credit:view"] when action in [:list_store_credit, :store_credit_history]

  # --- Gift cards -------------------------------------------------------------

  def issue_gift_card(conn, params) do
    attrs = %{
      amount: params["amount"],
      customer_id: params["customer_id"],
      recipient_name: params["recipient_name"],
      message: params["message"],
      issued_by_sale_id: params["sale_id"],
      expires_on: parse_date(params["expires_on"])
    }

    with {:ok, card} <- Prepaid.issue_gift_card(conn.assigns.scope, attrs) do
      # The one response that carries the plaintext code.
      conn |> put_status(:created) |> render(:issued_gift_card, card: card)
    end
  end

  def show_gift_card(conn, %{"code" => code}) do
    with {:ok, card} <- Prepaid.find_gift_card(conn.assigns.scope, code) do
      render(conn, :gift_card, card: card)
    end
  end

  def activate_gift_card(conn, %{"code" => code}) do
    scope = conn.assigns.scope

    with {:ok, card} <- Prepaid.find_gift_card(scope, code),
         {:ok, activated} <- Prepaid.activate_gift_card(scope, card) do
      render(conn, :gift_card, card: activated)
    end
  end

  def redeem_gift_card(conn, %{"code" => code} = params) do
    scope = conn.assigns.scope

    with {:ok, card} <- Prepaid.find_gift_card(scope, code),
         {:ok, entry} <- Prepaid.redeem_gift_card(scope, card, params["amount"], movement(params)) do
      conn |> put_status(:created) |> render(:gift_card_transaction, transaction: entry)
    end
  end

  def top_up_gift_card(conn, %{"code" => code} = params) do
    scope = conn.assigns.scope

    with {:ok, card} <- Prepaid.find_gift_card(scope, code),
         {:ok, entry} <- Prepaid.top_up_gift_card(scope, card, params["amount"], movement(params)) do
      conn |> put_status(:created) |> render(:gift_card_transaction, transaction: entry)
    end
  end

  def gift_card_history(conn, %{"code" => code}) do
    scope = conn.assigns.scope

    with {:ok, card} <- Prepaid.find_gift_card(scope, code) do
      render(conn, :gift_card_history,
        card: card,
        transactions: Prepaid.gift_card_history(scope, card)
      )
    end
  end

  # --- Store credit -----------------------------------------------------------

  def issue_store_credit(conn, %{"customer_id" => customer_id} = params) do
    scope = conn.assigns.scope

    attrs = %{
      amount: params["amount"],
      reason: params["reason"],
      reference_type: params["reference_type"],
      reference_id: params["reference_id"],
      expires_on: parse_date(params["expires_on"])
    }

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id),
         {:ok, credit} <- Prepaid.issue_store_credit(scope, customer, attrs) do
      conn |> put_status(:created) |> render(:store_credit, credit: credit)
    end
  end

  def list_store_credit(conn, %{"customer_id" => customer_id}) do
    scope = conn.assigns.scope

    with {:ok, customer} <- Customers.fetch_customer(scope, customer_id) do
      render(conn, :store_credits,
        credits: Prepaid.spendable_store_credit(scope, customer),
        balance: Prepaid.store_credit_balance(scope, customer)
      )
    end
  end

  def redeem_store_credit(conn, %{"id" => id} = params) do
    scope = conn.assigns.scope

    with {:ok, credit} <- Prepaid.fetch_store_credit(scope, id),
         {:ok, entry} <-
           Prepaid.redeem_store_credit(scope, credit, params["amount"], movement(params)) do
      conn |> put_status(:created) |> render(:store_credit_transaction, transaction: entry)
    end
  end

  def store_credit_history(conn, %{"id" => id}) do
    scope = conn.assigns.scope

    with {:ok, credit} <- Prepaid.fetch_store_credit(scope, id) do
      render(conn, :store_credit_history,
        credit: credit,
        transactions: Prepaid.store_credit_history(scope, credit)
      )
    end
  end

  defp movement(params) do
    %{
      reference_type: params["reference_type"],
      reference_id: params["reference_id"],
      note: params["note"]
    }
  end

  defp parse_date(nil), do: nil

  defp parse_date(value) when is_binary(value) do
    case Date.from_iso8601(value) do
      {:ok, date} -> date
      {:error, _reason} -> nil
    end
  end

  defp parse_date(_value), do: nil
end
