defmodule Kaarobar.Repo.Migrations.Phase2OnlinePos do
  use Ecto.Migration

  def change do
    create table(:invoice_sequences, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all), null: false
      add :next_number, :integer, null: false, default: 1

      timestamps(type: :utc_datetime)
    end

    create unique_index(:invoice_sequences, [:branch_id])
    create index(:invoice_sequences, [:business_id])

    create unique_index(:sales, [:branch_id, :invoice_number])

    alter table(:tills) do
      add :over_short, :decimal, default: 0
    end

    alter table(:branches) do
      add :return_window_days, :integer, default: 14, null: false
    end
  end
end
