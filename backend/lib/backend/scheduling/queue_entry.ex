defmodule Kaarobar.Scheduling.QueueEntry do
  @moduledoc """
  Somebody waiting without a booking.

  A salon runs on both at once: a diary of appointments and a bench of people
  who walked in. Keeping the queue separate from `Kaarobar.Scheduling.Appointment`
  means a waiting customer holds no slot and blocks nobody — which is the whole
  difference between waiting and being booked.

  Seating one turns it into an appointment, and `appointment_id` records that,
  so the wait time from joining to being seated is measurable.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Scheduling.Appointment
  alias Kaarobar.Scheduling.Resource
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(waiting called seated left no_show)

  schema "queue_entries" do
    field :name, :string
    field :phone, :string
    field :status, :string, default: "waiting"
    field :position, :integer, default: 0
    field :notes, :string

    field :joined_at, :utc_datetime_usec
    field :called_at, :utc_datetime_usec
    field :seated_at, :utc_datetime_usec
    field :left_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :customer, Customer
    belongs_to :variant, ProductVariant
    belongs_to :requested_resource, Resource
    belongs_to :appointment, Appointment

    timestamps()
  end

  @doc "The states someone waiting moves through."
  def statuses, do: @statuses

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :customer_id,
      :name,
      :phone,
      :variant_id,
      :requested_resource_id,
      :position,
      :notes
    ])
    |> validate_required([:organization_id, :business_id, :branch_id, :name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 120)
    |> put_joined_at()
    |> foreign_key_constraint(:branch_id)
  end

  @doc "Their turn — someone has called them over."
  def call_changeset(entry),
    do: change(entry, status: "called", called_at: DateTime.utc_now())

  @doc "Seated, and now an appointment."
  def seat_changeset(entry, %Appointment{} = appointment) do
    change(entry,
      status: "seated",
      seated_at: DateTime.utc_now(),
      appointment_id: appointment.id
    )
  end

  @doc "Gave up and went home. Worth counting."
  def leave_changeset(entry, status \\ "left")

  def leave_changeset(entry, status) when status in ["left", "no_show"],
    do: change(entry, status: status, left_at: DateTime.utc_now())

  @doc "True when they are still on the bench."
  @spec waiting?(t()) :: boolean()
  def waiting?(%__MODULE__{status: status}), do: status in ["waiting", "called"]

  @doc """
  How long they have waited, in minutes.

  From joining to being seated, or to now if they are still there — the number
  a shop needs before it can promise anyone a time.
  """
  @spec minutes_waiting(t(), DateTime.t()) :: non_neg_integer()
  def minutes_waiting(%__MODULE__{joined_at: nil}, _now), do: 0

  def minutes_waiting(%__MODULE__{} = entry, now) do
    finish = entry.seated_at || entry.left_at || now
    finish |> DateTime.diff(entry.joined_at, :second) |> div(60) |> max(0)
  end

  defp put_joined_at(changeset) do
    case get_field(changeset, :joined_at) do
      nil -> put_change(changeset, :joined_at, DateTime.utc_now())
      _set -> changeset
    end
  end
end
