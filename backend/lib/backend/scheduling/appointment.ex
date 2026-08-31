defmodule Kaarobar.Scheduling.Appointment do
  @moduledoc """
  A booked visit.

  ## The visit and its services are separate

  One appointment is often a cut *and* a colour, each with its own duration,
  price and commission, sometimes with different staff. Modelling it as a
  single service makes the ordinary salon visit unrepresentable, so the
  appointment holds the window and `Kaarobar.Scheduling.AppointmentService`
  holds the work.

  The appointment's own `starts_at`/`ends_at` span its services — kept so the
  diary can be drawn without loading every line.

  ## A no-show is not a cancellation

  One is the customer telling you; the other is the customer not turning up.
  They are separate timestamps because a salon has to be able to count them
  apart before it can decide whether to start taking deposits.

  ## Walk-ins need no customer record

  Requiring one for somebody who wandered in for a trim turns the busiest hour
  into data entry, so a name is enough and the database agrees.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Sales.Order
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Scheduling.AppointmentService
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(booked confirmed arrived in_progress completed cancelled no_show)
  @sources ~w(walk_in phone online staff)
  # States in which the slot is still held.
  @live_statuses ~w(booked confirmed arrived in_progress)

  schema "appointments" do
    field :number, :string
    field :status, :string, default: "booked"
    field :source, :string, default: "walk_in"

    field :walk_in_name, :string
    field :walk_in_phone, :string

    field :starts_at, :utc_datetime_usec
    field :ends_at, :utc_datetime_usec

    field :notes, :string
    field :internal_notes, :string

    field :confirmed_at, :utc_datetime_usec
    field :arrived_at, :utc_datetime_usec
    field :started_at, :utc_datetime_usec
    field :completed_at, :utc_datetime_usec
    field :cancelled_at, :utc_datetime_usec
    field :cancel_reason, :string
    field :no_show_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :customer, Customer
    belongs_to :order, Order
    belongs_to :sale, Sale
    belongs_to :booked_by, User

    has_many :services, AppointmentService, preload_order: [asc: :position]

    timestamps()
  end

  @doc "The states a booking moves through."
  def statuses, do: @statuses

  @doc "Where the booking came from."
  def sources, do: @sources

  @doc "The states in which the slot is still held."
  def live_statuses, do: @live_statuses

  def changeset(appointment, attrs) do
    appointment
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :customer_id,
      :walk_in_name,
      :walk_in_phone,
      :number,
      :source,
      :starts_at,
      :ends_at,
      :notes,
      :internal_notes,
      :booked_by_id
    ])
    |> validate_required([:organization_id, :business_id, :branch_id, :number, :starts_at])
    |> validate_inclusion(:source, @sources)
    |> validate_who()
    |> validate_period()
    |> unique_constraint(:number, name: :appointments_business_id_number_index)
    |> foreign_key_constraint(:branch_id)
  end

  @doc "Confirms the booking — the customer has said yes."
  def confirm_changeset(appointment),
    do: change(appointment, status: "confirmed", confirmed_at: DateTime.utc_now())

  @doc "The customer is here."
  def arrive_changeset(appointment),
    do: change(appointment, status: "arrived", arrived_at: DateTime.utc_now())

  @doc "Work has begun."
  def start_changeset(appointment),
    do: change(appointment, status: "in_progress", started_at: DateTime.utc_now())

  @doc "Work is finished. Billing is a separate step."
  def complete_changeset(appointment),
    do: change(appointment, status: "completed", completed_at: DateTime.utc_now())

  @doc "The customer called it off. A reason helps the next conversation."
  def cancel_changeset(appointment, reason) do
    change(appointment,
      status: "cancelled",
      cancelled_at: DateTime.utc_now(),
      cancel_reason: reason
    )
  end

  @doc """
  The customer did not turn up.

  Deliberately distinct from a cancellation: a shop cannot decide whether to
  charge deposits without knowing how often this happens as opposed to how
  often people call ahead.
  """
  def no_show_changeset(appointment),
    do: change(appointment, status: "no_show", no_show_at: DateTime.utc_now())

  @doc "Points the booking at the ticket or sale it became."
  def bill_changeset(appointment, attrs),
    do: cast(appointment, attrs, [:order_id, :sale_id])

  @doc "Moves the whole booking. The services move with it."
  def reschedule_changeset(appointment, starts_at, ends_at) do
    appointment
    |> change(starts_at: starts_at, ends_at: ends_at, status: "booked")
    |> validate_period()
  end

  @doc "True when the slot is still held."
  @spec live?(t()) :: boolean()
  def live?(%__MODULE__{status: status}), do: status in @live_statuses

  @doc "Who the booking is for, however they were recorded."
  @spec who(t()) :: String.t()
  def who(%__MODULE__{customer: %Customer{name: name}}), do: name
  def who(%__MODULE__{walk_in_name: name}) when is_binary(name), do: name
  def who(%__MODULE__{}), do: "Walk-in"

  @doc "How long the booking runs, in minutes."
  @spec duration_minutes(t()) :: non_neg_integer()
  def duration_minutes(%__MODULE__{starts_at: nil}), do: 0
  def duration_minutes(%__MODULE__{ends_at: nil}), do: 0

  def duration_minutes(%__MODULE__{} = appointment),
    do: appointment.ends_at |> DateTime.diff(appointment.starts_at, :second) |> div(60) |> max(0)

  defp validate_who(changeset) do
    customer_id = get_field(changeset, :customer_id)
    walk_in = get_field(changeset, :walk_in_name)

    if is_nil(customer_id) and blank?(walk_in) do
      add_error(changeset, :walk_in_name, "or a customer is required")
    else
      changeset
    end
  end

  defp validate_period(changeset) do
    starts = get_field(changeset, :starts_at)
    ends = get_field(changeset, :ends_at)

    if starts && ends && DateTime.compare(ends, starts) != :gt do
      add_error(changeset, :ends_at, "must be after the start")
    else
      changeset
    end
  end

  defp blank?(nil), do: true
  defp blank?(value), do: String.trim(value) == ""
end
