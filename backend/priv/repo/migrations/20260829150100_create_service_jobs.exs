defmodule Kaarobar.Repo.Migrations.CreateServiceJobs do
  use Ecto.Migration

  @moduledoc """
  Work taken in, done, and given back: laundry, ironing, tailoring, phone and
  appliance repair, watch and shoe work.

  ## The shop is holding the customer's property

  That is what separates this from every other kind of sale, and it drives the
  whole design. Each item gets its own row and its own tag, because a customer
  brings in nine shirts and a coat and comes back for the coat first. Each
  carries a rack location, because "it is here somewhere" is the failure mode
  that loses a customer for good. Each carries the condition it arrived in,
  because the argument about the stain that was already there is the one
  argument this trade always has.

  ## A job is not a sale

  Money is usually taken on collection, sometimes in advance, occasionally in
  part. So the job stands alone and a sale attaches to it when one happens —
  which also means the intake ticket can be printed and the garment tagged
  before anybody has decided what to charge.

  ## Ready-by is a promise, not a status

  `promised_on` is set at intake and never moves. A shop that overwrites it
  when work runs late can never see that it runs late, and the customer who was
  told Tuesday is the only person who remembers.
  """

  def change do
    create table(:service_jobs, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :customer_id, references(:customers, type: :binary_id, on_delete: :restrict)
      # A walk-in with no account. Requiring a customer record for a man
      # dropping off two shirts is how a queue forms.
      add :walk_in_name, :string
      add :walk_in_phone, :string

      add :number, :string, null: false
      add :status, :string, null: false, default: "intake"
      add :priority, :string, null: false, default: "normal"

      # Set at intake and never moved. A shop that rewrites its promise when
      # work runs late can never see that it runs late.
      add :promised_on, :date
      add :promised_at, :utc_datetime_usec

      add :received_at, :utc_datetime_usec, null: false
      add :started_at, :utc_datetime_usec
      add :ready_at, :utc_datetime_usec
      add :delivered_at, :utc_datetime_usec
      add :cancelled_at, :utc_datetime_usec
      add :cancel_reason, :string

      add :received_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :assigned_to_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :delivered_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      # Quoted at intake; the sale is what was actually charged. Both are kept
      # so a shop can see how often it quotes low.
      add :quoted_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :advance_paid, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :sale_id, references(:sales, type: :binary_id, on_delete: :nilify_all)

      # Where the finished work is waiting. The single most useful field on the
      # table: a job that is ready but unfindable is a job that is not ready.
      add :rack_location, :string

      # Collection or delivery, and where to.
      add :fulfilment, :string, null: false, default: "collection"
      add :delivery_address, :text
      add :delivery_notes, :text

      add :notes, :text
      add :internal_notes, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:service_jobs, [:business_id, :number])
    # The counter's query: what is ready, what is late, what is due today.
    create index(:service_jobs, [:branch_id, :status, :promised_on])
    create index(:service_jobs, [:customer_id])
    create index(:service_jobs, [:assigned_to_id, :status])
    create index(:service_jobs, [:rack_location], where: "rack_location IS NOT NULL")

    create constraint(:service_jobs, :service_jobs_status_check,
             check:
               "status IN ('intake','in_progress','ready','delivered'," <>
                 "'cancelled','on_hold')"
           )

    create constraint(:service_jobs, :service_jobs_priority_check,
             check: "priority IN ('normal','express','urgent')"
           )

    create constraint(:service_jobs, :service_jobs_fulfilment_check,
             check: "fulfilment IN ('collection','delivery')"
           )

    create constraint(:service_jobs, :service_jobs_who_check,
             check: "customer_id IS NOT NULL OR walk_in_name IS NOT NULL"
           )

    create constraint(:service_jobs, :service_jobs_advance_check,
             check: "advance_paid >= 0 AND quoted_total >= 0"
           )

    create constraint(:service_jobs, :service_jobs_cancel_check,
             check: "status <> 'cancelled' OR cancel_reason IS NOT NULL"
           )

    # -------------------------------------------------------------- job items
    create table(:service_job_items, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :service_job_id,
          references(:service_jobs, type: :binary_id, on_delete: :delete_all),
          null: false

      # The service being done to it, when it is one from the catalogue.
      add :variant_id, references(:product_variants, type: :binary_id, on_delete: :nilify_all)

      # What the thing is: "blue cotton shirt", "Samsung A54", "brown brogues".
      add :description, :string, null: false
      add :quantity, :decimal, precision: 16, scale: 4, null: false, default: 1
      add :unit_price, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :line_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      # The tag that goes on the garment. Unique within the business, because
      # it is scanned to find one item among four hundred.
      add :tag_code, :string

      # What it looked like coming in. The argument about the stain that was
      # already there is the one this trade always has.
      add :condition_notes, :text
      add :condition_photo_paths, {:array, :string}, null: false, default: []

      add :colour, :string
      add :brand, :string
      add :serial_number, :string

      # Per item, because a customer collects the coat before the shirts.
      add :status, :string, null: false, default: "intake"
      add :rack_location, :string
      add :ready_at, :utc_datetime_usec
      add :delivered_at, :utc_datetime_usec

      add :position, :integer, null: false, default: 0
      add :notes, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:service_job_items, [:service_job_id])

    create unique_index(:service_job_items, [:business_id, :tag_code],
             where: "tag_code IS NOT NULL"
           )

    create constraint(:service_job_items, :service_job_items_quantity_check,
             check: "quantity > 0"
           )

    create constraint(:service_job_items, :service_job_items_status_check,
             check: "status IN ('intake','in_progress','ready','delivered','lost','damaged')"
           )

    # ------------------------------------------------------------ job history
    #
    # An append-only trail of what happened to the customer's property while
    # the shop had it. Separate from the audit log because the customer is
    # entitled to see this one — "where is my coat?" is answered from here.
    create table(:service_job_events, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :service_job_id,
          references(:service_jobs, type: :binary_id, on_delete: :delete_all),
          null: false

      add :service_job_item_id,
          references(:service_job_items, type: :binary_id, on_delete: :delete_all)

      add :kind, :string, null: false
      add :summary, :string, null: false
      add :detail, :text

      add :actor_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :actor_label, :string
      add :occurred_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:service_job_events, [:service_job_id, :occurred_at])

    create constraint(:service_job_events, :service_job_events_kind_check,
             check:
               "kind IN ('received','started','ready','delivered','cancelled'," <>
                 "'moved','note','issue','notified')"
           )
  end
end
