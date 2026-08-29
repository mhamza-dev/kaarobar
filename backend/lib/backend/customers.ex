defmodule Kaarobar.Customers do
  @moduledoc """
  Who the shop sells to, and what they owe.

  The minimum a till needs. The full CRM — groups, loyalty, gift cards, store
  credit, addresses, follow-ups — arrives with its own phase; what is here is
  the part checkout cannot work without, because a shop that sells on account
  has to know who owes what before it can let anyone leave without paying.

  ## The ledger is the truth; the balance is a projection

  `customers.balance` is maintained in the same transaction as the entries that
  move it, under a row lock, exactly as `stock_items.on_hand` mirrors the stock
  ledger and `suppliers.balance` mirrors the purchase one. Three ledgers, one
  pattern — so that when a statement does not add up, it shows the row where it
  stopped adding up rather than only the wrong total.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Customers.CustomerLedgerEntry
  alias Kaarobar.Customers.CustomerPayment
  alias Kaarobar.Money
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Sequences

  # ===========================================================================
  # Customers
  # ===========================================================================

  @doc """
  Builds the customer query, filtered.

  ## Filters

    * `"q"` — matches name, phone, code or email. What a cashier types.
    * `"credit_allowed"` — only those who may buy on account.
    * `"owing"` — only those with an outstanding balance.
  """
  @spec query(Scope.t(), map()) :: Ecto.Query.t()
  def query(%Scope{} = scope, filters \\ %{}) do
    Customer
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> apply_filters(filters)
  end

  @doc "Lists customers, most recently added first."
  @spec list_customers(Scope.t(), map()) :: [Customer.t()]
  def list_customers(%Scope{} = scope, filters \\ %{}) do
    scope
    |> query(filters)
    |> order_by([customer], desc: customer.id)
    |> Repo.all()
  end

  @doc "Fetches one customer."
  @spec fetch_customer(Scope.t(), Ecto.UUID.t()) :: {:ok, Customer.t()} | {:error, :not_found}
  def fetch_customer(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Customer
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([customer], customer.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        customer -> {:ok, customer}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Finds a customer by the phone number a cashier typed.

  Phone is how a shop actually identifies a returning customer — not an email,
  and never a UUID.
  """
  @spec find_by_phone(Scope.t(), String.t()) :: Customer.t() | nil
  def find_by_phone(%Scope{} = scope, phone) when is_binary(phone) do
    trimmed = String.trim(phone)

    if trimmed == "" do
      nil
    else
      Customer
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([customer], customer.phone == ^trimmed)
      |> Repo.one()
    end
  end

  @doc """
  Creates a customer.

  An opening balance may be given for a customer who already owed money when
  the shop started using the system; it posts as an `opening` ledger entry so
  the statement begins where reality did.
  """
  @spec create_customer(Scope.t(), map()) :: {:ok, Customer.t()} | {:error, term()}
  def create_customer(%Scope{} = scope, attrs) do
    opening = attrs |> fetch_attr(:opening_balance) |> to_amount()

    Repo.transaction(fn ->
      changeset =
        %Customer{
          organization_id: Scope.organization_id(scope),
          business_id: Scope.business_id(scope)
        }
        |> Customer.changeset(attrs)

      with {:ok, customer} <- Repo.insert(changeset),
           {:ok, customer} <- post_opening_balance(scope, customer, opening) do
        Audit.log(scope, "customer.created", customer,
          entity_type: "customer",
          label: customer.name
        )

        customer
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Updates a customer's details. The balance is not among them."
  @spec update_customer(Scope.t(), Customer.t(), map()) ::
          {:ok, Customer.t()} | {:error, Ecto.Changeset.t()}
  def update_customer(%Scope{} = scope, %Customer{} = customer, attrs) do
    with {:ok, updated} <- customer |> Customer.changeset(attrs) |> Repo.update() do
      Audit.log(scope, "customer.updated", updated,
        entity_type: "customer",
        label: updated.name,
        changes: %{before: customer, after: updated}
      )

      {:ok, updated}
    end
  end

  @doc """
  Soft-deletes a customer.

  Refused while they still owe money: a debt whose owner has been deleted is a
  debt nobody will collect.
  """
  @spec delete_customer(Scope.t(), Customer.t()) ::
          {:ok, Customer.t()} | {:error, :balance_outstanding | Ecto.Changeset.t()}
  def delete_customer(%Scope{} = scope, %Customer{} = customer) do
    if Money.zero?(customer.balance) do
      with {:ok, deleted} <- customer |> Customer.soft_delete_changeset() |> Repo.update() do
        Audit.log(scope, "customer.deleted", deleted,
          entity_type: "customer",
          label: deleted.name
        )

        {:ok, deleted}
      end
    else
      {:error, :balance_outstanding}
    end
  end

  # ===========================================================================
  # The ledger
  # ===========================================================================

  @doc """
  Writes a ledger entry and moves the customer's balance with it.

  The customer row is locked first, for the same reason a stock item is: the
  entry's `balance_after` has to follow from a value nobody else can change in
  between. Call inside the caller's transaction — a sale posts its debt in the
  same transaction that decrements the stock.

  `amount` is signed: positive increases what is owed.
  """
  @spec record_ledger_entry(Scope.t(), Ecto.UUID.t(), map()) ::
          {:ok, CustomerLedgerEntry.t()} | {:error, term()}
  def record_ledger_entry(%Scope{} = scope, customer_id, attrs) do
    case lock_customer(customer_id) do
      nil ->
        {:error, :not_found}

      %Customer{} = customer ->
        write_entry(scope, customer, attrs)
    end
  end

  @doc """
  Puts a sale on a customer's account, refusing to breach their limit.

  The limit is checked against the *locked* balance rather than one read a
  moment earlier. Two tills selling to the same customer at once would
  otherwise both see room under the limit and both be right, and the shop would
  find out at the end of the month.

  Call inside the checkout transaction: the debt and the stock decrement have
  to land together, or a rollback leaves goods gone and nobody owing for them.
  """
  @spec charge_credit(Scope.t(), Ecto.UUID.t(), Decimal.t(), map()) ::
          {:ok, CustomerLedgerEntry.t()}
          | {:error,
             :not_found
             | :credit_not_allowed
             | {:credit_limit_exceeded, Decimal.t()}
             | Ecto.Changeset.t()}
  def charge_credit(%Scope{} = scope, customer_id, amount, attrs \\ %{}) do
    case lock_customer(customer_id) do
      nil ->
        {:error, :not_found}

      %Customer{} = customer ->
        with :ok <- Customer.credit_check(customer, amount) do
          write_entry(
            scope,
            customer,
            Map.merge(attrs, %{kind: Map.get(attrs, :kind, "sale"), amount: amount})
          )
        end
    end
  end

  @doc "One customer's statement, oldest first."
  @spec list_ledger_entries(Scope.t(), Customer.t(), map()) :: [CustomerLedgerEntry.t()]
  def list_ledger_entries(%Scope{} = scope, %Customer{} = customer, filters \\ %{}) do
    CustomerLedgerEntry
    |> Scoped.for_business(scope)
    |> where([entry], entry.customer_id == ^customer.id)
    |> filter_ledger_dates(filters)
    |> order_by([entry], asc: entry.occurred_at, asc: entry.id)
    |> Repo.all()
  end

  @doc """
  Checks whether a customer may take on more debt, by id.

  Returns the loaded customer so checkout does not have to fetch it twice.
  """
  @spec check_credit(Scope.t(), Ecto.UUID.t(), Decimal.t()) ::
          {:ok, Customer.t()}
          | {:error, :not_found | :credit_not_allowed | {:credit_limit_exceeded, Decimal.t()}}
  def check_credit(%Scope{} = scope, customer_id, amount) do
    with {:ok, customer} <- fetch_customer(scope, customer_id),
         :ok <- Customer.credit_check(customer, amount) do
      {:ok, customer}
    end
  end

  # ===========================================================================
  # Payments against the account
  # ===========================================================================

  @doc """
  Records a customer settling part or all of what they owe.

  Distinct from paying for one sale: this is money against the account, which
  is how most credit is actually collected — a wholesale customer clearing six
  weeks of invoices in one go.

  Pass `shift_id` when the money was taken at a till, so it lands in that
  drawer's count.
  """
  @spec record_payment(Scope.t(), Customer.t(), map()) ::
          {:ok, CustomerPayment.t()} | {:error, term()}
  def record_payment(%Scope{} = scope, %Customer{} = customer, attrs) do
    Repo.transaction(fn ->
      amount = attrs |> fetch_attr(:amount) |> to_amount()

      with :ok <- validate_payment_amount(amount),
           {:ok, number} <- Sequences.next(scope, "customer_payment"),
           {:ok, payment} <- insert_payment(scope, customer, attrs, amount, number),
           {:ok, _entry} <- post_payment_entry(scope, customer, payment) do
        Audit.log(scope, "customer_payment.recorded", payment,
          entity_type: "customer_payment",
          label: payment.number,
          summary: "#{customer.name} paid #{Decimal.to_string(amount, :normal)}"
        )

        payment
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Payments a customer has made, most recent first."
  @spec list_payments(Scope.t(), Customer.t()) :: [CustomerPayment.t()]
  def list_payments(%Scope{} = scope, %Customer{} = customer) do
    CustomerPayment
    |> Scoped.for_business(scope)
    |> where([payment], payment.customer_id == ^customer.id)
    |> order_by([payment], desc: payment.paid_on, desc: payment.id)
    |> Repo.all()
  end

  @doc """
  What is owed, and for how long.

  Buckets are counted from each entry's own date rather than from a statement
  run, because the question a shopkeeper is asking is "how long has this
  particular money been outstanding", not "how old is my report".
  """
  @spec receivables_ageing(Scope.t()) :: map()
  def receivables_ageing(%Scope{} = scope) do
    today = Date.utc_today()

    entries =
      CustomerLedgerEntry
      |> Scoped.for_business(scope)
      |> where([entry], entry.kind in ["sale", "opening"])
      |> preload(:customer)
      |> Repo.all()

    buckets =
      Enum.reduce(entries, empty_ageing(), fn entry, acc ->
        bucket = bucket_for(Date.diff(today, DateTime.to_date(entry.occurred_at)))
        Map.update!(acc, bucket, &Money.add(&1, entry.amount))
      end)

    Map.put(buckets, :total, buckets |> Map.values() |> Money.sum())
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  # Both entry points arrive here with the customer row already locked, so
  # `balance_after` follows from a value nobody else can change in between.
  defp write_entry(%Scope{} = scope, %Customer{} = customer, attrs) do
    amount = attrs |> Map.fetch!(:amount) |> Money.to_decimal()
    balance_after = Money.add(customer.balance, amount)

    entry_attrs =
      Map.merge(attrs, %{
        organization_id: Scope.organization_id(scope),
        business_id: Scope.business_id(scope),
        branch_id: Map.get(attrs, :branch_id) || Scope.branch_id(scope),
        customer_id: customer.id,
        amount: amount,
        balance_after: balance_after,
        occurred_at: Map.get(attrs, :occurred_at) || DateTime.utc_now(),
        actor_user_id: Scope.user_id(scope),
        actor_label: scope.user && scope.user.name
      })

    with {:ok, entry} <-
           %CustomerLedgerEntry{} |> CustomerLedgerEntry.changeset(entry_attrs) |> Repo.insert(),
         {:ok, _customer} <-
           customer |> Customer.balance_changeset(balance_after) |> Repo.update() do
      {:ok, entry}
    end
  end

  defp lock_customer(customer_id) do
    Customer
    |> where([customer], customer.id == ^customer_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp post_opening_balance(_scope, customer, nil), do: {:ok, customer}

  defp post_opening_balance(%Scope{} = scope, %Customer{} = customer, amount) do
    if Money.zero?(amount) do
      {:ok, customer}
    else
      with {:ok, _entry} <-
             record_ledger_entry(scope, customer.id, %{
               kind: "opening",
               amount: amount,
               reference_type: "customer",
               reference_id: customer.id,
               note: "Opening balance"
             }) do
        {:ok, %{customer | balance: Money.round(amount)}}
      end
    end
  end

  defp validate_payment_amount(nil), do: {:error, :amount_required}

  defp validate_payment_amount(amount) do
    if Money.positive?(amount), do: :ok, else: {:error, :amount_must_be_positive}
  end

  defp insert_payment(%Scope{} = scope, %Customer{} = customer, attrs, amount, number) do
    payment_attrs = %{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope),
      branch_id: Scope.branch_id(scope),
      customer_id: customer.id,
      number: number,
      method: fetch_attr(attrs, :method) || "cash",
      amount: amount,
      paid_on: fetch_attr(attrs, :paid_on),
      reference: fetch_attr(attrs, :reference),
      notes: fetch_attr(attrs, :notes),
      created_by_id: Scope.user_id(scope),
      shift_id: fetch_attr(attrs, :shift_id)
    }

    %CustomerPayment{} |> CustomerPayment.changeset(payment_attrs) |> Repo.insert()
  end

  defp post_payment_entry(%Scope{} = scope, %Customer{} = customer, %CustomerPayment{} = payment) do
    record_ledger_entry(scope, customer.id, %{
      kind: "payment",
      amount: Decimal.negate(payment.amount),
      reference_type: "customer_payment",
      reference_id: payment.id,
      note: "Payment #{payment.number}",
      occurred_at: DateTime.new!(payment.paid_on, ~T[00:00:00.000000], "Etc/UTC")
    })
  end

  defp apply_filters(query, filters) do
    Enum.reduce(filters, query, fn
      {"q", term}, acc when is_binary(term) and term != "" ->
        pattern = "%#{String.trim(term)}%"

        where(
          acc,
          [customer],
          ilike(customer.name, ^pattern) or ilike(customer.phone, ^pattern) or
            ilike(customer.code, ^pattern) or ilike(customer.email, ^pattern)
        )

      {"credit_allowed", true}, acc ->
        where(acc, [customer], customer.credit_allowed)

      {"owing", true}, acc ->
        where(acc, [customer], customer.balance > 0)

      _other, acc ->
        acc
    end)
  end

  defp filter_ledger_dates(query, %{"from" => %Date{} = from}),
    do: where(query, [entry], fragment("?::date", entry.occurred_at) >= ^from)

  defp filter_ledger_dates(query, _filters), do: query

  defp empty_ageing do
    zero = Money.zero()
    %{current: zero, days_30: zero, days_60: zero, days_90: zero, days_over_90: zero}
  end

  defp bucket_for(days) when days <= 0, do: :current
  defp bucket_for(days) when days <= 30, do: :days_30
  defp bucket_for(days) when days <= 60, do: :days_60
  defp bucket_for(days) when days <= 90, do: :days_90
  defp bucket_for(_days), do: :days_over_90

  # Controllers hand over string keys; internal callers use atoms. Accepting
  # both here is cheaper than making every caller normalise first.
  defp fetch_attr(attrs, key) when is_map(attrs) and is_atom(key),
    do: Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key))

  defp fetch_attr(_attrs, _key), do: nil

  defp to_amount(nil), do: nil

  defp to_amount(value) do
    case Money.cast(value) do
      {:ok, amount} -> amount
      :error -> nil
    end
  end
end
