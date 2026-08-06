defmodule Kaarobar.Schemas.AttendanceRecord do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "attendance_records" do
    field :date, :date
    field :clock_in, :utc_datetime
    field :clock_out, :utc_datetime
    field :hours_worked, :decimal
    field :source, :string, default: "pos"

    belongs_to :employee, Kaarobar.Schemas.Employee
    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business

    timestamps(type: :utc_datetime)
  end

  def changeset(record, attrs) do
    record
    |> cast(attrs, [
      :date,
      :clock_in,
      :clock_out,
      :hours_worked,
      :source,
      :employee_id,
      :branch_id,
      :owner_id,
      :business_id
    ])
    |> validate_required([:date, :employee_id, :branch_id, :owner_id, :business_id])
    |> foreign_key_constraint(:employee_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint([:employee_id, :date])
  end
end
