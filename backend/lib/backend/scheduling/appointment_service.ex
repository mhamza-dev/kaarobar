defmodule Kaarobar.Scheduling.AppointmentService do
  @moduledoc """
  One piece of work in a visit, holding one resource for a window.

  The resource is on the service rather than the appointment because a cut and
  a colour in the same visit can be different people, and a colour needs a
  basin the cut does not.

  ## Overlap is refused by the database

  A `gist` exclusion constraint on `(resource_id, [starts_at, ends_at))` is what
  actually prevents double-booking. Two receptionists booking the same stylist
  for four o'clock is the ordinary case, and a read-then-write check in the
  application loses that race every time. Cancelled services are excluded from
  the constraint, so a freed slot is immediately rebookable.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Scheduling.Appointment
  alias Kaarobar.Scheduling.Resource
  alias Kaarobar.Tenancy.Business

  @statuses ~w(booked in_progress completed cancelled)

  schema "appointment_services" do
    field :name_snapshot, :string
    field :duration_minutes, :integer
    field :price, :decimal

    field :starts_at, :utc_datetime_usec
    field :ends_at, :utc_datetime_usec

    field :status, :string, default: "booked"
    field :position, :integer, default: 0
    field :notes, :string

    belongs_to :business, Business
    belongs_to :appointment, Appointment
    belongs_to :variant, ProductVariant
    belongs_to :resource, Resource

    timestamps()
  end

  @doc "The states a piece of work moves through."
  def statuses, do: @statuses

  def changeset(service, attrs) do
    service
    |> cast(attrs, [
      :business_id,
      :appointment_id,
      :variant_id,
      :resource_id,
      :name_snapshot,
      :duration_minutes,
      :price,
      :starts_at,
      :ends_at,
      :status,
      :position,
      :notes
    ])
    |> validate_required([
      :business_id,
      :variant_id,
      :resource_id,
      :name_snapshot,
      :duration_minutes,
      :starts_at,
      :ends_at
    ])
    |> validate_number(:duration_minutes, greater_than: 0)
    |> validate_inclusion(:status, @statuses)
    |> validate_period()
    |> exclusion_constraint(:resource_id,
      name: :appointment_services_no_overlap,
      message: "is already booked for that time"
    )
    |> foreign_key_constraint(:resource_id)
    |> foreign_key_constraint(:appointment_id)
  end

  @doc "Frees the slot without removing the record of what was booked."
  def cancel_changeset(service), do: change(service, status: "cancelled")

  defp validate_period(changeset) do
    starts = get_field(changeset, :starts_at)
    ends = get_field(changeset, :ends_at)

    if starts && ends && DateTime.compare(ends, starts) != :gt do
      add_error(changeset, :ends_at, "must be after the start")
    else
      changeset
    end
  end
end
