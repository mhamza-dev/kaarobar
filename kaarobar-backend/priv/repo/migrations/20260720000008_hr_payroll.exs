defmodule Kaarobar.Repo.Migrations.HrPayroll do
  use Ecto.Migration

  def change do
    alter table(:employees) do
      add :phone, :string
      add :cnic, :string
      add :bank_iban, :string
      add :overtime_rate, :decimal, precision: 5, scale: 2, default: 1.5
    end

    alter table(:payslips) do
      add :earnings, :map
      add :days_worked, :decimal, precision: 8, scale: 2, default: 0
      add :overtime_hours, :decimal, precision: 8, scale: 2, default: 0
    end

    create index(:leave_requests, [:business_id, :status])
    create index(:payroll_runs, [:business_id, :status])
    create index(:attendance_records, [:business_id, :date])
  end
end
