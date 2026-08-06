defmodule Kaarobar.Repo.Migrations.BusinessBrandingAndPortalNotifications do
  use Ecto.Migration

  def change do
    alter table(:businesses) do
      add :tagline, :string
      add :logo_key, :string
      add :primary_color, :string
      add :marketplace_description, :text
    end

    alter table(:notifications) do
      modify :user_id, :binary_id, null: true, from: :binary_id

      add :customer_account_id,
          references(:customer_accounts, type: :binary_id, on_delete: :delete_all)
    end

    create index(:notifications, [:customer_account_id, :channel, :read_at])

    create constraint(:notifications, :notifications_recipient_xor,
             check: """
             (user_id IS NOT NULL AND customer_account_id IS NULL)
             OR (user_id IS NULL AND customer_account_id IS NOT NULL)
             """
           )
  end
end
