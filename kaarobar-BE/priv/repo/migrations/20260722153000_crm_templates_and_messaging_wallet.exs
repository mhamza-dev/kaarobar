defmodule Kaarobar.Repo.Migrations.CrmTemplatesAndMessagingWallet do
  use Ecto.Migration

  def change do
    alter table(:businesses) do
      add :messaging_wallet_balance, :decimal, precision: 14, scale: 2, null: false, default: 0
    end

    create table(:crm_message_templates, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :name, :string, null: false
      add :channel, :string, null: false, default: "email"
      add :title_template, :string, null: false
      add :body_template, :text, null: false
      add :variables, :map, null: false, default: %{}

      timestamps(type: :utc_datetime)
    end

    create index(:crm_message_templates, [:business_id])

    create table(:messaging_wallet_ledger, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :business_id, references(:businesses, type: :binary_id, on_delete: :delete_all), null: false
      add :owner_id, references(:users, type: :binary_id, on_delete: :nothing), null: false
      add :amount, :decimal, precision: 14, scale: 2, null: false
      add :kind, :string, null: false
      add :note, :string
      add :campaign_id, references(:crm_campaigns, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:messaging_wallet_ledger, [:business_id])

    alter table(:crm_campaigns) do
      add :template_id, references(:crm_message_templates, type: :binary_id, on_delete: :nilify_all)
      add :budget_amount, :decimal, precision: 14, scale: 2
      add :estimated_cost, :decimal, precision: 14, scale: 2
      add :actual_cost, :decimal, precision: 14, scale: 2
      add :unit_cost_snapshot, :decimal, precision: 14, scale: 2
    end
  end
end
