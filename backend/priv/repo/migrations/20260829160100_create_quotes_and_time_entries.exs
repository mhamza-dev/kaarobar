defmodule Kaarobar.Repo.Migrations.CreateQuotesAndTimeEntries do
  use Ecto.Migration

  @moduledoc """
  Professional services: quote the work, do it, bill for it.

  ## A quote is not a sale

  It moves no stock, takes no money and may never be accepted. Most quotes are
  not, which is the whole point of tracking them — a firm that cannot see its
  win rate cannot tell whether it is pricing itself out or leaving money on the
  table.

  Accepting a quote does not create a sale either. It creates the *work*; the
  sale comes when the work is billed, which is often weeks later and rarely for
  exactly the quoted figure.

  ## Time is recorded against the job, not the invoice

  Because it is recorded as it happens, by whoever did it, long before anybody
  decides what to bill. `is_billable` is separate from `billed_at`: work that
  was never chargeable and work not yet charged for look the same on an invoice
  and completely different on a utilisation report.

  ## `rate_snapshot` is frozen

  A rate rise must not silently reprice six weeks of unbilled work already done
  at the old rate.
  """

  def change do
    create table(:quotes, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false
      add :customer_id, references(:customers, type: :binary_id, on_delete: :restrict)

      add :number, :string, null: false
      add :title, :string, null: false
      add :status, :string, null: false, default: "draft"

      add :subtotal, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :discount_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :currency, :string, size: 3, null: false

      # A quote that never expires is one a customer can accept at last year's
      # prices.
      add :valid_until, :date

      add :notes, :text
      add :terms, :text

      add :sent_at, :utc_datetime_usec
      add :accepted_at, :utc_datetime_usec
      add :declined_at, :utc_datetime_usec
      add :decline_reason, :string
      add :expired_at, :utc_datetime_usec

      # The work this quote turned into, and the sale that eventually billed it.
      add :service_job_id, references(:service_jobs, type: :binary_id, on_delete: :nilify_all)
      add :sale_id, references(:sales, type: :binary_id, on_delete: :nilify_all)

      add :created_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:quotes, [:business_id, :number])
    create index(:quotes, [:branch_id, :status])
    create index(:quotes, [:customer_id])

    create constraint(:quotes, :quotes_status_check,
             check: "status IN ('draft','sent','accepted','declined','expired','cancelled')"
           )

    create constraint(:quotes, :quotes_declined_check,
             check: "status <> 'declined' OR decline_reason IS NOT NULL"
           )

    create table(:quote_lines, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :quote_id, references(:quotes, type: :binary_id, on_delete: :delete_all), null: false
      add :variant_id, references(:product_variants, type: :binary_id, on_delete: :nilify_all)

      # Free text as well as a catalogue link: half of professional work is
      # described, not picked from a list.
      add :description, :string, null: false
      add :quantity, :decimal, precision: 16, scale: 4, null: false, default: 1
      add :unit_price, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :discount, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :line_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create index(:quote_lines, [:quote_id])

    create constraint(:quote_lines, :quote_lines_quantity_check, check: "quantity > 0")

    # -------------------------------------------------------------- time entries
    create table(:time_entries, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :nilify_all)

      add :user_id, references(:users, type: :binary_id, on_delete: :restrict), null: false
      add :customer_id, references(:customers, type: :binary_id, on_delete: :nilify_all)
      add :service_job_id, references(:service_jobs, type: :binary_id, on_delete: :nilify_all)

      add :description, :string, null: false
      add :worked_on, :date, null: false
      add :minutes, :integer, null: false

      # Whether it can be charged at all, kept apart from whether it has been.
      # Work that was never chargeable and work not yet charged for look the
      # same on an invoice and completely different on a utilisation report.
      add :is_billable, :boolean, null: false, default: true
      add :hourly_rate, :decimal, precision: 16, scale: 4
      add :amount, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :billed_at, :utc_datetime_usec
      add :sale_id, references(:sales, type: :binary_id, on_delete: :nilify_all)

      add :notes, :text

      timestamps(type: :utc_datetime_usec)
    end

    create index(:time_entries, [:user_id, :worked_on])
    create index(:time_entries, [:service_job_id])
    create index(:time_entries, [:customer_id, :worked_on])

    # The billing run's query: what is chargeable and not yet charged.
    create index(:time_entries, [:business_id, :worked_on],
             where: "is_billable AND billed_at IS NULL",
             name: :time_entries_unbilled_index
           )

    create constraint(:time_entries, :time_entries_minutes_check,
             check: "minutes > 0 AND minutes <= 1440"
           )

    create constraint(:time_entries, :time_entries_amount_check, check: "amount >= 0")
  end
end
