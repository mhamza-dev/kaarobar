defmodule Kaarobar.Professional.Quote do
  @moduledoc """
  Work priced but not yet agreed.

  Most quotes are never accepted, which is precisely why they are worth
  tracking: a firm that cannot see its win rate cannot tell whether it is
  pricing itself out or leaving money on the table.

  Accepting one does not create a sale. It creates the *work* — the sale comes
  when the work is billed, often weeks later and rarely for exactly the quoted
  figure.

  `valid_until` exists because a quote that never expires is one a customer can
  accept at last year's prices.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Money
  alias Kaarobar.Professional.QuoteLine
  alias Kaarobar.Sales.Sale
  alias Kaarobar.ServiceDesk.Job
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(draft sent accepted declined expired cancelled)
  @open_statuses ~w(draft sent)

  schema "quotes" do
    field :number, :string
    field :title, :string
    field :status, :string, default: "draft"

    field :subtotal, :decimal, default: Decimal.new(0)
    field :discount_total, :decimal, default: Decimal.new(0)
    field :tax_total, :decimal, default: Decimal.new(0)
    field :total, :decimal, default: Decimal.new(0)
    field :currency, :string

    field :valid_until, :date
    field :notes, :string
    field :terms, :string

    field :sent_at, :utc_datetime_usec
    field :accepted_at, :utc_datetime_usec
    field :declined_at, :utc_datetime_usec
    field :decline_reason, :string
    field :expired_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :customer, Customer
    belongs_to :service_job, Job
    belongs_to :sale, Sale
    belongs_to :created_by, User

    has_many :lines, QuoteLine, preload_order: [asc: :position]

    timestamps()
  end

  @doc "The states a quote moves through."
  def statuses, do: @statuses

  @doc "The states in which a quote might still be won."
  def open_statuses, do: @open_statuses

  def changeset(quote, attrs) do
    quote
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :customer_id,
      :number,
      :title,
      :currency,
      :valid_until,
      :notes,
      :terms,
      :created_by_id
    ])
    |> validate_required([:organization_id, :business_id, :branch_id, :number, :title, :currency])
    |> update_change(:title, &String.trim/1)
    |> validate_length(:title, min: 1, max: 200)
    |> unique_constraint(:number, name: :quotes_business_id_number_index)
    |> foreign_key_constraint(:customer_id)
  end

  @doc "Recomputes the totals from the lines."
  def totals_changeset(quote, totals) do
    change(quote,
      subtotal: Money.round(totals.subtotal),
      discount_total: Money.round(totals.discount_total),
      tax_total: Money.round(totals.tax_total),
      total: Money.round(totals.total)
    )
  end

  @doc "Sent to the customer."
  def send_changeset(quote), do: change(quote, status: "sent", sent_at: DateTime.utc_now())

  @doc "The customer said yes. The work follows; the sale comes later."
  def accept_changeset(quote),
    do: change(quote, status: "accepted", accepted_at: DateTime.utc_now())

  @doc """
  The customer said no.

  A reason is required, and the database agrees. A pile of declined quotes with
  no reasons is the one thing that could have told the firm why it is losing.
  """
  def decline_changeset(quote, reason) do
    quote
    |> cast(%{decline_reason: reason}, [:decline_reason])
    |> validate_required([:decline_reason], message: "is required when a quote is declined")
    |> put_change(:status, "declined")
    |> put_change(:declined_at, DateTime.utc_now())
  end

  @doc "Points the quote at the work it became."
  def link_job_changeset(quote, %Job{} = job), do: change(quote, service_job_id: job.id)

  @doc "Lapsed without an answer."
  def expire_changeset(quote),
    do: change(quote, status: "expired", expired_at: DateTime.utc_now())

  @doc "True when the quote might still be won."
  @spec open?(t()) :: boolean()
  def open?(%__MODULE__{status: status}), do: status in @open_statuses

  @doc "True when its date has passed and nobody has answered."
  @spec lapsed?(t(), Date.t()) :: boolean()
  def lapsed?(%__MODULE__{valid_until: nil}, _today), do: false

  def lapsed?(%__MODULE__{} = quote, today),
    do: open?(quote) and Date.compare(quote.valid_until, today) == :lt
end
