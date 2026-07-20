defmodule Kaarobar.Repo.Migrations.PlatformIntegrations do
  use Ecto.Migration

  def change do
    alter table(:sales) do
      add :fbr_qr_payload, :text
      add :fbr_reported_at, :utc_datetime
    end

    create index(:sales, [:business_id, :fbr_invoice_no])

    alter table(:notifications) do
      add :read_at, :utc_datetime
      add :title, :string
      add :body, :string
    end

    create index(:notifications, [:user_id, :status])
    create index(:notifications, [:owner_id, :inserted_at])
  end
end
