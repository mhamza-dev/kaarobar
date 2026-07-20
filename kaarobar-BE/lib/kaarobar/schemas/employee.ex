defmodule Kaarobar.Schemas.Employee do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "employees" do
    field :employee_code, :string
    field :name, :string
    field :position, :string
    field :join_date, :date
    field :basic_salary, :decimal
    field :allowances, :map
    field :status, :string, default: "active"
    field :phone, :string
    field :cnic, :string
    field :bank_iban, :string
    field :overtime_rate, :decimal, default: Decimal.new("1.5")

    belongs_to :user, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :branch, Kaarobar.Schemas.Branch

    has_many :attendance_records, Kaarobar.Schemas.AttendanceRecord
    has_many :leave_requests, Kaarobar.Schemas.LeaveRequest

    timestamps(type: :utc_datetime)
  end

  def changeset(employee, attrs) do
    employee
    |> cast(attrs, [
      :employee_code,
      :name,
      :position,
      :join_date,
      :basic_salary,
      :allowances,
      :status,
      :phone,
      :cnic,
      :bank_iban,
      :overtime_rate,
      :user_id,
      :business_id,
      :owner_id,
      :branch_id
    ])
    |> validate_required([:employee_code, :name, :join_date, :business_id, :owner_id, :branch_id])
    |> validate_inclusion(:status, ["active", "inactive", "terminated"])
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint([:business_id, :employee_code])
  end
end
