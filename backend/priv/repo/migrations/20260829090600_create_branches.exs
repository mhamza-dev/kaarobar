defmodule Kaarobar.Repo.Migrations.CreateBranches do
  use Ecto.Migration

  @moduledoc """
  A branch is a physical place: a shop floor, a kitchen, a stockroom.

  Branches are where stock actually sits and where sales actually happen, so
  almost every operational table carries `branch_id` rather than only
  `business_id`. Without that, a two-branch owner cannot answer "how much do I
  have *here*", which is the whole reason they opened a second shop.

  `code` is short and human — `LHR`, `MAIN` — because it is stamped into
  invoice numbers, where a UUID would be useless to the person reading a
  receipt.
  """

  def change do
    create table(:branches, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      # Denormalised from businesses so scoping and row-level security filter
      # on one indexed column rather than joining upward on every query.
      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :name, :string, null: false
      add :code, :string, null: false

      add :address_line1, :string
      add :address_line2, :string
      add :city, :string
      add :state, :string
      add :postal_code, :string
      add :country_code, :string, size: 2

      add :phone, :string
      add :email, :string

      add :latitude, :decimal, precision: 10, scale: 7
      add :longitude, :decimal, precision: 10, scale: 7

      # A branch may sit in a different timezone from its business — a chain
      # with shops either side of a border closes its day at different moments.
      add :timezone, :string

      add :is_main, :boolean, null: false, default: false
      # A stockroom holds stock but never sells; excluding it keeps sales
      # reporting honest.
      add :is_warehouse, :boolean, null: false, default: false

      add :opening_hours, :map, null: false, default: %{}
      add :settings, :map, null: false, default: %{}

      add :status, :string, null: false, default: "active"
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:branches, [:business_id, :code], where: "deleted_at IS NULL")
    create index(:branches, [:business_id])
    create index(:branches, [:organization_id])

    # Exactly one main branch per business, enforced by the database rather
    # than by whichever code path happens to run last.
    create unique_index(:branches, [:business_id],
             where: "is_main AND deleted_at IS NULL",
             name: :branches_single_main_index
           )

    create constraint(:branches, :branches_status_check,
             check: "status IN ('active','suspended','archived')"
           )
  end
end
