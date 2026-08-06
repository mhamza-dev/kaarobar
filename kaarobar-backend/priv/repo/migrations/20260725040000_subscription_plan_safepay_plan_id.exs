defmodule Kaarobar.Repo.Migrations.SubscriptionPlanSafepayPlanId do
  use Ecto.Migration

  def change do
    alter table(:subscription_plans) do
      add :safepay_plan_id, :string
    end
  end
end
