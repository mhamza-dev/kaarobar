defmodule Kaarobar.Repo.Migrations.ExpandSuppliersEnterprise do
  use Ecto.Migration

  def change do
    alter table(:suppliers) do
      # Company identity
      add :legal_name, :string
      add :code, :string
      add :tax_id, :string
      add :strn, :string
      add :website, :string
      add :industry, :string
      add :status, :string, null: false, default: "active"
      add :notes, :text
      add :is_preferred, :boolean, null: false, default: false
      add :rating, :integer

      # Primary liaison
      add :contact_name, :string
      add :contact_role, :string
      add :contact_email, :string
      add :contact_phone, :string
      add :contact_mobile, :string
      add :contact_whatsapp, :string
      add :contact_cnic, :string

      # Address
      add :address_line1, :string
      add :address_line2, :string
      add :city, :string
      add :province, :string
      add :postal_code, :string
      add :country, :string, null: false, default: "PK"

      # Commercial terms
      add :payment_method, :string
      add :bank_name, :string
      add :bank_iban, :string
      add :bank_account_title, :string
      add :credit_limit, :decimal, precision: 18, scale: 2
      add :currency, :string, null: false, default: "PKR"
      add :lead_time_days, :integer
      add :minimum_order_amount, :decimal, precision: 18, scale: 2

      # What they supply
      add :catalogs, {:array, :string}, null: false, default: []
      add :brands, {:array, :string}, null: false, default: []
      add :tags, {:array, :string}, null: false, default: []
    end

    create unique_index(:suppliers, [:business_id, :code],
             where: "code is not null",
             name: :suppliers_business_code_unique
           )

    create index(:suppliers, [:business_id, :status])
    create index(:suppliers, [:business_id, :city])

    create constraint(:suppliers, :suppliers_status_allowed,
             check: "status in ('active', 'inactive', 'blocked', 'pending')"
           )

    create constraint(:suppliers, :suppliers_rating_range,
             check: "rating is null or (rating >= 1 and rating <= 5)"
           )
  end
end
