defmodule Kaarobar.Repo.Migrations.CreateDining do
  use Ecto.Migration

  @moduledoc """
  Floors, tables, and the sittings that happen on them.

  ## A table is furniture; a session is trade

  Table 4 exists all day. What matters is the particular group sitting at it
  right now — when they arrived, how many they are, who is serving them, what
  they have run up. Modelling only the table means a table can hold exactly one
  open bill and the day's history is lost the moment it is cleared, so nobody
  can answer "how long did that table take to turn over?" or "who served the
  party that walked out".

  `table_sessions` is that sitting. Its `order_id` points at the ticket, so a
  table's bill is an ordinary open order with all the machinery that already
  exists behind it — splitting, holding, billing — rather than a second,
  parallel notion of an unpaid sale.

  ## Merging and transferring

  Two tables pushed together for a party of eight is one bill on two tables;
  moving a group from the bar to a table is one bill that changes table. Both
  are session moves, not order rewrites — `merged_into_id` keeps the absorbed
  session as a record that those covers were once seated separately, which is
  what the floor plan needs to show and what turnover reporting needs to count.
  """

  def change do
    # ------------------------------------------------------------------ floors
    create table(:floors, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all),
        null: false

      add :name, :string, null: false
      add :position, :integer, null: false, default: 0
      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:floors, [:branch_id])
    create unique_index(:floors, [:branch_id, :name], where: "deleted_at IS NULL")

    # ------------------------------------------------------------------ tables
    create table(:dining_tables, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all),
        null: false

      add :floor_id, references(:floors, type: :binary_id, on_delete: :nilify_all)

      # What the staff call it out loud: "4", "B2", "the window one".
      add :name, :string, null: false
      add :seats, :integer, null: false, default: 4

      # Where it sits on the floor plan. Null means it has not been placed yet,
      # which is normal — a shop lists its tables long before it draws a plan.
      add :position_x, :integer
      add :position_y, :integer
      add :shape, :string, null: false, default: "square"

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:dining_tables, [:branch_id])
    create index(:dining_tables, [:floor_id])
    create unique_index(:dining_tables, [:branch_id, :name], where: "deleted_at IS NULL")

    create constraint(:dining_tables, :dining_tables_seats_check, check: "seats > 0")

    create constraint(:dining_tables, :dining_tables_shape_check,
             check: "shape IN ('square','round','rectangle','booth','bar')"
           )

    # ---------------------------------------------------------------- sessions
    create table(:table_sessions, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :dining_table_id,
          references(:dining_tables, type: :binary_id, on_delete: :restrict),
          null: false

      # The bill. An ordinary open order, so splitting and billing already work.
      add :order_id, references(:orders, type: :binary_id, on_delete: :nilify_all)

      add :status, :string, null: false, default: "open"
      add :covers, :integer, null: false, default: 1
      add :label, :string

      add :opened_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :server_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      add :opened_at, :utc_datetime_usec, null: false
      add :closed_at, :utc_datetime_usec

      # Set when this sitting was absorbed into another — two tables pushed
      # together. The row stays so the covers are still counted where they sat.
      add :merged_into_id, references(:table_sessions, type: :binary_id, on_delete: :nilify_all)

      add :notes, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:table_sessions, [:dining_table_id, :status])
    create index(:table_sessions, [:branch_id, :opened_at])
    create index(:table_sessions, [:order_id])
    create index(:table_sessions, [:server_id])

    # One live sitting per table. Two would mean an order landing on whichever
    # the code happened to find, and a bill nobody can account for.
    create unique_index(:table_sessions, [:dining_table_id],
             where: "status = 'open'",
             name: :table_sessions_single_open_index
           )

    create constraint(:table_sessions, :table_sessions_status_check,
             check: "status IN ('open','billed','closed','merged')"
           )

    create constraint(:table_sessions, :table_sessions_covers_check, check: "covers > 0")

    create constraint(:table_sessions, :table_sessions_closed_check,
             check: "status NOT IN ('closed','merged') OR closed_at IS NOT NULL"
           )

    # --------------------------------- orders gain their table and their course
    alter table(:orders) do
      add :table_session_id,
          references(:table_sessions, type: :binary_id, on_delete: :nilify_all)
    end

    create index(:orders, [:table_session_id])

    alter table(:order_items) do
      # Which course this goes out with. Firing starters before mains is the
      # whole job of a kitchen ticket, and it cannot be inferred from the dish.
      add :course, :integer, null: false, default: 1
      add :kitchen_status, :string, null: false, default: "held"
      add :fired_at, :utc_datetime_usec
      add :ready_at, :utc_datetime_usec
      add :served_at, :utc_datetime_usec
    end

    create constraint(:order_items, :order_items_kitchen_status_check,
             check: "kitchen_status IN ('held','fired','preparing','ready','served','cancelled')"
           )

    create constraint(:order_items, :order_items_course_check, check: "course > 0")
  end
end
