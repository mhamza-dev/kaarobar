defmodule Kaarobar.Credit do
  @moduledoc """
  What customers owe, invoice by invoice.

  `Kaarobar.Customers` keeps the balance — one number, the sum of everything.
  This keeps the detail behind it: which invoices are unpaid, which payment
  settled what, and how long each debt has been outstanding against the terms
  that customer was actually given.

  ## Outstanding is derived, never stored

  A sale's unpaid credit is `credit_total` less what has been allocated to it.
  Nothing writes a running "amount still owed" onto the sale, because that
  would be a second copy of the truth that can drift from the allocations, and
  because a sale is meant to stop changing once it is rung.

  ## Ageing counts against each customer's own terms

  Thirty days is not overdue for a wholesale buyer on sixty-day terms, and is
  badly overdue for a walk-in who was told to settle on collection. Bucketing
  everyone against a flat calendar produces a report that is technically
  correct and practically useless — the shopkeeper cannot tell which of these
  debts they are entitled to chase. Terms come from the customer, falling back
  to their group, falling back to nothing.

  This is the mirror of `Kaarobar.Purchasing.payables_ageing/1` on the buy side.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Customers.CustomerGroup
  alias Kaarobar.Customers.CustomerPayment
  alias Kaarobar.Customers.PaymentAllocation
  alias Kaarobar.Money
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Scope

  @type invoice :: %{
          sale_id: Ecto.UUID.t(),
          number: String.t(),
          customer_id: Ecto.UUID.t(),
          sold_at: DateTime.t(),
          due_on: Date.t(),
          charged: Decimal.t(),
          allocated: Decimal.t(),
          outstanding: Decimal.t(),
          days_overdue: integer()
        }

  # ===========================================================================
  # Outstanding invoices
  # ===========================================================================

  @doc """
  Credit sales with anything still owed on them, oldest first.

  Oldest first because that is the order a shopkeeper works through them and
  the order `auto_allocate/3` applies money in.

  ## Options

    * `:customer_id` — one customer's invoices.
    * `:as_of` — the date overdue days are measured against. Defaults to today.
  """
  @spec open_invoices(Scope.t(), keyword()) :: [invoice()]
  def open_invoices(%Scope{} = scope, opts \\ []) do
    as_of = Keyword.get(opts, :as_of, Date.utc_today())

    query =
      from sale in Sale,
        left_join: allocation in PaymentAllocation,
        on: allocation.sale_id == sale.id,
        join: customer in Customer,
        on: customer.id == sale.customer_id,
        left_join: group in CustomerGroup,
        on: group.id == customer.customer_group_id,
        where: sale.credit_total > 0,
        where: sale.status != "voided",
        group_by: [sale.id, customer.id, customer.payment_terms_days, group.payment_terms_days],
        having: sale.credit_total > coalesce(sum(allocation.amount), 0),
        order_by: [asc: sale.sold_at, asc: sale.id],
        select: %{
          sale_id: sale.id,
          number: sale.number,
          customer_id: sale.customer_id,
          customer_name: customer.name,
          sold_at: sale.sold_at,
          charged: sale.credit_total,
          allocated: coalesce(sum(allocation.amount), 0),
          terms_days:
            coalesce(customer.payment_terms_days, coalesce(group.payment_terms_days, 0))
        }

    query
    |> Scoped.for_business(scope)
    |> filter_customer(Keyword.get(opts, :customer_id))
    |> Repo.all()
    |> Enum.map(&to_invoice(&1, as_of))
  end

  @doc """
  What is still owed on one sale.

  Zero for a voided sale: voiding reverses the debt, and an invoice that no
  longer exists cannot be chased.
  """
  @spec outstanding_on(Scope.t(), Sale.t() | Ecto.UUID.t()) :: Decimal.t()
  def outstanding_on(%Scope{} = scope, %Sale{} = sale) do
    if Sale.on_credit?(sale) do
      sale.credit_total |> Money.sub(allocated_to(scope, sale.id)) |> Money.clamp_non_negative()
    else
      Money.zero()
    end
  end

  def outstanding_on(%Scope{} = scope, sale_id) when is_binary(sale_id) do
    case fetch_sale(scope, sale_id) do
      {:ok, sale} -> outstanding_on(scope, sale)
      {:error, :not_found} -> Money.zero()
    end
  end

  @doc "How much has been allocated against one sale."
  @spec allocated_to(Scope.t(), Ecto.UUID.t()) :: Decimal.t()
  def allocated_to(%Scope{} = scope, sale_id) do
    PaymentAllocation
    |> Scoped.for_business(scope)
    |> where([allocation], allocation.sale_id == ^sale_id)
    |> select([allocation], coalesce(sum(allocation.amount), 0))
    |> Repo.one()
    |> Money.to_decimal()
  end

  @doc "What is left of a payment to spread across invoices."
  @spec unallocated_on(Scope.t(), CustomerPayment.t()) :: Decimal.t()
  def unallocated_on(%Scope{} = scope, %CustomerPayment{} = payment) do
    allocated =
      PaymentAllocation
      |> Scoped.for_business(scope)
      |> where([allocation], allocation.customer_payment_id == ^payment.id)
      |> select([allocation], coalesce(sum(allocation.amount), 0))
      |> Repo.one()
      |> Money.to_decimal()

    payment.amount |> Money.sub(allocated) |> Money.clamp_non_negative()
  end

  # ===========================================================================
  # Allocation
  # ===========================================================================

  @doc """
  Applies a payment to named invoices.

  `allocations` maps sale ids to amounts. Anything left over stays unallocated
  and shows in the customer's balance as money on account, which is what it is.

  Runs in one transaction: a payment half-applied is worse than one not applied
  at all, because the balance still looks right.
  """
  @spec allocate(Scope.t(), CustomerPayment.t(), map()) ::
          {:ok, [PaymentAllocation.t()]} | {:error, term()}
  def allocate(%Scope{} = scope, %CustomerPayment{} = payment, allocations) do
    Repo.transaction(fn ->
      case allocate_within(scope, payment, allocations) do
        {:ok, written} ->
          Audit.log(scope, "customer_payment.allocated", payment,
            entity_type: "customer_payment",
            label: payment.number,
            summary: "Allocated across #{length(written)} invoice(s)"
          )

          written

        {:error, reason} ->
          Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Applies a payment without opening a transaction of its own.

  For callers already inside one — recording a payment allocates it in the same
  transaction that writes the ledger entry, so a rollback takes both.
  """
  @spec allocate_within(Scope.t(), CustomerPayment.t(), map()) ::
          {:ok, [PaymentAllocation.t()]} | {:error, term()}
  def allocate_within(%Scope{} = scope, %CustomerPayment{} = payment, allocations) do
    available = unallocated_on(scope, payment)

    requested =
      allocations
      |> Map.values()
      |> Enum.map(&Money.to_decimal/1)
      |> Money.sum()

    if Decimal.compare(requested, available) == :gt do
      {:error, {:over_allocated, available}}
    else
      allocations
      |> Enum.reduce_while({:ok, []}, fn {sale_id, amount}, {:ok, acc} ->
        case allocate_one(scope, payment, sale_id, Money.to_decimal(amount)) do
          {:ok, allocation} -> {:cont, {:ok, [allocation | acc]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
      |> case do
        {:ok, written} -> {:ok, Enum.reverse(written)}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  @doc """
  Spreads whatever is unallocated on a payment across the oldest invoices.

  Deliberately a separate call rather than the default. Oldest-first is a
  reasonable guess and nothing more: a customer paying a round number usually
  has a particular delivery in mind, and guessing silently is how a shop ends
  up unable to answer which invoice was paid. A cashier who chooses this has
  chosen the guess.
  """
  @spec auto_allocate(Scope.t(), CustomerPayment.t()) ::
          {:ok, [PaymentAllocation.t()]} | {:error, term()}
  def auto_allocate(%Scope{} = scope, %CustomerPayment{} = payment) do
    Repo.transaction(fn ->
      available = unallocated_on(scope, payment)
      invoices = open_invoices(scope, customer_id: payment.customer_id)

      case allocate_within(scope, payment, spread(invoices, available)) do
        {:ok, written} -> written
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Every allocation made against one sale, with the payment behind it."
  @spec allocations_for_sale(Scope.t(), Ecto.UUID.t()) :: [PaymentAllocation.t()]
  def allocations_for_sale(%Scope{} = scope, sale_id) do
    PaymentAllocation
    |> Scoped.for_business(scope)
    |> where([allocation], allocation.sale_id == ^sale_id)
    |> order_by([allocation], asc: allocation.id)
    |> preload(:customer_payment)
    |> Repo.all()
  end

  # ===========================================================================
  # Ageing
  # ===========================================================================

  @doc """
  What is owed, bucketed by how far past its own terms it is.

  Buckets are counted from the due date, not the invoice date, so a sixty-day
  customer at day forty is `:current` rather than in the thirty-day bucket.
  That is the difference between a report that says who to ring and one that
  says who has bought something recently.
  """
  @spec ageing(Scope.t(), keyword()) :: map()
  def ageing(%Scope{} = scope, opts \\ []) do
    as_of = Keyword.get(opts, :as_of, Date.utc_today())
    invoices = open_invoices(scope, Keyword.put(opts, :as_of, as_of))

    buckets =
      Enum.reduce(invoices, empty_buckets(), fn invoice, acc ->
        Map.update!(acc, bucket_for(invoice.days_overdue), &Money.add(&1, invoice.outstanding))
      end)

    Map.merge(buckets, %{
      total: buckets |> Map.values() |> Money.sum(),
      as_of: as_of,
      invoice_count: length(invoices)
    })
  end

  @doc """
  The same buckets, per customer, worst first.

  What a collections round is actually built from — a total tells the owner how
  bad it is, this tells them where to start.
  """
  @spec ageing_by_customer(Scope.t(), keyword()) :: [map()]
  def ageing_by_customer(%Scope{} = scope, opts \\ []) do
    as_of = Keyword.get(opts, :as_of, Date.utc_today())

    scope
    |> open_invoices(Keyword.put(opts, :as_of, as_of))
    |> Enum.group_by(& &1.customer_id)
    |> Enum.map(fn {customer_id, invoices} ->
      buckets =
        Enum.reduce(invoices, empty_buckets(), fn invoice, acc ->
          Map.update!(acc, bucket_for(invoice.days_overdue), &Money.add(&1, invoice.outstanding))
        end)

      Map.merge(buckets, %{
        customer_id: customer_id,
        customer_name: List.first(invoices).customer_name,
        total: buckets |> Map.values() |> Money.sum(),
        oldest_days_overdue: invoices |> Enum.map(& &1.days_overdue) |> Enum.max(fn -> 0 end),
        invoice_count: length(invoices)
      })
    end)
    |> Enum.sort_by(&{&1.oldest_days_overdue, Decimal.to_float(&1.total)}, :desc)
  end

  @doc "Invoices past their due date, worst first. The collections list."
  @spec overdue_invoices(Scope.t(), keyword()) :: [invoice()]
  def overdue_invoices(%Scope{} = scope, opts \\ []) do
    scope
    |> open_invoices(opts)
    |> Enum.filter(&(&1.days_overdue > 0))
    |> Enum.sort_by(& &1.days_overdue, :desc)
  end

  @doc """
  A customer's statement: every movement, with what it left owing.

  The ledger already snapshots `balance_after`, so this is the ledger in date
  order with the invoices it refers to resolved — no arithmetic of its own,
  which is the point. A statement that recomputes cannot be checked against
  anything.
  """
  @spec statement(Scope.t(), Customer.t(), keyword()) :: map()
  def statement(%Scope{} = scope, %Customer{} = customer, opts \\ []) do
    entries = Kaarobar.Customers.list_ledger_entries(scope, customer, statement_filters(opts))
    invoices = open_invoices(scope, customer_id: customer.id)

    %{
      customer: customer,
      entries: entries,
      open_invoices: invoices,
      balance: customer.balance,
      outstanding: invoices |> Enum.map(& &1.outstanding) |> Money.sum(),
      credit_limit: customer.credit_limit,
      available_credit: Customer.available_credit(customer)
    }
  end

  @doc """
  The terms that apply to a customer, in days.

  Their own, or their group's, or nothing. Explicit here because the fallback
  chain is easy to get subtly wrong and every ageing figure depends on it.
  """
  @spec terms_days(Customer.t()) :: non_neg_integer()
  def terms_days(%Customer{payment_terms_days: days}) when is_integer(days), do: days

  def terms_days(%Customer{customer_group: %CustomerGroup{payment_terms_days: days}})
      when is_integer(days),
      do: days

  def terms_days(%Customer{}), do: 0

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp allocate_one(%Scope{} = scope, %CustomerPayment{} = payment, sale_id, amount) do
    with :ok <- validate_positive(amount),
         {:ok, sale} <- fetch_sale(scope, sale_id),
         :ok <- ensure_same_customer(payment, sale),
         :ok <- ensure_fits(scope, sale, amount) do
      attrs = %{
        organization_id: Scope.organization_id(scope),
        business_id: Scope.business_id(scope),
        customer_payment_id: payment.id,
        sale_id: sale.id,
        amount: amount
      }

      %PaymentAllocation{} |> PaymentAllocation.changeset(attrs) |> Repo.insert()
    end
  end

  defp validate_positive(amount) do
    if Money.positive?(amount), do: :ok, else: {:error, :amount_must_be_positive}
  end

  # Settling one customer's invoice with another's money would balance both
  # books and be wrong about both of them.
  defp ensure_same_customer(%CustomerPayment{customer_id: payer}, %Sale{customer_id: owner}) do
    if payer == owner, do: :ok, else: {:error, :customer_mismatch}
  end

  defp ensure_fits(%Scope{} = scope, %Sale{} = sale, amount) do
    remaining = outstanding_on(scope, sale)

    if Decimal.compare(amount, remaining) == :gt do
      # A two-element tuple on purpose: the fallback controller renders
      # `{:error, {reason, detail}}` and would crash on a wider one.
      {:error, {:exceeds_outstanding, %{invoice: sale.number, outstanding: remaining}}}
    else
      :ok
    end
  end

  defp fetch_sale(%Scope{} = scope, sale_id) do
    if Kaarobar.Ecto.UUIDv7.valid?(sale_id) do
      Sale
      |> Scoped.for_business(scope)
      |> where([sale], sale.id == ^sale_id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        sale -> {:ok, sale}
      end
    else
      {:error, :not_found}
    end
  end

  # Walk the invoices oldest first, giving each what is left until the money
  # runs out.
  defp spread(invoices, available) do
    {plan, _left} =
      Enum.reduce(invoices, {%{}, available}, fn invoice, {acc, remaining} ->
        if Money.positive?(remaining) do
          take = Money.min(invoice.outstanding, remaining)

          if Money.positive?(take) do
            {Map.put(acc, invoice.sale_id, take), Money.sub(remaining, take)}
          else
            {acc, remaining}
          end
        else
          {acc, remaining}
        end
      end)

    plan
  end

  defp to_invoice(row, as_of) do
    charged = Money.to_decimal(row.charged)
    allocated = Money.to_decimal(row.allocated)
    due_on = row.sold_at |> DateTime.to_date() |> Date.add(row.terms_days)

    %{
      sale_id: row.sale_id,
      number: row.number,
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      sold_at: row.sold_at,
      due_on: due_on,
      charged: charged,
      allocated: allocated,
      outstanding: charged |> Money.sub(allocated) |> Money.clamp_non_negative(),
      days_overdue: max(Date.diff(as_of, due_on), 0)
    }
  end

  defp filter_customer(query, nil), do: query

  defp filter_customer(query, customer_id),
    do: where(query, [sale], sale.customer_id == ^customer_id)

  defp statement_filters(opts) do
    case Keyword.get(opts, :from) do
      %Date{} = from -> %{"from" => from}
      _other -> %{}
    end
  end

  defp empty_buckets do
    zero = Money.zero()
    %{current: zero, days_1_30: zero, days_31_60: zero, days_61_90: zero, days_over_90: zero}
  end

  defp bucket_for(days) when days <= 0, do: :current
  defp bucket_for(days) when days <= 30, do: :days_1_30
  defp bucket_for(days) when days <= 60, do: :days_31_60
  defp bucket_for(days) when days <= 90, do: :days_61_90
  defp bucket_for(_days), do: :days_over_90

end
