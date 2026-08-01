defmodule Kaarobar.Repo.Migrations.CreateAppointments do
  use Ecto.Migration

  def change do
    alter table(:businesses) do
      add :appointments_enabled, :boolean, null: false, default: false
    end

    create table(:appointments, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :nothing), null: false
      add :customer_id, references(:customers, type: :binary_id, on_delete: :nilify_all)
      add :product_id, references(:products, type: :binary_id, on_delete: :nothing), null: false
      add :staff_id, references(:employees, type: :binary_id, on_delete: :nothing), null: false
      add :sale_id, references(:sales, type: :binary_id, on_delete: :nilify_all)

      add :starts_at, :utc_datetime, null: false
      add :ends_at, :utc_datetime, null: false
      add :status, :string, null: false, default: "Booked"
      add :notes, :string
      add :booked_by, :string, null: false, default: "staff"

      timestamps(type: :utc_datetime)
    end

    create index(:appointments, [:business_id, :branch_id, :starts_at])
    create index(:appointments, [:owner_id, :business_id])
    create index(:appointments, [:staff_id, :starts_at])
    create index(:appointments, [:customer_id, :starts_at])
    create index(:appointments, [:status])
    create index(:businesses, [:appointments_enabled])
  end
end
