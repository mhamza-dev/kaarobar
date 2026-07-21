defmodule Kaarobar.Repo.Migrations.AttendanceHoursWorked do
  use Ecto.Migration

  def change do
    alter table(:attendance_records) do
      add :hours_worked, :decimal
    end
  end
end
