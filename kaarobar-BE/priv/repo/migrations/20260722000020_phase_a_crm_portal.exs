defmodule Kaarobar.Repo.Migrations.PhaseACrmPortal do
  use Ecto.Migration

  def change do
    alter table(:customers) do
      add :marketing_opt_in_email, :boolean, null: false, default: false
      add :marketing_opt_in_sms, :boolean, null: false, default: false
      add :marketing_opt_in_whatsapp, :boolean, null: false, default: false
      add :portal_enabled, :boolean, null: false, default: false
      add :loyalty_tier_id, :binary_id
    end

    alter table(:businesses) do
      add :portal_self_register, :boolean, null: false, default: false
      add :portal_invite_from_sale, :boolean, null: false, default: true
    end

    create table(:loyalty_tiers, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :name, :string, null: false
      add :min_points, :integer, null: false, default: 0
      add :earn_rate, :decimal, precision: 14, scale: 4, null: false, default: 1
      add :redeem_rate, :decimal, precision: 14, scale: 4, null: false, default: 1

      timestamps(type: :utc_datetime)
    end

    create index(:loyalty_tiers, [:business_id])
    create unique_index(:loyalty_tiers, [:business_id, :name])
    create unique_index(:loyalty_tiers, [:business_id, :min_points])

    create table(:campaign_segments, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :name, :string, null: false
      add :filters, :map, null: false, default: %{}

      timestamps(type: :utc_datetime)
    end

    create index(:campaign_segments, [:business_id])
    create unique_index(:campaign_segments, [:business_id, :name])

    create table(:coupons, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :code, :string, null: false
      add :discount_type, :string, null: false
      add :discount_value, :decimal, precision: 14, scale: 2, null: false
      add :valid_from, :utc_datetime
      add :valid_to, :utc_datetime
      add :usage_limit, :integer
      add :usage_count, :integer, null: false, default: 0
      add :min_cart, :decimal, precision: 14, scale: 2
      add :stackable, :boolean, null: false, default: false
      add :active, :boolean, null: false, default: true

      timestamps(type: :utc_datetime)
    end

    create index(:coupons, [:business_id])
    create unique_index(:coupons, [:business_id, :code])

    alter table(:crm_campaigns) do
      add :channel, :string, null: false, default: "email"
      add :segment_id, references(:campaign_segments, type: :binary_id, on_delete: :nilify_all)
      add :coupon_id, references(:coupons, type: :binary_id, on_delete: :nilify_all)
    end

    create index(:crm_campaigns, [:segment_id])

    alter table(:coupons) do
      add :campaign_id, references(:crm_campaigns, type: :binary_id, on_delete: :nilify_all)
    end

    create table(:coupon_redemptions, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :coupon_id, references(:coupons, type: :binary_id, on_delete: :delete_all), null: false
      add :sale_id, references(:sales, type: :binary_id, on_delete: :delete_all), null: false
      add :customer_id, references(:customers, type: :binary_id, on_delete: :nilify_all)
      add :campaign_id, references(:crm_campaigns, type: :binary_id, on_delete: :nilify_all)
      add :discount_amount, :decimal, precision: 14, scale: 2, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:coupon_redemptions, [:coupon_id])
    create index(:coupon_redemptions, [:sale_id])
    create unique_index(:coupon_redemptions, [:sale_id, :coupon_id])

    # FK from customers to loyalty_tiers after tiers exist
    create index(:customers, [:loyalty_tier_id])

    execute(
      "ALTER TABLE customers ADD CONSTRAINT customers_loyalty_tier_id_fkey FOREIGN KEY (loyalty_tier_id) REFERENCES loyalty_tiers(id) ON DELETE SET NULL",
      "ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_loyalty_tier_id_fkey"
    )

    create table(:customer_accounts, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :customer_id, references(:customers, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :email, :string, null: false
      add :password_hash, :string, null: false
      add :email_verified, :boolean, null: false, default: false
      add :email_verify_token_hash, :string
      add :password_reset_token_hash, :string
      add :password_reset_sent_at, :utc_datetime
      add :mfa_enabled, :boolean, null: false, default: false
      add :totp_secret_enc, :string
      add :last_login_at, :utc_datetime
      add :status, :string, null: false, default: "active"

      timestamps(type: :utc_datetime)
    end

    create unique_index(:customer_accounts, [:customer_id])
    create unique_index(:customer_accounts, [:business_id, :email])
    create index(:customer_accounts, [:owner_id])

    create table(:customer_sessions, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :customer_account_id,
          references(:customer_accounts, type: :binary_id, on_delete: :delete_all),
          null: false

      add :token_hash, :string, null: false
      add :expires_at, :utc_datetime, null: false
      add :revoked_at, :utc_datetime
      add :user_agent, :string

      timestamps(type: :utc_datetime)
    end

    create unique_index(:customer_sessions, [:token_hash])
    create index(:customer_sessions, [:customer_account_id])
  end
end
