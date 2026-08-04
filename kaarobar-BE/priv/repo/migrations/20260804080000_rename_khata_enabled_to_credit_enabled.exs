defmodule Kaarobar.Repo.Migrations.RenameKhataEnabledToCreditEnabled do
  use Ecto.Migration

  def up do
    rename table(:customers), :khata_enabled, to: :credit_enabled

    execute("""
    UPDATE sale_payments
    SET method = 'credit'
    WHERE method = 'khata'
    """)

    execute("""
    UPDATE crm_campaigns
    SET audience = 'credit'
    WHERE audience = 'khata'
    """)
  end

  def down do
    execute("""
    UPDATE crm_campaigns
    SET audience = 'khata'
    WHERE audience = 'credit'
    """)

    execute("""
    UPDATE sale_payments
    SET method = 'khata'
    WHERE method = 'credit'
    """)

    rename table(:customers), :credit_enabled, to: :khata_enabled
  end
end
