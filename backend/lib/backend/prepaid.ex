defmodule Kaarobar.Prepaid do
  @moduledoc """
  Value a customer holds before they spend it: store credit and gift cards.

  Both are money the shop already has and owes back, so both are handled the
  same way — a balance, an append-only movement log, and a redemption that
  locks the row before it reads the balance. Two tills spending the same gift
  card at the same moment is not a hypothetical; it is what happens when a card
  is shared between family members at a busy counter.

  ## Why gift card codes are hashed

  The code *is* the money. Anyone holding it can spend it, so storing it in
  plain text puts a spendable balance in every database dump, backup and log
  line. Only the SHA-256 of the normalised code is kept, with the last four
  characters alongside so staff can find the card a customer is holding.

  Lookup is therefore exact-match only — there is no "search gift cards by
  partial code", and there cannot be. That is the cost, and it is worth paying.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Money
  alias Kaarobar.Prepaid.GiftCard
  alias Kaarobar.Prepaid.GiftCardTransaction
  alias Kaarobar.Prepaid.StoreCredit
  alias Kaarobar.Prepaid.StoreCreditTransaction
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Sequences

  # Unambiguous when read aloud or written down: no O/0, I/1, S/5, B/8. A code
  # dictated over a counter and mistyped is a support call.
  @code_alphabet ~c"ACDEFGHJKLMNPQRTUVWXY34679"
  @code_length 16

  # ===========================================================================
  # Store credit
  # ===========================================================================

  @doc """
  Issues store credit to a customer.

  Usually from a return where the customer did not want cash back, or the
  original tender could not be refunded to. Runs in one transaction with its
  opening ledger entry: credit with no movement behind it is a balance nobody
  can explain.
  """
  @spec issue_store_credit(Scope.t(), Customer.t(), map()) ::
          {:ok, StoreCredit.t()} | {:error, term()}
  def issue_store_credit(%Scope{} = scope, %Customer{} = customer, attrs) do
    amount = attrs |> Map.get(:amount) |> Money.to_decimal()

    Repo.transaction(fn ->
      with :ok <- validate_positive(amount),
           {:ok, number} <- Sequences.next(scope, "store_credit"),
           {:ok, credit} <- insert_store_credit(scope, customer, attrs, amount, number),
           {:ok, _entry} <-
             post_store_credit(scope, credit, %{
               kind: "issue",
               amount: amount,
               reference_type: Map.get(attrs, :reference_type),
               reference_id: Map.get(attrs, :reference_id),
               note: Map.get(attrs, :reason)
             }) do
        Audit.log(scope, "store_credit.issued", credit,
          entity_type: "store_credit",
          label: credit.number,
          summary: "#{customer.name} issued #{Decimal.to_string(amount, :normal)}"
        )

        credit
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "A customer's store credit that can still be spent, oldest first."
  @spec spendable_store_credit(Scope.t(), Customer.t()) :: [StoreCredit.t()]
  def spendable_store_credit(%Scope{} = scope, %Customer{} = customer) do
    today = Date.utc_today()

    StoreCredit
    |> Scoped.for_business(scope)
    |> where([credit], credit.customer_id == ^customer.id)
    |> where([credit], credit.balance > 0 and is_nil(credit.voided_at))
    |> order_by([credit], asc: credit.issued_at)
    |> Repo.all()
    |> Enum.filter(&StoreCredit.spendable?(&1, today))
  end

  @doc "The total a customer holds in store credit."
  @spec store_credit_balance(Scope.t(), Customer.t()) :: Decimal.t()
  def store_credit_balance(%Scope{} = scope, %Customer{} = customer) do
    scope |> spendable_store_credit(customer) |> Enum.map(& &1.balance) |> Money.sum()
  end

  @doc """
  Spends store credit.

  Locks the row before reading the balance, so the same credit cannot be spent
  twice at two tills.
  """
  @spec redeem_store_credit(Scope.t(), StoreCredit.t(), Decimal.t(), map()) ::
          {:ok, StoreCreditTransaction.t()} | {:error, term()}
  def redeem_store_credit(%Scope{} = scope, %StoreCredit{} = credit, amount, attrs \\ %{}) do
    amount = Money.to_decimal(amount)

    Repo.transaction(fn ->
      with :ok <- validate_positive(amount),
           {:ok, locked} <- lock_store_credit(credit.id),
           :ok <- ensure_store_credit_spendable(locked, amount),
           {:ok, entry} <-
             post_store_credit(
               scope,
               locked,
               Map.merge(attrs, %{kind: "redeem", amount: Decimal.negate(amount)})
             ) do
        entry
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Movements against one store credit, oldest first."
  @spec store_credit_history(Scope.t(), StoreCredit.t()) :: [StoreCreditTransaction.t()]
  def store_credit_history(%Scope{} = scope, %StoreCredit{} = credit) do
    StoreCreditTransaction
    |> Scoped.for_business(scope)
    |> where([entry], entry.store_credit_id == ^credit.id)
    |> order_by([entry], asc: entry.occurred_at, asc: entry.id)
    |> Repo.all()
  end

  # ===========================================================================
  # Gift cards
  # ===========================================================================

  @doc """
  Issues a gift card, returning it with its code set once.

  The code is on the returned struct's virtual `:code` field and nowhere else —
  print it or show it now, because it cannot be recovered afterwards.

  Cards start inactive. `activate/2` brings one to life once the sale that
  sold it has been paid for, so a voided sale does not leave live money in
  someone's pocket.
  """
  @spec issue_gift_card(Scope.t(), map()) :: {:ok, GiftCard.t()} | {:error, term()}
  def issue_gift_card(%Scope{} = scope, attrs) do
    amount = attrs |> Map.get(:amount) |> Money.to_decimal()
    code = Map.get(attrs, :code) || generate_code()

    Repo.transaction(fn ->
      with :ok <- validate_positive(amount),
           {:ok, card} <- insert_gift_card(scope, attrs, amount, code),
           {:ok, _entry} <-
             post_gift_card(scope, card, %{
               kind: "issue",
               amount: amount,
               reference_type: "sale",
               reference_id: Map.get(attrs, :issued_by_sale_id)
             }) do
        Audit.log(scope, "gift_card.issued", card,
          entity_type: "gift_card",
          label: GiftCard.masked(card),
          summary: "Issued #{Decimal.to_string(amount, :normal)}"
        )

        # The only moment the code exists outside the caller's hand.
        %{card | code: code}
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Finds a card by the code a customer handed over.

  Exact match on the hash. Formatting and case are normalised first, so
  `acdf-3479` and `ACDF3479` find the same card.
  """
  @spec find_gift_card(Scope.t(), String.t()) :: {:ok, GiftCard.t()} | {:error, :not_found}
  def find_gift_card(%Scope{} = scope, code) when is_binary(code) do
    hash = GiftCard.hash_code(code)

    GiftCard
    |> Scoped.for_business(scope)
    |> where([card], card.code_hash == ^hash)
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      card -> {:ok, card}
    end
  end

  @doc "Brings a card to life once it has been paid for."
  @spec activate_gift_card(Scope.t(), GiftCard.t()) ::
          {:ok, GiftCard.t()} | {:error, Ecto.Changeset.t()}
  def activate_gift_card(%Scope{} = scope, %GiftCard{} = card) do
    with {:ok, activated} <- card |> GiftCard.activate_changeset() |> Repo.update() do
      Audit.log(scope, "gift_card.activated", activated,
        entity_type: "gift_card",
        label: GiftCard.masked(activated)
      )

      {:ok, activated}
    end
  end

  @doc """
  Spends a gift card.

  Locks the row first: a card shared between two people, presented at two tills
  in the same second, must not spend the same balance twice.
  """
  @spec redeem_gift_card(Scope.t(), GiftCard.t(), Decimal.t(), map()) ::
          {:ok, GiftCardTransaction.t()} | {:error, term()}
  def redeem_gift_card(%Scope{} = scope, %GiftCard{} = card, amount, attrs \\ %{}) do
    amount = Money.to_decimal(amount)

    Repo.transaction(fn ->
      with :ok <- validate_positive(amount),
           {:ok, locked} <- lock_gift_card(card.id),
           :ok <- ensure_gift_card_spendable(locked, amount),
           {:ok, entry} <-
             post_gift_card(
               scope,
               locked,
               Map.merge(attrs, %{kind: "redeem", amount: Decimal.negate(amount)})
             ) do
        entry
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Adds value to an existing card."
  @spec top_up_gift_card(Scope.t(), GiftCard.t(), Decimal.t(), map()) ::
          {:ok, GiftCardTransaction.t()} | {:error, term()}
  def top_up_gift_card(%Scope{} = scope, %GiftCard{} = card, amount, attrs \\ %{}) do
    amount = Money.to_decimal(amount)

    Repo.transaction(fn ->
      with :ok <- validate_positive(amount),
           {:ok, locked} <- lock_gift_card(card.id),
           {:ok, entry} <-
             post_gift_card(scope, locked, Map.merge(attrs, %{kind: "topup", amount: amount})) do
        entry
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Movements against one card, oldest first."
  @spec gift_card_history(Scope.t(), GiftCard.t()) :: [GiftCardTransaction.t()]
  def gift_card_history(%Scope{} = scope, %GiftCard{} = card) do
    GiftCardTransaction
    |> Scoped.for_business(scope)
    |> where([entry], entry.gift_card_id == ^card.id)
    |> order_by([entry], asc: entry.occurred_at, asc: entry.id)
    |> Repo.all()
  end

  @doc """
  A fresh card code.

  Sixteen characters from an alphabet with no O/0, I/1, S/5 or B/8 — a code is
  read aloud across a counter as often as it is scanned, and the pairs people
  confuse are the ones worth leaving out.
  """
  @spec generate_code() :: String.t()
  def generate_code do
    1..@code_length
    |> Enum.map(fn _index -> Enum.random(@code_alphabet) end)
    |> List.to_string()
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp validate_positive(nil), do: {:error, :amount_required}

  defp validate_positive(amount) do
    if Money.positive?(amount), do: :ok, else: {:error, :amount_must_be_positive}
  end

  defp insert_store_credit(%Scope{} = scope, %Customer{} = customer, attrs, amount, number) do
    %StoreCredit{}
    |> StoreCredit.changeset(%{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      customer_id: customer.id,
      number: number,
      currency: scope.business && scope.business.currency,
      issued_amount: amount,
      balance: Money.zero(),
      reason: Map.get(attrs, :reason),
      reference_type: Map.get(attrs, :reference_type),
      reference_id: Map.get(attrs, :reference_id),
      issued_by_id: Scope.user_id(scope),
      issued_at: DateTime.utc_now(),
      expires_on: Map.get(attrs, :expires_on)
    })
    |> Repo.insert()
  end

  # Built with a zero balance on purpose: the `issue` entry is what moves it to
  # the face value, so the log adds up from nothing to the amount rather than
  # starting halfway and doubling.
  defp insert_gift_card(%Scope{} = scope, attrs, amount, code) do
    %GiftCard{balance: Money.zero()}
    |> GiftCard.changeset(%{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      customer_id: Map.get(attrs, :customer_id),
      code: code,
      currency: scope.business && scope.business.currency,
      issued_amount: amount,
      recipient_name: Map.get(attrs, :recipient_name),
      message: Map.get(attrs, :message),
      issued_by_sale_id: Map.get(attrs, :issued_by_sale_id),
      issued_by_id: Scope.user_id(scope),
      issued_at: DateTime.utc_now(),
      expires_on: Map.get(attrs, :expires_on)
    })
    |> Repo.insert()
  end

  defp lock_store_credit(id) do
    StoreCredit
    |> where([credit], credit.id == ^id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      credit -> {:ok, credit}
    end
  end

  defp lock_gift_card(id) do
    GiftCard
    |> where([card], card.id == ^id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      card -> {:ok, card}
    end
  end

  defp ensure_store_credit_spendable(%StoreCredit{} = credit, amount) do
    today = Date.utc_today()

    cond do
      not is_nil(credit.voided_at) -> {:error, :store_credit_voided}
      StoreCredit.expired?(credit, today) -> {:error, :store_credit_expired}
      Decimal.compare(amount, credit.balance) == :gt -> {:error, :insufficient_balance}
      true -> :ok
    end
  end

  defp ensure_gift_card_spendable(%GiftCard{} = card, amount) do
    today = Date.utc_today()

    cond do
      card.status == "voided" -> {:error, :gift_card_voided}
      card.status == "inactive" -> {:error, :gift_card_inactive}
      GiftCard.expired?(card, today) -> {:error, :gift_card_expired}
      Decimal.compare(amount, card.balance) == :gt -> {:error, :insufficient_balance}
      true -> :ok
    end
  end

  defp post_store_credit(%Scope{} = scope, %StoreCredit{} = credit, attrs) do
    amount = attrs |> Map.fetch!(:amount) |> Money.to_decimal()
    balance_after = Money.add(credit.balance, amount)

    entry_attrs =
      Map.merge(attrs, %{
        business_id: Scope.business_id(scope),
        store_credit_id: credit.id,
        amount: amount,
        balance_after: balance_after,
        occurred_at: Map.get(attrs, :occurred_at) || DateTime.utc_now(),
        actor_user_id: Scope.user_id(scope)
      })

    with {:ok, entry} <-
           %StoreCreditTransaction{} |> StoreCreditTransaction.changeset(entry_attrs) |> Repo.insert(),
         {:ok, _credit} <-
           credit |> StoreCredit.balance_changeset(balance_after) |> Repo.update() do
      {:ok, entry}
    end
  end

  defp post_gift_card(%Scope{} = scope, %GiftCard{} = card, attrs) do
    amount = attrs |> Map.fetch!(:amount) |> Money.to_decimal()
    balance_after = Money.add(card.balance, amount)

    entry_attrs =
      Map.merge(attrs, %{
        business_id: Scope.business_id(scope),
        gift_card_id: card.id,
        branch_id: Map.get(attrs, :branch_id) || Scope.branch_id(scope),
        amount: amount,
        balance_after: balance_after,
        occurred_at: Map.get(attrs, :occurred_at) || DateTime.utc_now(),
        actor_user_id: Scope.user_id(scope)
      })

    with {:ok, entry} <-
           %GiftCardTransaction{} |> GiftCardTransaction.changeset(entry_attrs) |> Repo.insert(),
         {:ok, _card} <- card |> GiftCard.balance_changeset(balance_after) |> Repo.update() do
      {:ok, entry}
    end
  end
end
