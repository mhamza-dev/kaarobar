defmodule Kaarobar.Repo.Migrations.SubscriptionPlansAndCampaignPayments do
  use Ecto.Migration

  def change do
    create table(:subscription_plans, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :code, :string, null: false
      add :name, :string, null: false
      add :max_businesses, :integer, null: false, default: 1
      add :max_branches, :integer, null: false, default: 1
      add :max_users, :integer, null: false, default: 3
      add :lemon_variant_id, :string
      add :price_display, :string
      add :price_pkr, :integer
      add :billing_period, :string
      add :tagline, :string
      add :features, {:array, :string}, null: false, default: []
      add :sort_order, :integer, null: false, default: 0
      add :is_active, :boolean, null: false, default: true

      timestamps(type: :utc_datetime)
    end

    create unique_index(:subscription_plans, [:code])

    create table(:campaign_payments, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :amount, :decimal, precision: 14, scale: 2, null: false
      add :currency, :string, null: false, default: "PKR"
      add :status, :string, null: false, default: "pending"
      add :lemon_order_id, :string
      add :lemon_checkout_id, :string
      add :checkout_url, :string
      add :paid_at, :utc_datetime

      add :campaign_id, references(:crm_campaigns, type: :binary_id, on_delete: :delete_all),
        null: false

      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all),
        null: false

      add :owner_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :actor_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:campaign_payments, [:campaign_id])
    create index(:campaign_payments, [:business_id])
    create index(:campaign_payments, [:status])

    create unique_index(:campaign_payments, [:lemon_order_id],
             where: "lemon_order_id IS NOT NULL"
           )
  end
end
