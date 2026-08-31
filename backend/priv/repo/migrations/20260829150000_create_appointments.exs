defmodule Kaarobar.Repo.Migrations.CreateAppointments do
  use Ecto.Migration

  @moduledoc """
  Bookable resources, the appointments made against them, and what the staff
  earn from the work.

  ## A resource is anything there is only one of

  A stylist, a chair, a treatment room, a massage bed. They are one table
  because the booking rule is identical for all of them — two appointments
  cannot hold the same one at the same time — and because a salon routinely
  needs both at once: a colour needs Ayesha *and* a basin, and either being
  busy makes the slot unbookable.

  ## Double-booking is prevented in the database

  An exclusion constraint on the time range, not an application check. Two
  receptionists booking the same stylist for four o'clock is the ordinary case,
  not the edge case, and a `SELECT` followed by an `INSERT` loses that race
  every time. `btree_gist` is enabled for it, because the constraint has to
  cover the resource id (equality) and the period (overlap) together.

  ## Services are separate from the appointment

  One visit is often a cut *and* a colour, each with its own duration, price
  and commission, sometimes with different staff. Modelling the appointment as
  a single service makes the common salon visit unrepresentable.

  ## Commission is calculated at the moment of sale and then frozen

  Rates change. Recomputing last month's commission against this month's rate
  restates what somebody has already been paid, which is the fastest way to
  lose a stylist.
  """

  def change do
    # Needed for the overlap exclusion constraint below: a plain btree index
    # cannot express "same resource AND overlapping period".
    execute "CREATE EXTENSION IF NOT EXISTS btree_gist", "DROP EXTENSION IF EXISTS btree_gist"

    # --------------------------------------------------------------- resources
    create table(:resources, primary_key: false) do
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
      add :kind, :string, null: false, default: "staff"

      # Set when the resource is a person, so their bookings and their
      # commission are the same record.
      add :user_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      add :colour, :string
      add :position, :integer, null: false, default: 0

      # When this resource can be booked, by weekday. Null falls back to the
      # branch's opening hours — most staff work the shop's hours, and making
      # every one of them restate that is how rotas go stale.
      add :working_hours, :map

      # Bookable at all. A room under repair stays in the list, greyed out,
      # rather than disappearing and taking its history with it.
      add :is_bookable, :boolean, null: false, default: true
      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:resources, [:branch_id])
    create index(:resources, [:user_id])
    create unique_index(:resources, [:branch_id, :name], where: "deleted_at IS NULL")

    create constraint(:resources, :resources_kind_check,
             check: "kind IN ('staff','chair','room','equipment','bay','other')"
           )

    # ------------------------------------------------------------ appointments
    create table(:appointments, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :customer_id, references(:customers, type: :binary_id, on_delete: :nilify_all)
      # A walk-in has no customer record and no phone. Requiring one turns the
      # busiest hour into data entry.
      add :walk_in_name, :string
      add :walk_in_phone, :string

      add :number, :string, null: false
      add :status, :string, null: false, default: "booked"
      add :source, :string, null: false, default: "walk_in"

      add :starts_at, :utc_datetime_usec, null: false
      add :ends_at, :utc_datetime_usec, null: false

      add :notes, :text
      add :internal_notes, :text

      # Set when the visit was rung up, so a report can tell a booking that
      # became trade from one that did not.
      add :order_id, references(:orders, type: :binary_id, on_delete: :nilify_all)
      add :sale_id, references(:sales, type: :binary_id, on_delete: :nilify_all)

      add :booked_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :confirmed_at, :utc_datetime_usec
      add :arrived_at, :utc_datetime_usec
      add :started_at, :utc_datetime_usec
      add :completed_at, :utc_datetime_usec
      add :cancelled_at, :utc_datetime_usec
      add :cancel_reason, :string
      # A no-show is not a cancellation: one is the customer telling you, the
      # other is the customer not turning up, and a salon needs to count them
      # separately before it starts charging deposits.
      add :no_show_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:appointments, [:business_id, :number])
    create index(:appointments, [:branch_id, :starts_at])
    create index(:appointments, [:customer_id])
    create index(:appointments, [:business_id, :status, :starts_at])

    create constraint(:appointments, :appointments_status_check,
             check:
               "status IN ('booked','confirmed','arrived','in_progress'," <>
                 "'completed','cancelled','no_show')"
           )

    create constraint(:appointments, :appointments_source_check,
             check: "source IN ('walk_in','phone','online','staff')"
           )

    create constraint(:appointments, :appointments_period_check, check: "ends_at > starts_at")

    create constraint(:appointments, :appointments_who_check,
             check: "customer_id IS NOT NULL OR walk_in_name IS NOT NULL"
           )

    # ----------------------------------------------------- appointment services
    create table(:appointment_services, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :appointment_id,
          references(:appointments, type: :binary_id, on_delete: :delete_all),
          null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      # The resource this particular service holds. A cut and a colour in one
      # visit can be different people, so it belongs on the service and not on
      # the appointment.
      add :resource_id, references(:resources, type: :binary_id, on_delete: :restrict),
        null: false

      add :name_snapshot, :string, null: false
      add :duration_minutes, :integer, null: false
      add :price, :decimal, precision: 16, scale: 4, null: false

      add :starts_at, :utc_datetime_usec, null: false
      add :ends_at, :utc_datetime_usec, null: false

      add :status, :string, null: false, default: "booked"
      add :position, :integer, null: false, default: 0
      add :notes, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:appointment_services, [:appointment_id])
    create index(:appointment_services, [:resource_id, :starts_at])

    create constraint(:appointment_services, :appointment_services_period_check,
             check: "ends_at > starts_at"
           )

    create constraint(:appointment_services, :appointment_services_duration_check,
             check: "duration_minutes > 0"
           )

    create constraint(:appointment_services, :appointment_services_status_check,
             check: "status IN ('booked','in_progress','completed','cancelled')"
           )

    # The double-booking guard. Two receptionists booking the same stylist for
    # four o'clock is the ordinary case, and a read-then-write check loses that
    # race every time. Cancelled services are excluded so a freed slot is
    # immediately rebookable.
    # `tsrange`, not `tstzrange`: Ecto's `:utc_datetime_usec` is a
    # `timestamp without time zone`, so a tstz range would need an implicit
    # cast that depends on the session's TimeZone — which Postgres rejects
    # outright in an index expression, and which would reinterpret the same
    # stored instant differently per connection if it did not.
    execute """
            ALTER TABLE appointment_services
            ADD CONSTRAINT appointment_services_no_overlap
            EXCLUDE USING gist (
              resource_id WITH =,
              tsrange(starts_at, ends_at, '[)') WITH &&
            ) WHERE (status <> 'cancelled')
            """,
            "ALTER TABLE appointment_services DROP CONSTRAINT appointment_services_no_overlap"

    # ------------------------------------------------------- the walk-in queue
    create table(:queue_entries, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :customer_id, references(:customers, type: :binary_id, on_delete: :nilify_all)
      add :name, :string, null: false
      add :phone, :string

      # What they came in for, and who they asked for. Both optional: plenty of
      # people walk in and say "whoever is free".
      add :variant_id, references(:product_variants, type: :binary_id, on_delete: :nilify_all)
      add :requested_resource_id,
          references(:resources, type: :binary_id, on_delete: :nilify_all)

      add :status, :string, null: false, default: "waiting"
      add :position, :integer, null: false, default: 0
      add :notes, :text

      add :joined_at, :utc_datetime_usec, null: false
      add :called_at, :utc_datetime_usec
      add :seated_at, :utc_datetime_usec
      add :left_at, :utc_datetime_usec

      add :appointment_id, references(:appointments, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec)
    end

    create index(:queue_entries, [:branch_id, :status, :position])

    create constraint(:queue_entries, :queue_entries_status_check,
             check: "status IN ('waiting','called','seated','left','no_show')"
           )

    # --------------------------------------------------------- commission rules
    create table(:commission_rules, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      # Narrower rules win: a rule for one stylist on one service beats a rule
      # for that stylist, which beats the shop-wide default.
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all)
      add :variant_id, references(:product_variants, type: :binary_id, on_delete: :delete_all)
      add :category_id, references(:categories, type: :binary_id, on_delete: :delete_all)

      add :basis, :string, null: false, default: "percent_of_net"
      add :rate, :decimal, precision: 9, scale: 6
      add :flat_amount, :decimal, precision: 16, scale: 4

      # Only pay above a monthly threshold, for shops that pay a base wage.
      add :min_sales_amount, :decimal, precision: 16, scale: 4

      add :priority, :integer, null: false, default: 100
      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:commission_rules, [:business_id, :priority])
    create index(:commission_rules, [:user_id])

    create constraint(:commission_rules, :commission_rules_basis_check,
             check: "basis IN ('percent_of_net','percent_of_margin','flat_per_item')"
           )

    create constraint(:commission_rules, :commission_rules_amount_check,
             check: "rate IS NOT NULL OR flat_amount IS NOT NULL"
           )

    # -------------------------------------------------------------- commissions
    create table(:commissions, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :nilify_all)

      add :user_id, references(:users, type: :binary_id, on_delete: :restrict), null: false
      add :sale_id, references(:sales, type: :binary_id, on_delete: :restrict), null: false
      add :sale_item_id, references(:sale_items, type: :binary_id, on_delete: :restrict)

      # Which rule paid it, and at what rate — frozen. Recomputing last month
      # against this month's rate restates what somebody has been paid.
      add :commission_rule_id,
          references(:commission_rules, type: :binary_id, on_delete: :nilify_all)

      add :basis_snapshot, :string, null: false
      add :rate_snapshot, :decimal, precision: 9, scale: 6
      add :base_amount, :decimal, precision: 16, scale: 4, null: false
      add :amount, :decimal, precision: 16, scale: 4, null: false

      add :status, :string, null: false, default: "accrued"
      add :earned_on, :date, null: false
      add :paid_at, :utc_datetime_usec
      add :reversed_at, :utc_datetime_usec
      add :note, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:commissions, [:user_id, :earned_on])
    create index(:commissions, [:business_id, :status, :earned_on])
    create index(:commissions, [:sale_id])

    create unique_index(:commissions, [:sale_item_id, :user_id],
             where: "sale_item_id IS NOT NULL AND reversed_at IS NULL",
             name: :commissions_one_per_line_index
           )

    create constraint(:commissions, :commissions_status_check,
             check: "status IN ('accrued','approved','paid','reversed')"
           )
  end
end
