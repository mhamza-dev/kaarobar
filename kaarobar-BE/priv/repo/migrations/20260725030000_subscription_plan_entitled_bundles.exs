defmodule Kaarobar.Repo.Migrations.SubscriptionPlanEntitledBundles do
  use Ecto.Migration

  def change do
    alter table(:subscription_plans) do
      add_if_not_exists :entitled_bundles, :jsonb, null: false, default: fragment("'[]'::jsonb")
    end
  end
end
