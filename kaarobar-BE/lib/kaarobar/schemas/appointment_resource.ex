defmodule Kaarobar.Schemas.AppointmentResource do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "appointment_resources" do
    belongs_to :appointment, Kaarobar.Schemas.Appointment
    belongs_to :bookable_resource, Kaarobar.Schemas.BookableResource

    timestamps(type: :utc_datetime)
  end

  def changeset(row, attrs) do
    row
    |> cast(attrs, [:appointment_id, :bookable_resource_id])
    |> validate_required([:appointment_id, :bookable_resource_id])
    |> unique_constraint([:appointment_id, :bookable_resource_id])
    |> foreign_key_constraint(:appointment_id)
    |> foreign_key_constraint(:bookable_resource_id)
  end
end
