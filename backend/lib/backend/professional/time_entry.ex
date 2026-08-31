defmodule Kaarobar.Professional.TimeEntry do
  @moduledoc """
  An hour of somebody's work, recorded as it happens.

  ## Billable and billed are different questions

  `is_billable` says whether it can be charged at all; `billed_at` says whether
  it has been. Work that was never chargeable and work not yet charged for look
  identical on an invoice and completely different on a utilisation report,
  which is the report that tells a firm whether it is busy or merely occupied.

  `hourly_rate` is snapshotted so a rate rise does not silently reprice six
  weeks of unbilled work already done at the old rate.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Money
  alias Kaarobar.Sales.Sale
  alias Kaarobar.ServiceDesk.Job
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "time_entries" do
    field :description, :string
    field :worked_on, :date
    field :minutes, :integer

    field :is_billable, :boolean, default: true
    field :hourly_rate, :decimal
    field :amount, :decimal, default: Decimal.new(0)

    field :billed_at, :utc_datetime_usec
    field :notes, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :user, User
    belongs_to :customer, Customer
    belongs_to :service_job, Job
    belongs_to :sale, Sale

    timestamps()
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :user_id,
      :customer_id,
      :service_job_id,
      :description,
      :worked_on,
      :minutes,
      :is_billable,
      :hourly_rate,
      :notes
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :user_id,
      :description,
      :worked_on,
      :minutes
    ])
    |> update_change(:description, &String.trim/1)
    |> validate_length(:description, min: 1, max: 300)
    |> validate_number(:minutes, greater_than: 0, less_than_or_equal_to: 1440)
    |> validate_number(:hourly_rate, greater_than_or_equal_to: 0)
    |> put_amount()
    |> foreign_key_constraint(:user_id)
  end

  @doc "Marks the entry as invoiced, against the sale that billed it."
  def bill_changeset(entry, %Sale{} = sale),
    do: change(entry, billed_at: DateTime.utc_now(), sale_id: sale.id)

  @doc "True when this can still be put on an invoice."
  @spec unbilled?(t()) :: boolean()
  def unbilled?(%__MODULE__{is_billable: true, billed_at: nil}), do: true
  def unbilled?(%__MODULE__{}), do: false

  @doc "The entry in hours, for a timesheet that people can read."
  @spec hours(t()) :: Decimal.t()
  def hours(%__MODULE__{minutes: minutes}),
    do: minutes |> Decimal.new() |> Decimal.div(60) |> Decimal.round(2)

  # Money is derived from time and rate rather than typed: a figure entered by
  # hand is a figure that stops matching the hours the moment either changes.
  defp put_amount(changeset) do
    minutes = get_field(changeset, :minutes)
    rate = get_field(changeset, :hourly_rate)
    billable = get_field(changeset, :is_billable)

    if billable && minutes && rate do
      amount =
        rate
        |> Money.mult(Decimal.new(minutes))
        |> Money.div(Decimal.new(60))
        |> Money.round()

      put_change(changeset, :amount, amount)
    else
      put_change(changeset, :amount, Money.zero())
    end
  end
end
