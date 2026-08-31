defmodule Kaarobar.ServiceDesk.Job do
  @moduledoc """
  Work taken in: laundry, ironing, tailoring, phone and appliance repair.

  ## The shop is holding the customer's property

  That is what separates this from a sale, and it is why the job stands on its
  own rather than being an unpaid order. Money is taken on collection,
  sometimes in advance, occasionally in part — so a sale attaches when one
  happens, and the intake ticket can be printed and the garment tagged before
  anybody has decided what to charge.

  ## `promised_on` never moves

  It is set at intake and left alone. A shop that rewrites its promise when
  work runs late can never see that it runs late, and the customer who was told
  Tuesday is the only person who remembers.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Money
  alias Kaarobar.Sales.Sale
  alias Kaarobar.ServiceDesk.JobItem
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(intake in_progress ready delivered cancelled on_hold)
  @priorities ~w(normal express urgent)
  @fulfilments ~w(collection delivery)
  # States in which the shop still has the customer's property.
  @holding_statuses ~w(intake in_progress ready on_hold)

  schema "service_jobs" do
    field :number, :string
    field :status, :string, default: "intake"
    field :priority, :string, default: "normal"

    field :walk_in_name, :string
    field :walk_in_phone, :string

    field :promised_on, :date
    field :promised_at, :utc_datetime_usec

    field :received_at, :utc_datetime_usec
    field :started_at, :utc_datetime_usec
    field :ready_at, :utc_datetime_usec
    field :delivered_at, :utc_datetime_usec
    field :cancelled_at, :utc_datetime_usec
    field :cancel_reason, :string

    field :quoted_total, :decimal, default: Decimal.new(0)
    field :advance_paid, :decimal, default: Decimal.new(0)

    field :rack_location, :string
    field :fulfilment, :string, default: "collection"
    field :delivery_address, :string
    field :delivery_notes, :string

    field :notes, :string
    field :internal_notes, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :customer, Customer
    belongs_to :sale, Sale
    belongs_to :received_by, User
    belongs_to :assigned_to, User
    belongs_to :delivered_by, User

    has_many :items, JobItem,
      foreign_key: :service_job_id,
      preload_order: [asc: :position]

    timestamps()
  end

  @doc "The states a job moves through."
  def statuses, do: @statuses

  @doc "How urgent the work is."
  def priorities, do: @priorities

  @doc "How the finished work gets back to the customer."
  def fulfilments, do: @fulfilments

  @doc "The states in which the shop is still holding the customer's property."
  def holding_statuses, do: @holding_statuses

  def changeset(job, attrs) do
    job
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :customer_id,
      :walk_in_name,
      :walk_in_phone,
      :number,
      :priority,
      :promised_on,
      :promised_at,
      :received_at,
      :received_by_id,
      :assigned_to_id,
      :quoted_total,
      :advance_paid,
      :rack_location,
      :fulfilment,
      :delivery_address,
      :delivery_notes,
      :notes,
      :internal_notes
    ])
    |> validate_required([:organization_id, :business_id, :branch_id, :number, :received_at])
    |> validate_inclusion(:priority, @priorities)
    |> validate_inclusion(:fulfilment, @fulfilments)
    |> validate_number(:quoted_total, greater_than_or_equal_to: 0)
    |> validate_number(:advance_paid, greater_than_or_equal_to: 0)
    |> validate_who()
    |> validate_delivery_address()
    |> unique_constraint(:number, name: :service_jobs_business_id_number_index)
    |> foreign_key_constraint(:branch_id)
  end

  @doc "Work has begun."
  def start_changeset(job),
    do: change(job, status: "in_progress", started_at: DateTime.utc_now())

  @doc """
  Finished and waiting to be collected.

  A rack location is required. A job that is ready but unfindable is a job that
  is not ready, and "it is here somewhere" is what loses a customer for good.
  """
  def ready_changeset(job, rack_location) do
    job
    |> cast(%{rack_location: rack_location}, [:rack_location])
    |> validate_required([:rack_location], message: "is required before a job can be marked ready")
    |> put_change(:status, "ready")
    |> put_change(:ready_at, DateTime.utc_now())
  end

  @doc "Handed back."
  def deliver_changeset(job, user_id) do
    change(job,
      status: "delivered",
      delivered_at: DateTime.utc_now(),
      delivered_by_id: user_id
    )
  end

  @doc "Paused — waiting on a part, or on the customer."
  def hold_changeset(job), do: change(job, status: "on_hold")

  @doc "Called off. A reason is required, and the database agrees."
  def cancel_changeset(job, reason) do
    job
    |> cast(%{cancel_reason: reason}, [:cancel_reason])
    |> validate_required([:cancel_reason], message: "is required to cancel a job")
    |> put_change(:status, "cancelled")
    |> put_change(:cancelled_at, DateTime.utc_now())
  end

  @doc "Points the job at the sale that paid for it."
  def bill_changeset(job, %Sale{} = sale), do: change(job, sale_id: sale.id)

  @doc "True when the shop still has the customer's property."
  @spec holding?(t()) :: boolean()
  def holding?(%__MODULE__{status: status}), do: status in @holding_statuses

  @doc """
  True when the promise has been missed and the work is not out yet.

  False once delivered, however late it was — a job that got there in the end
  is a service failure to report on, not something to keep flagging on the
  counter screen.
  """
  @spec overdue?(t(), Date.t()) :: boolean()
  def overdue?(%__MODULE__{promised_on: nil}, _today), do: false

  def overdue?(%__MODULE__{} = job, today) do
    holding?(job) and Date.compare(job.promised_on, today) == :lt
  end

  @doc "What is still owed on the job, against the quote."
  @spec balance_due(t()) :: Decimal.t()
  def balance_due(%__MODULE__{} = job),
    do: job.quoted_total |> Money.sub(job.advance_paid) |> Money.clamp_non_negative()

  @doc "Who brought it in, however they were recorded."
  @spec who(t()) :: String.t()
  def who(%__MODULE__{customer: %Customer{name: name}}), do: name
  def who(%__MODULE__{walk_in_name: name}) when is_binary(name), do: name
  def who(%__MODULE__{}), do: "Walk-in"

  defp validate_who(changeset) do
    customer_id = get_field(changeset, :customer_id)
    walk_in = get_field(changeset, :walk_in_name)

    if is_nil(customer_id) and blank?(walk_in) do
      add_error(changeset, :walk_in_name, "or a customer is required")
    else
      changeset
    end
  end

  # A job marked for delivery with nowhere to deliver it to is a promise the
  # rider cannot keep.
  defp validate_delivery_address(changeset) do
    if get_field(changeset, :fulfilment) == "delivery" and
         blank?(get_field(changeset, :delivery_address)) do
      add_error(changeset, :delivery_address, "is required for a delivery")
    else
      changeset
    end
  end

  defp blank?(nil), do: true
  defp blank?(value), do: String.trim(value) == ""
end
