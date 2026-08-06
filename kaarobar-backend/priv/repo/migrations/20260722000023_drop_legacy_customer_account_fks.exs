defmodule Kaarobar.Repo.Migrations.DropLegacyCustomerAccountFks do
  use Ecto.Migration

  def up do
    alter table(:customer_accounts) do
      remove_if_exists :customer_id, :binary_id
      remove_if_exists :business_id, :binary_id
      remove_if_exists :owner_id, :binary_id
    end
  end

  def down do
    alter table(:customer_accounts) do
      add :customer_id, :binary_id
      add :business_id, :binary_id
      add :owner_id, :binary_id
    end
  end
end
