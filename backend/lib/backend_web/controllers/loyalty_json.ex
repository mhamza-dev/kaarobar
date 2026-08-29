defmodule KaarobarWeb.LoyaltyJSON do
  @moduledoc false

  alias KaarobarWeb.CrmSerializers
  alias KaarobarWeb.JSONHelpers

  def program(%{program: program}), do: %{data: CrmSerializers.program(program)}

  def account(%{account: account}), do: %{data: CrmSerializers.loyalty_account(account)}

  def transactions(%{account: account, transactions: transactions}) do
    %{
      data: %{
        account: CrmSerializers.loyalty_account(account),
        transactions: Enum.map(transactions, &CrmSerializers.loyalty_transaction/1)
      }
    }
  end

  def transaction(%{transaction: transaction}),
    do: %{data: CrmSerializers.loyalty_transaction(transaction)}

  @doc "A redemption reports what the points were worth, which is what the till needs."
  def redemption(%{result: result}) do
    %{
      data: %{
        transaction: CrmSerializers.loyalty_transaction(result.transaction),
        value: JSONHelpers.money(result.value)
      }
    }
  end
end
