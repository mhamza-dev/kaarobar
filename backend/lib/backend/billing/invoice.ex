defmodule Kaarobar.Billing.Invoice do
  @moduledoc """
  What Kaarobar has billed one organization for a period.

  Not to be confused with a `Kaarobar.Sales.Sale`, which is what a shop billed
  its own customer. These are our books; those are theirs. A shared table would
  eventually show a shopkeeper our revenue, or put their customers' charges in
  our accounts.

  ## Dunning lives on the invoice

  There is exactly one collection attempt sequence per unpaid invoice, so
  `attempts`, `dunning_stage` and `next_attempt_at` sit here rather than in a
  table of their own — which would only be somewhere for the two to disagree
  about how many times we had asked.

  The stages escalate: retry quietly, email, warn, then give up and mark it
  uncollectible. Giving up is a real state and not a loop, because an invoice
  retried forever is one nobody ever looks at.
  """

  use Kaarobar.Schema

  alias Kaarobar.Billing.InvoiceLine
  alias Kaarobar.Billing.Subscription
  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(draft open paid void uncollectible)

  # How long after each failure to try again, in days. The last stage is where
  # collection stops and a person takes over.
  @dunning_schedule [1, 3, 7, 14]

  schema "platform_invoices" do
    field :number, :string
    field :status, :string, default: "open"
    field :currency, :string, default: "PKR"

    field :subtotal, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :total, :decimal, default: Decimal.new(0)
    field :amount_paid, :decimal, default: Decimal.new(0)

    field :period_start, :utc_datetime_usec
    field :period_end, :utc_datetime_usec
    field :due_at, :utc_datetime_usec
    field :paid_at, :utc_datetime_usec
    field :voided_at, :utc_datetime_usec

    field :attempts, :integer, default: 0
    field :dunning_stage, :integer, default: 0
    field :next_attempt_at, :utc_datetime_usec
    field :last_error, :string

    field :external_invoice_id, :string

    belongs_to :organization, Organization
    belongs_to :subscription, Subscription

    has_many :lines, InvoiceLine, foreign_key: :invoice_id, preload_order: [asc: :position]

    timestamps()
  end

  @doc "Every state an invoice may be in."
  def statuses, do: @statuses

  @doc "How many days after each failed attempt to try again."
  def dunning_schedule, do: @dunning_schedule

  @doc "How many times collection is attempted before a person takes over."
  def max_dunning_stage, do: length(@dunning_schedule)

  def changeset(invoice, attrs) do
    invoice
    |> cast(attrs, [
      :organization_id,
      :subscription_id,
      :number,
      :status,
      :currency,
      :subtotal,
      :tax_total,
      :total,
      :period_start,
      :period_end,
      :due_at,
      :external_invoice_id
    ])
    |> validate_required([:organization_id, :number, :currency, :total])
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:total, greater_than_or_equal_to: 0)
    |> unique_constraint(:number,
      name: :platform_invoices_number_index,
      message: "has already been issued"
    )
    |> foreign_key_constraint(:organization_id)
  end

  @doc """
  Marks it paid.

  Clears the dunning schedule as well as setting the date. An invoice that was
  paid but still had a next attempt on it would be chased for money we already
  had, which is the single most damaging thing a billing system can do.
  """
  def paid_changeset(invoice, amount \\ nil) do
    change(invoice, %{
      status: "paid",
      amount_paid: amount || invoice.total,
      paid_at: DateTime.utc_now(),
      next_attempt_at: nil,
      last_error: nil
    })
  end

  @doc """
  Records a failed collection attempt and schedules the next one.

  Once the schedule is exhausted the invoice becomes `uncollectible` rather
  than being retried forever — a bounded process ends with somebody looking at
  it, and an unbounded one ends with nobody ever doing so.
  """
  def dunning_changeset(invoice, reason) do
    stage = invoice.dunning_stage + 1

    base = %{
      attempts: invoice.attempts + 1,
      dunning_stage: stage,
      last_error: describe(reason)
    }

    case Enum.at(@dunning_schedule, stage - 1) do
      nil ->
        change(invoice, Map.merge(base, %{status: "uncollectible", next_attempt_at: nil}))

      days ->
        next = DateTime.add(DateTime.utc_now(), days * 24 * 3600, :second)
        change(invoice, Map.put(base, :next_attempt_at, next))
    end
  end

  @doc "Cancels an invoice that should never have been issued."
  def void_changeset(invoice) do
    change(invoice, %{status: "void", voided_at: DateTime.utc_now(), next_attempt_at: nil})
  end

  @doc "What is still owed on this invoice."
  @spec outstanding(t()) :: Decimal.t()
  def outstanding(%__MODULE__{status: status}) when status in ["void", "paid"], do: Money.zero()

  def outstanding(%__MODULE__{total: total, amount_paid: paid}),
    do: total |> Money.sub(paid) |> Money.clamp_non_negative()

  @doc "True when this invoice is past its due date and still unpaid."
  @spec overdue?(t(), DateTime.t()) :: boolean()
  def overdue?(invoice, now \\ DateTime.utc_now())

  def overdue?(%__MODULE__{status: "open", due_at: due}, now) when not is_nil(due),
    do: DateTime.compare(now, due) == :gt

  def overdue?(%__MODULE__{}, _now), do: false

  @doc "True when collection has been given up on."
  @spec abandoned?(t()) :: boolean()
  def abandoned?(%__MODULE__{status: "uncollectible"}), do: true
  def abandoned?(%__MODULE__{}), do: false

  defp describe(reason) when is_binary(reason), do: reason
  defp describe(reason), do: inspect(reason)
end
