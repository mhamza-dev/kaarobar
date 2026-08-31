defmodule Kaarobar.Repo.Migrations.CreateKitchen do
  use Ecto.Migration

  @moduledoc """
  The kitchen display: what to cook, where, and in what order.

  ## Why a ticket is not just the order

  One order becomes several tickets, because one order goes to several places.
  A burger, a salad and two coffees are three stations working in parallel, and
  the grill must not have to read past the drinks to find its own work. Routing
  by station is the entire reason a KDS exists rather than a printer.

  Splitting also means each station can be bumped independently, which is what
  lets the pass see that the grill is done and the fryer is not — the question
  every expediter is actually asking.

  ## Courses fire, they do not queue

  `course` on the order line decides *when* the ticket is made, not what is on
  it. Starters fire on order; mains fire when the table is ready for them,
  which is a judgement someone makes at the pass. A kitchen that starts
  everything at once sends cold mains, so firing is an explicit act with a time
  on it.

  ## The clock is on the ticket

  `fired_at` and `bumped_at` are what "how long is that table waiting?" is
  computed from. Storing an elapsed figure instead would be a number that stops
  being true the moment it is written.
  """

  def change do
    create table(:kitchen_stations, primary_key: false) do
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
      add :code, :string
      add :position, :integer, null: false, default: 0

      # Minutes this station usually takes, for the pass to sequence courses.
      add :prep_minutes, :integer

      # The screen this station's tickets appear on. Several stations can share
      # one screen in a small kitchen; a big one gives each its own.
      add :display_group, :string

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:kitchen_stations, [:branch_id])
    create unique_index(:kitchen_stations, [:branch_id, :name], where: "deleted_at IS NULL")

    # The catalog phase carried a free-text `kitchen_station` as a placeholder
    # for exactly this. A typed label cannot route: "Grill" and "grill " are two
    # stations, and neither can be renamed without editing every product. It is
    # replaced rather than kept alongside, because two fields meaning the same
    # thing is how a dish ends up on the wrong screen.
    alter table(:products) do
      add :kitchen_station_id,
          references(:kitchen_stations, type: :binary_id, on_delete: :nilify_all)

      remove :kitchen_station, :string
    end

    create index(:products, [:kitchen_station_id])

    # --------------------------------------------------------------- tickets
    create table(:kitchen_tickets, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :kitchen_station_id,
          references(:kitchen_stations, type: :binary_id, on_delete: :restrict),
          null: false

      add :order_id, references(:orders, type: :binary_id, on_delete: :restrict), null: false

      add :number, :string, null: false
      add :status, :string, null: false, default: "fired"
      add :course, :integer, null: false, default: 1

      # Copied from the order so the screen needs no joins to say where the food
      # is going — and still reads correctly after the table has been cleared.
      add :table_label, :string
      add :service_mode, :string
      add :server_label, :string

      # A rush ticket jumps the queue. Rare, and worth being explicit about.
      add :is_priority, :boolean, null: false, default: false
      add :notes, :text

      add :fired_at, :utc_datetime_usec, null: false
      add :started_at, :utc_datetime_usec
      add :bumped_at, :utc_datetime_usec
      add :bumped_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :recalled_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:kitchen_tickets, [:business_id, :number])
    # The kitchen display's own query: what is live at this station, oldest and
    # most urgent first.
    create index(:kitchen_tickets, [:kitchen_station_id, :status, :fired_at])
    create index(:kitchen_tickets, [:order_id])
    create index(:kitchen_tickets, [:branch_id, :fired_at])

    create constraint(:kitchen_tickets, :kitchen_tickets_status_check,
             check: "status IN ('fired','preparing','ready','bumped','cancelled')"
           )

    create constraint(:kitchen_tickets, :kitchen_tickets_bumped_check,
             check: "status <> 'bumped' OR bumped_at IS NOT NULL"
           )

    create table(:kitchen_ticket_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :kitchen_ticket_id,
          references(:kitchen_tickets, type: :binary_id, on_delete: :delete_all),
          null: false

      add :order_item_id,
          references(:order_items, type: :binary_id, on_delete: :restrict),
          null: false

      # Snapshotted: a ticket already on a screen must not change because
      # someone renamed the dish, and the modifiers are the instruction.
      add :name_snapshot, :string, null: false
      add :quantity, :decimal, precision: 16, scale: 4, null: false
      add :modifiers_snapshot, {:array, :string}, null: false, default: []
      add :note, :text
      add :seat_number, :integer

      add :status, :string, null: false, default: "fired"
      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create index(:kitchen_ticket_items, [:kitchen_ticket_id])
    create index(:kitchen_ticket_items, [:order_item_id])

    create constraint(:kitchen_ticket_items, :kitchen_ticket_items_status_check,
             check: "status IN ('fired','preparing','ready','bumped','cancelled')"
           )

    create constraint(:kitchen_ticket_items, :kitchen_ticket_items_quantity_check,
             check: "quantity > 0"
           )

    # ------------------------------------------------------------- deliveries
    create table(:deliveries, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      # A delivery hangs off whichever exists: an open ticket before it is paid
      # for, a sale after. Both, in the usual case where it is paid on order.
      add :order_id, references(:orders, type: :binary_id, on_delete: :nilify_all)
      add :sale_id, references(:sales, type: :binary_id, on_delete: :nilify_all)
      add :customer_id, references(:customers, type: :binary_id, on_delete: :nilify_all)

      add :number, :string, null: false
      add :status, :string, null: false, default: "pending"

      add :rider_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :rider_label, :string

      # Copied, not joined: an address edited next week must not change where
      # last week's order was recorded as going.
      add :address_snapshot, :text, null: false
      add :phone_snapshot, :string
      add :delivery_notes, :text
      add :latitude, :decimal, precision: 10, scale: 7
      add :longitude, :decimal, precision: 10, scale: 7

      add :fee, :decimal, precision: 16, scale: 4, null: false, default: 0
      # What the rider collected at the door, for a cash-on-delivery order.
      add :collected_amount, :decimal, precision: 16, scale: 4

      add :promised_at, :utc_datetime_usec
      add :assigned_at, :utc_datetime_usec
      add :picked_up_at, :utc_datetime_usec
      add :delivered_at, :utc_datetime_usec
      add :failed_at, :utc_datetime_usec
      add :failure_reason, :string

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:deliveries, [:business_id, :number])
    create index(:deliveries, [:branch_id, :status])
    create index(:deliveries, [:rider_user_id, :status])
    create index(:deliveries, [:order_id])
    create index(:deliveries, [:sale_id])

    create constraint(:deliveries, :deliveries_status_check,
             check:
               "status IN ('pending','assigned','picked_up','delivered','failed','cancelled')"
           )

    create constraint(:deliveries, :deliveries_fee_check, check: "fee >= 0")

    create constraint(:deliveries, :deliveries_failed_check,
             check: "status <> 'failed' OR failure_reason IS NOT NULL"
           )
  end
end
