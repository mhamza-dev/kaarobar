defmodule Kaarobar.Repo.Migrations.CustomersLoyaltyCrm do
  use Ecto.Migration

  def change do
    alter table(:customers) do
      add :address, :string
      add :notes, :text
      add :credit_limit, :decimal, precision: 14, scale: 2
      add :cnic, :string
      add :ntn, :string
      add :company_name, :string
      add :user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
    end

    create index(:customers, [:user_id])

    create unique_index(:customers, [:business_id, :phone],
             name: :customers_business_id_phone_index,
             where: "phone IS NOT NULL AND phone <> ''"
           )

    alter table(:businesses) do
      add :loyalty_earn_per_amount, :decimal, precision: 14, scale: 2, null: false, default: 100
      add :loyalty_points_per_earn, :integer, null: false, default: 1
      add :loyalty_redeem_value, :decimal, precision: 14, scale: 2, null: false, default: 1.00
    end

    create table(:crm_campaigns, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :created_by_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :name, :string, null: false
      add :title, :string, null: false
      add :message, :text, null: false
      add :audience, :string, null: false, default: "all"
      add :min_points, :integer
      add :status, :string, null: false, default: "Draft"
      add :sent_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:crm_campaigns, [:business_id, :owner_id])
    create index(:crm_campaigns, [:status])

    create table(:crm_campaign_recipients, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :campaign_id, references(:crm_campaigns, type: :binary_id, on_delete: :delete_all),
        null: false

      add :customer_id, references(:customers, type: :binary_id, on_delete: :delete_all), null: false
      add :user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :channel_status, :string, null: false, default: "skipped_no_user"
      add :delivered_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:crm_campaign_recipients, [:campaign_id])
    create unique_index(:crm_campaign_recipients, [:campaign_id, :customer_id])
  end
end
