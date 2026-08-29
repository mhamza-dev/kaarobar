defmodule Kaarobar.Repo.Migrations.CreateBusinesses do
  use Ecto.Migration

  @moduledoc """
  A business is one trading entity: a shop, a restaurant, a salon.

  `business_type` is the vertical key from `Kaarobar.Vecrticals`. It decides
  which modules the business can reach, which product kinds its catalog may
  contain and which fields its sales must carry. It is checked in the
  application rather than by a database constraint, because adding a vertical
  must never require a migration.

  `enabled_modules` is an owner's narrowing of that set — a café that never
  does delivery. It can only remove, never add, which the application enforces.
  """

  def change do
    create table(:businesses, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :name, :string, null: false
      add :slug, :citext, null: false
      add :business_type, :string, null: false

      add :currency, :string, size: 3, null: false
      add :timezone, :string, null: false, default: "UTC"
      add :default_locale, :string, null: false, default: "en"

      # Printed on invoices. `license_number` matters for the regulated
      # verticals — a pesticide dealer's licence must appear on the bill.
      add :legal_name, :string
      add :tax_number, :string
      add :license_number, :string

      add :phone, :string
      add :email, :string
      add :website, :string
      add :logo_url, :string
      add :brand_color, :string

      # NULL means "everything this vertical offers". An empty array means the
      # same, so an owner cannot accidentally switch off their whole business.
      add :enabled_modules, {:array, :string}

      # Whether shelf prices already contain tax. Wrong once, wrong on every
      # receipt, so it is explicit rather than inferred from the country.
      add :prices_include_tax, :boolean, null: false, default: false

      add :settings, :map, null: false, default: %{}
      add :receipt_settings, :map, null: false, default: %{}
      add :social, :map, null: false, default: %{}

      add :status, :string, null: false, default: "active"
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:businesses, [:organization_id, :slug], where: "deleted_at IS NULL")
    create index(:businesses, [:organization_id])
    create index(:businesses, [:business_type])

    create constraint(:businesses, :businesses_status_check,
             check: "status IN ('active','suspended','archived')"
           )

    create constraint(:businesses, :businesses_currency_check,
             check: "char_length(currency) = 3"
           )
  end
end
