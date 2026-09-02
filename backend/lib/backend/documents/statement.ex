defmodule Kaarobar.Documents.Statement do
  @moduledoc """
  A customer's account, as the sheet of paper a shop hands them.

  ## Why this is a document and not a screen

  Credit customers in this market settle in person, standing at the counter,
  arguing about one line from two months ago. What resolves that is a printed
  statement they can take away — and the running balance beside each entry is
  the whole point, because "you owe 41,300" is a claim and a column of
  movements adding up to 41,300 is an answer.

  Built on the same shape as `Kaarobar.Documents.Receipt`: one model, rendered
  as HTML. There is no ESC/POS rendering — a statement is a page of history,
  and nobody wants two feet of till roll.
  """

  alias Kaarobar.Documents.Labels
  alias Kaarobar.Money

  @enforce_keys [:customer_name, :entries, :balance, :language]
  defstruct [
    :customer_name,
    :customer_phone,
    :entries,
    :balance,
    :outstanding,
    :credit_limit,
    :available_credit,
    :language,
    :direction,
    :labels,
    :business_name,
    :branch_name,
    :branch_phone,
    :from,
    :to,
    :printed_at,
    open_invoices: []
  ]

  @type t :: %__MODULE__{}

  @doc """
  Builds the statement from what `Kaarobar.Credit.statement/3` returned.

  Takes the already-assembled figures rather than querying again: the balance
  on the paper has to be the balance the caller just showed on screen, and two
  reads a second apart can disagree while a shop is trading.
  """
  @spec build(map(), keyword()) :: t()
  def build(%{customer: customer} = statement, opts \\ []) do
    business = Keyword.get(opts, :business)
    language = Labels.normalize(Keyword.get(opts, :language) || document_language(business))

    %__MODULE__{
      customer_name: customer.name,
      customer_phone: customer.phone,
      entries: running(statement.entries),
      balance: statement.balance,
      outstanding: statement.outstanding,
      credit_limit: statement.credit_limit,
      available_credit: statement.available_credit,
      open_invoices: statement.open_invoices,
      language: language,
      direction: Labels.direction(language),
      labels: Labels.sale(language),
      business_name: business && business.name,
      branch_name: Keyword.get(opts, :branch_name),
      branch_phone: Keyword.get(opts, :branch_phone),
      from: Keyword.get(opts, :from),
      to: Keyword.get(opts, :to),
      printed_at: DateTime.utc_now()
    }
  end

  @doc "Whether the account is in credit rather than in debt."
  @spec in_credit?(t()) :: boolean()
  def in_credit?(%__MODULE__{balance: balance}), do: Money.negative?(balance)

  # The snapshotted balance from each entry, in the order they happened. Taken
  # from the ledger rather than recomputed: `balance_after` is what the shop
  # committed to at the time, and a statement that recalculates it would
  # silently disagree with every receipt already in the customer's hands.
  defp running(entries) do
    Enum.map(entries, fn entry ->
      %{
        occurred_at: entry.occurred_at,
        kind: entry.kind,
        note: entry.note,
        amount: entry.amount,
        balance_after: entry.balance_after,
        # A ledger holds signed amounts; a statement has two columns.
        debit: if(Money.positive?(entry.amount), do: entry.amount),
        credit: if(Money.negative?(entry.amount), do: Decimal.abs(entry.amount))
      }
    end)
  end

  defp document_language(nil), do: :en

  defp document_language(business) do
    case business.receipt_settings do
      %{} = settings -> Map.get(settings, "language") || business.default_locale || :en
      _absent -> business.default_locale || :en
    end
  end
end
