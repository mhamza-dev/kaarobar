defmodule Kaarobar.Repo.Migrations.NotificationPrefsAndDevices do
  use Ecto.Migration

  def change do
    create table(:notification_preferences, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :email, :boolean, default: true, null: false
      add :in_app, :boolean, default: true, null: false
      add :push, :boolean, default: true, null: false
      add :muted_types, {:array, :string}, default: [], null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:notification_preferences, [:user_id])

    create table(:device_tokens, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :platform, :string, null: false
      add :token, :string, null: false
      add :enabled, :boolean, default: true, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:device_tokens, [:user_id])
    create unique_index(:device_tokens, [:user_id, :token])
    create index(:notifications, [:user_id, :channel, :read_at])
  end
end
