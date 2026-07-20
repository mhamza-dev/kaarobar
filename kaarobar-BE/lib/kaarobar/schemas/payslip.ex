defmodule Kaarobar.Schemas.Payslip do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "payslips" do
    field :gross_pay, :decimal
    field :deductions, :map
    field :net_pay, :decimal

    belongs_to :payroll_run, Kaarobar.Schemas.PayrollRun
    belongs_to :employee, Kaarobar.Schemas.Employee

    timestamps(type: :utc_datetime)
  end

  def changeset(payslip, attrs) do
    payslip
    |> cast(attrs, [:gross_pay, :deductions, :net_pay, :payroll_run_id, :employee_id])
    |> validate_required([:gross_pay, :net_pay, :payroll_run_id, :employee_id])
    |> foreign_key_constraint(:payroll_run_id)
    |> foreign_key_constraint(:employee_id)
  end
end
