defmodule KaarobarWeb.PrepaidJSON do
  @moduledoc false

  alias KaarobarWeb.CrmSerializers
  alias KaarobarWeb.JSONHelpers

  @doc """
  The only response carrying a gift card's plaintext code.

  Rendered once, on issue. Every other view masks it.
  """
  def issued_gift_card(%{card: card}), do: %{data: CrmSerializers.issued_gift_card(card)}

  def gift_card(%{card: card}), do: %{data: CrmSerializers.gift_card(card)}

  def gift_card_transaction(%{transaction: transaction}),
    do: %{data: CrmSerializers.gift_card_transaction(transaction)}

  def gift_card_history(%{card: card, transactions: transactions}) do
    %{
      data: %{
        card: CrmSerializers.gift_card(card),
        transactions: Enum.map(transactions, &CrmSerializers.gift_card_transaction/1)
      }
    }
  end

  def store_credit(%{credit: credit}), do: %{data: CrmSerializers.store_credit(credit)}

  def store_credits(%{credits: credits, balance: balance}) do
    %{
      data: Enum.map(credits, &CrmSerializers.store_credit/1),
      meta: %{balance: JSONHelpers.money(balance)}
    }
  end

  def store_credit_transaction(%{transaction: transaction}),
    do: %{data: CrmSerializers.store_credit_transaction(transaction)}

  def store_credit_history(%{credit: credit, transactions: transactions}) do
    %{
      data: %{
        credit: CrmSerializers.store_credit(credit),
        transactions: Enum.map(transactions, &CrmSerializers.store_credit_transaction/1)
      }
    }
  end
end
