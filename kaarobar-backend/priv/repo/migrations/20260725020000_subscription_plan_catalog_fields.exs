defmodule Kaarobar.Repo.Migrations.SubscriptionPlanCatalogFields do
  use Ecto.Migration

  def change do
    alter table(:subscription_plans) do
      add_if_not_exists :price_pkr, :integer
      add_if_not_exists :billing_period, :string
      add_if_not_exists :tagline, :string
      add_if_not_exists :features, {:array, :string}, null: false, default: []
    end
  end
end
