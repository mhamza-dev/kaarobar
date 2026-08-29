defmodule Kaarobar.Repo.Migrations.CreateOrganizations do
  use Ecto.Migration

  @moduledoc """
  The tenant root: one owner's account.

  Everything else in the system hangs off an organization, and `organization_id`
  is denormalised onto every tenant table so that both the query-scoping layer
  and the row-level security policies can filter on a single indexed column
  without a join.

  It is also the billing boundary. An owner with a clothing shop and a
  restaurant has one organization, one subscription, and consolidated reporting
  across both.
  """

  def change do
    create table(:organizations, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :owner_id, references(:users, type: :binary_id, on_delete: :restrict), null: false

      add :name, :string, null: false
      add :slug, :citext, null: false

      add :country_code, :string, size: 2
      add :default_currency, :string, size: 3, null: false, default: "PKR"
      add :timezone, :string, null: false, default: "UTC"
      add :default_locale, :string, null: false, default: "en"

      add :status, :string, null: false, default: "active"

      add :settings, :map, null: false, default: %{}

      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:organizations, [:slug], where: "deleted_at IS NULL")
    create index(:organizations, [:owner_id])

    create constraint(:organizations, :organizations_status_check,
             check: "status IN ('active','trialing','past_due','suspended','cancelled')"
           )
  end
end
