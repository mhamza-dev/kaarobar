defmodule Kaarobar.Schemas.LeaveRequest do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "leave_requests" do
    field :type, :string
    field :start_date, :date
    field :end_date, :date
    field :status, :string, default: "Pending"
    field :reason, :string

    belongs_to :employee, Kaarobar.Schemas.Employee
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :approved_by, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(request, attrs) do
    request
    |> cast(attrs, [:type, :start_date, :end_date, :status, :reason, :employee_id, :owner_id, :business_id, :approved_by_id])
    |> validate_required([:type, :start_date, :end_date, :employee_id, :owner_id, :business_id])
    |> validate_inclusion(:status, ["Pending", "Approved", "Rejected"])
    |> foreign_key_constraint(:employee_id)
  end
end
