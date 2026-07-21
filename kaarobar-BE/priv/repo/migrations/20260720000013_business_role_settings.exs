defmodule Kaarobar.Repo.Migrations.BusinessRoleSettings do
  use Ecto.Migration

  def change do
    create table(:business_role_settings, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :role, :string, null: false
      add :bundle, :string, null: false
      add :allowed, :boolean, null: false, default: true

      timestamps(type: :utc_datetime)
    end

    create index(:business_role_settings, [:business_id])
    create index(:business_role_settings, [:owner_id])
    create unique_index(:business_role_settings, [:business_id, :role, :bundle])
  end
end
