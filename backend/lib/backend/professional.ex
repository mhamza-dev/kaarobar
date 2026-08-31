defmodule Kaarobar.Professional do
  @moduledoc """
  Quotes, the work they turn into, and the time spent on it.

  ## The chain is quote → work → invoice, and each step is separate

  A quote that is accepted creates work, not a sale. The sale comes when the
  work is billed, often weeks later and rarely for exactly the quoted figure.
  Collapsing any two of those means a firm either invoices work it has not done
  or does work it never priced.

  ## Time is recorded as it happens

  By whoever did it, before anybody decides what to bill. That is why
  `is_billable` and `billed_at` are separate: work that was never chargeable
  and work not yet charged for look identical on an invoice and completely
  different on a utilisation report — which is the one that says whether the
  firm is busy or merely occupied.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Audit
  alias Kaarobar.Money
  alias Kaarobar.Professional.Quote
  alias Kaarobar.Professional.QuoteLine
  alias Kaarobar.Professional.TimeEntry
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Sequences
  alias Kaarobar.ServiceDesk

  # ===========================================================================
  # Quotes
  # ===========================================================================

  @doc "Quotes, newest first. Defaults to the ones still in play."
  @spec list_quotes(Scope.t(), keyword()) :: [Quote.t()]
  def list_quotes(%Scope{} = scope, opts \\ []) do
    Quote
    |> Scoped.for_branch(scope)
    |> filter_quote_status(Keyword.get(opts, :status))
    |> filter_customer(Keyword.get(opts, :customer_id))
    |> order_by([quote], desc: quote.inserted_at)
    |> preload([:customer, :lines])
    |> Repo.all()
  end

  @doc "Fetches a quote with its lines."
  @spec fetch_quote(Scope.t(), Ecto.UUID.t()) :: {:ok, Quote.t()} | {:error, :not_found}
  def fetch_quote(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      Quote
      |> Scoped.for_business(scope)
      |> where([quote], quote.id == ^id)
      |> preload([:customer, :lines])
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        quote -> {:ok, quote}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Draws up a quote.

  Totals are computed from the lines rather than taken from the caller: a
  client that could send its own total could send any total, and a quote is
  what the customer will hold the firm to.
  """
  @spec create_quote(Scope.t(), map()) :: {:ok, Quote.t()} | {:error, term()}
  def create_quote(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)
    lines = attrs |> Map.get("lines", []) |> Enum.map(&stringify/1)

    Repo.transaction(fn ->
      with {:ok, number} <- Sequences.next(scope, "quote"),
           {:ok, quote} <- insert_quote(scope, attrs, number),
           :ok <- insert_lines(scope, quote, lines),
           {:ok, priced} <- reprice(scope, quote) do
        Audit.log(scope, "quote.created", priced,
          entity_type: "quote",
          label: priced.number
        )

        priced
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Replaces a draft quote's lines and reprices it."
  @spec set_quote_lines(Scope.t(), Quote.t(), list()) :: {:ok, Quote.t()} | {:error, term()}
  def set_quote_lines(%Scope{} = scope, %Quote{} = quote, lines) do
    if quote.status == "draft" do
      Repo.transaction(fn ->
        QuoteLine
        |> Scoped.for_business(scope)
        |> where([line], line.quote_id == ^quote.id)
        |> Repo.delete_all()

        with :ok <- insert_lines(scope, quote, Enum.map(lines, &stringify/1)),
             {:ok, priced} <- reprice(scope, quote) do
          priced
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, :quote_not_editable}
    end
  end

  @doc "Sends it to the customer."
  @spec send_quote(Scope.t(), Quote.t()) :: {:ok, Quote.t()} | {:error, term()}
  def send_quote(%Scope{}, %Quote{} = quote),
    do: quote |> Quote.send_changeset() |> Repo.update()

  @doc """
  The customer said yes: opens the work.

  A service job is created from the quote's lines so the firm has something to
  record time against. The sale comes later, when the work is billed.
  """
  @spec accept_quote(Scope.t(), Quote.t()) :: {:ok, Quote.t()} | {:error, term()}
  def accept_quote(%Scope{} = scope, %Quote{} = quote) do
    Repo.transaction(fn ->
      quote = Repo.preload(quote, :lines)

      with {:ok, job} <- open_job_for(scope, quote),
           {:ok, accepted} <- quote |> Quote.accept_changeset() |> Repo.update(),
           {:ok, linked} <- accepted |> Quote.link_job_changeset(job) |> Repo.update() do
        Audit.log(scope, "quote.accepted", linked,
          entity_type: "quote",
          label: linked.number,
          summary: "Opened job #{job.number}"
        )

        linked
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "The customer said no. A reason is required."
  @spec decline_quote(Scope.t(), Quote.t(), String.t()) :: {:ok, Quote.t()} | {:error, term()}
  def decline_quote(%Scope{}, %Quote{} = quote, reason),
    do: quote |> Quote.decline_changeset(reason) |> Repo.update()

  @doc """
  Lapses quotes nobody answered. Run nightly.

  A quote that never expires is one a customer can accept at last year's
  prices.
  """
  @spec expire_stale(Scope.t(), Date.t()) :: {:ok, non_neg_integer()}
  def expire_stale(%Scope{} = scope, as_of \\ Date.utc_today()) do
    {count, _returned} =
      Quote
      |> Scoped.for_business(scope)
      |> where([quote], quote.status in ^Quote.open_statuses())
      |> where([quote], not is_nil(quote.valid_until) and quote.valid_until < ^as_of)
      |> Repo.update_all(set: [status: "expired", expired_at: DateTime.utc_now()])

    {:ok, count}
  end

  @doc """
  How many quotes turned into work, and what that was worth.

  The number a firm needs to know whether it is pricing itself out.
  """
  @spec win_rate(Scope.t(), Date.t(), Date.t()) :: map()
  def win_rate(%Scope{} = scope, from, to) do
    quotes =
      Quote
      |> Scoped.for_business(scope)
      |> where([quote], fragment("?::date", quote.inserted_at) >= ^from)
      |> where([quote], fragment("?::date", quote.inserted_at) <= ^to)
      |> Repo.all()

    decided = Enum.filter(quotes, &(&1.status in ["accepted", "declined"]))
    won = Enum.filter(quotes, &(&1.status == "accepted"))

    %{
      from: from,
      to: to,
      quoted_count: length(quotes),
      decided_count: length(decided),
      won_count: length(won),
      quoted_value: quotes |> Enum.map(& &1.total) |> Money.sum(),
      won_value: won |> Enum.map(& &1.total) |> Money.sum(),
      win_rate: rate(length(won), length(decided))
    }
  end

  # ===========================================================================
  # Time
  # ===========================================================================

  @doc "Records time spent."
  @spec log_time(Scope.t(), map()) :: {:ok, TimeEntry.t()} | {:error, Ecto.Changeset.t()}
  def log_time(%Scope{} = scope, attrs) do
    %TimeEntry{}
    |> TimeEntry.changeset(
      Map.merge(stringify(attrs), %{
        "organization_id" => Scope.organization_id(scope),
        "business_id" => Scope.business_id(scope),
        "branch_id" => Scope.branch_id(scope),
        "user_id" => Map.get(stringify(attrs), "user_id") || Scope.user_id(scope)
      })
    )
    |> Repo.insert()
  end

  @doc "Time entries, newest first."
  @spec list_time(Scope.t(), keyword()) :: [TimeEntry.t()]
  def list_time(%Scope{} = scope, opts \\ []) do
    TimeEntry
    |> Scoped.for_business(scope)
    |> filter_eq(:user_id, Keyword.get(opts, :user_id))
    |> filter_eq(:customer_id, Keyword.get(opts, :customer_id))
    |> filter_eq(:service_job_id, Keyword.get(opts, :service_job_id))
    |> filter_unbilled(Keyword.get(opts, :unbilled))
    |> filter_worked_between(Keyword.get(opts, :from), Keyword.get(opts, :to))
    |> order_by([entry], desc: entry.worked_on, desc: entry.id)
    |> Repo.all()
  end

  @doc "Updates a time entry that has not been invoiced yet."
  @spec update_time(Scope.t(), TimeEntry.t(), map()) ::
          {:ok, TimeEntry.t()} | {:error, term()}
  def update_time(%Scope{}, %TimeEntry{} = entry, attrs) do
    if is_nil(entry.billed_at) do
      entry |> TimeEntry.changeset(stringify(attrs)) |> Repo.update()
    else
      {:error, :already_billed}
    end
  end

  @doc "Deletes a time entry that has not been invoiced."
  @spec delete_time(Scope.t(), TimeEntry.t()) :: {:ok, TimeEntry.t()} | {:error, term()}
  def delete_time(%Scope{}, %TimeEntry{} = entry) do
    if is_nil(entry.billed_at), do: Repo.delete(entry), else: {:error, :already_billed}
  end

  @doc "Fetches a time entry."
  @spec fetch_time(Scope.t(), Ecto.UUID.t()) :: {:ok, TimeEntry.t()} | {:error, :not_found}
  def fetch_time(%Scope{} = scope, id) do
    if Kaarobar.Ecto.UUIDv7.valid?(id) do
      TimeEntry
      |> Scoped.for_business(scope)
      |> where([entry], entry.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        entry -> {:ok, entry}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  What can still be put on an invoice, and what it is worth.

  The billing run's question.
  """
  @spec unbilled(Scope.t(), keyword()) :: map()
  def unbilled(%Scope{} = scope, opts \\ []) do
    entries = list_time(scope, Keyword.put(opts, :unbilled, true))

    %{
      entries: entries,
      minutes: entries |> Enum.map(& &1.minutes) |> Enum.sum(),
      amount: entries |> Enum.map(& &1.amount) |> Money.sum()
    }
  end

  @doc "Marks time as invoiced against a sale."
  @spec mark_billed(Scope.t(), [Ecto.UUID.t()], struct()) :: {:ok, non_neg_integer()}
  def mark_billed(%Scope{} = scope, entry_ids, sale) do
    {count, _returned} =
      TimeEntry
      |> Scoped.for_business(scope)
      |> where([entry], entry.id in ^entry_ids)
      |> where([entry], is_nil(entry.billed_at))
      |> Repo.update_all(set: [billed_at: DateTime.utc_now(), sale_id: sale.id])

    {:ok, count}
  end

  @doc """
  Hours worked per person over a period, billable and not.

  Both halves matter: the split is the utilisation figure, and a firm that only
  counts billable hours cannot see where the rest of the week went.
  """
  @spec utilisation(Scope.t(), Date.t(), Date.t()) :: [map()]
  def utilisation(%Scope{} = scope, from, to) do
    TimeEntry
    |> Scoped.for_business(scope)
    |> where([entry], entry.worked_on >= ^from and entry.worked_on <= ^to)
    |> group_by([entry], [entry.user_id, entry.is_billable])
    |> select([entry], %{
      user_id: entry.user_id,
      is_billable: entry.is_billable,
      minutes: sum(entry.minutes),
      amount: sum(entry.amount)
    })
    |> Repo.all()
    |> Enum.group_by(& &1.user_id)
    |> Enum.map(fn {user_id, rows} ->
      billable = Enum.find(rows, & &1.is_billable) || %{minutes: 0, amount: Money.zero()}
      other = Enum.find(rows, &(not &1.is_billable)) || %{minutes: 0, amount: Money.zero()}

      %{
        user_id: user_id,
        billable_minutes: billable.minutes || 0,
        non_billable_minutes: other.minutes || 0,
        amount: Money.to_decimal(billable.amount)
      }
    end)
    |> Enum.sort_by(& &1.billable_minutes, :desc)
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp insert_quote(%Scope{} = scope, attrs, number) do
    %Quote{}
    |> Quote.changeset(
      Map.merge(attrs, %{
        "organization_id" => Scope.organization_id(scope),
        "business_id" => Scope.business_id(scope),
        "branch_id" => Map.get(attrs, "branch_id") || Scope.branch_id(scope),
        "number" => number,
        "currency" => Map.get(attrs, "currency") || currency_of(scope),
        "created_by_id" => Scope.user_id(scope)
      })
    )
    |> Repo.insert()
  end

  defp insert_lines(%Scope{} = scope, %Quote{} = quote, lines) do
    lines
    |> Enum.with_index()
    |> Enum.reduce_while(:ok, fn {line, position}, _acc ->
      changeset =
        %QuoteLine{}
        |> QuoteLine.changeset(
          Map.merge(line, %{
            "business_id" => Scope.business_id(scope),
            "quote_id" => quote.id,
            "position" => position
          })
        )

      case Repo.insert(changeset) do
        {:ok, _line} -> {:cont, :ok}
        {:error, failure} -> {:halt, {:error, failure}}
      end
    end)
  end

  defp reprice(%Scope{} = scope, %Quote{} = quote) do
    lines =
      QuoteLine
      |> Scoped.for_business(scope)
      |> where([line], line.quote_id == ^quote.id)
      |> Repo.all()

    subtotal = lines |> Enum.map(&Money.mult(&1.quantity, &1.unit_price)) |> Money.sum()
    discount = lines |> Enum.map(& &1.discount) |> Money.sum()
    net = subtotal |> Money.sub(discount) |> Money.clamp_non_negative()

    totals = %{
      subtotal: subtotal,
      discount_total: discount,
      # Tax on a quote is left at zero: it is an estimate, and the rate that
      # applies is the one in force when the work is actually billed.
      tax_total: Money.zero(),
      total: net
    }

    with {:ok, priced} <- quote |> Quote.totals_changeset(totals) |> Repo.update() do
      {:ok, Repo.preload(priced, [:customer, :lines], force: true)}
    end
  end

  # Accepting a quote opens the work, so there is something to record time
  # against long before anybody decides what to invoice.
  defp open_job_for(%Scope{} = scope, %Quote{} = quote) do
    items =
      Enum.map(quote.lines, fn line ->
        %{
          "description" => line.description,
          "quantity" => line.quantity,
          "unit_price" => line.unit_price,
          "variant_id" => line.variant_id
        }
      end)

    ServiceDesk.take_in(scope, %{
      "customer_id" => quote.customer_id,
      "walk_in_name" => if(quote.customer_id, do: nil, else: quote.title),
      "quoted_total" => quote.total,
      "notes" => "From quote #{quote.number}",
      "items" => items
    })
  end

  defp currency_of(%Scope{business: %{currency: currency}}), do: currency
  defp currency_of(%Scope{}), do: "PKR"

  defp rate(_won, 0), do: nil

  defp rate(won, decided),
    do: won |> Decimal.new() |> Decimal.div(Decimal.new(decided)) |> Decimal.round(4)

  defp filter_quote_status(query, nil),
    do: where(query, [quote], quote.status in ^Quote.open_statuses())

  defp filter_quote_status(query, "all"), do: query
  defp filter_quote_status(query, status), do: where(query, [q], q.status == ^status)

  defp filter_customer(query, nil), do: query
  defp filter_customer(query, id), do: where(query, [q], q.customer_id == ^id)

  defp filter_eq(query, _field, nil), do: query
  defp filter_eq(query, :user_id, value), do: where(query, [e], e.user_id == ^value)
  defp filter_eq(query, :customer_id, value), do: where(query, [e], e.customer_id == ^value)

  defp filter_eq(query, :service_job_id, value),
    do: where(query, [e], e.service_job_id == ^value)

  defp filter_unbilled(query, true),
    do: where(query, [e], e.is_billable and is_nil(e.billed_at))

  defp filter_unbilled(query, _other), do: query

  defp filter_worked_between(query, nil, nil), do: query
  defp filter_worked_between(query, from, nil), do: where(query, [e], e.worked_on >= ^from)
  defp filter_worked_between(query, nil, to), do: where(query, [e], e.worked_on <= ^to)

  defp filter_worked_between(query, from, to),
    do: where(query, [e], e.worked_on >= ^from and e.worked_on <= ^to)

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} ->
      {if(is_atom(key), do: Atom.to_string(key), else: key), value}
    end)
  end

  defp stringify(other), do: other
end
