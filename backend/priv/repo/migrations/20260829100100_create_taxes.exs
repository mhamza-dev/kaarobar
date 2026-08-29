defmodule Kaarobar.Repo.Migrations.CreateTaxes do
  use Ecto.Migration

  @moduledoc """
  Tax rates, and the groups products are assigned to.

  Products point at a *group*, never at a rate. A shop in a place that charges
  both a federal and a provincial tax on the same item has one group holding
  two rates; when a rate changes, one row changes and every product follows.
  Pointing products at rates directly would mean a bulk update of the catalog
  every time a budget is announced.

  `is_compound` is the difference between 5% + 3% = 8% and 3% charged on top of
  the 5%-inclusive amount. Getting it wrong is a rounding error on every line
  of every invoice, so it is a per-rate flag rather than an assumption.

  Rates are `numeric(9,6)` — six decimals, because rates like 0.0825 exist and
  a rate stored as a float would drift.
  """

  def change do
    create table(:taxes, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      add :code, :string
      # What appears on the printed invoice — "GST", "VAT", "Sales Tax".
      add :label, :string

      add :kind, :string, null: false, default: "percentage"
      # A percentage as a fraction: 0.170000 is 17%.
      add :rate, :decimal, precision: 9, scale: 6, null: false

      add :jurisdiction, :string

      # Charged on the running total including earlier taxes, rather than on
      # the net amount.
      add :is_compound, :boolean, null: false, default: false

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:taxes, [:business_id])
    create unique_index(:taxes, [:business_id, :code], where: "code IS NOT NULL AND deleted_at IS NULL")

    create constraint(:taxes, :taxes_kind_check, check: "kind IN ('percentage','fixed')")
    create constraint(:taxes, :taxes_rate_non_negative_check, check: "rate >= 0")

    # ------------------------------------------------------------ tax groups
    create table(:tax_groups, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      add :code, :string

      # Applied to any product that does not name a group of its own.
      add :is_default, :boolean, null: false, default: false
      # For zero-rated and exempt goods — distinct from "no group", which means
      # "nobody has decided yet".
      add :is_exempt, :boolean, null: false, default: false

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:tax_groups, [:business_id])

    create unique_index(:tax_groups, [:business_id, :code],
             where: "code IS NOT NULL AND deleted_at IS NULL"
           )

    # At most one default per business, enforced here rather than by whichever
    # code path happens to run last.
    create unique_index(:tax_groups, [:business_id],
             where: "is_default AND deleted_at IS NULL",
             name: :tax_groups_single_default_index
           )

    # ------------------------------------------------------- group membership
    create table(:tax_group_rates, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :tax_group_id, references(:tax_groups, type: :binary_id, on_delete: :delete_all),
        null: false

      add :tax_id, references(:taxes, type: :binary_id, on_delete: :restrict), null: false

      # Order matters once a compound rate is involved.
      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create unique_index(:tax_group_rates, [:tax_group_id, :tax_id])
    create index(:tax_group_rates, [:tax_id])
  end
end
