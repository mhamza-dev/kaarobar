defmodule Kaarobar.Repo.Migrations.CreateRentals do
  use Ecto.Migration

  @moduledoc """
  Hiring things out: equipment, formal wear, vehicles, party goods.

  ## The stock is not sold, it is lent

  So the ordinary stock ledger cannot answer the question that matters — not
  "how many do we have?" but "how many are here *on the 14th*?". A unit out on
  hire is neither sold nor available, and a shop that models it as either
  double-books its only marquee.

  `rental_units` is the individual thing being lent, because a hire shop tracks
  *this* drill, with its serial number and its dents, not a quantity of drills.

  ## Deposits are held, not taken

  A deposit is the customer's money that the shop is holding against damage. It
  is recorded apart from the hire charge because it usually goes back, and a
  shop that books it as revenue overstates a month's takings and then has to
  find the cash to return it.

  ## Late fees accrue against the agreed return, which never moves

  `due_back_at` is what was agreed. Extending a hire writes a new period rather
  than editing the old one, so "they were four days late" stays true even after
  the shop agrees to let them keep it another week.
  """

  def change do
    create table(:rental_units, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      # What kind of thing it is, from the catalogue.
      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :restrict),
          null: false

      # Which particular one. A hire shop tracks this drill, not a count.
      add :asset_code, :string, null: false
      add :serial_number, :string
      add :condition_notes, :text

      add :status, :string, null: false, default: "available"
      add :daily_rate, :decimal, precision: 16, scale: 4
      add :deposit_amount, :decimal, precision: 16, scale: 4

      add :acquired_on, :date
      add :retired_on, :date
      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:rental_units, [:business_id, :asset_code],
             where: "deleted_at IS NULL"
           )

    create index(:rental_units, [:branch_id, :status])
    create index(:rental_units, [:variant_id])

    create constraint(:rental_units, :rental_units_status_check,
             check: "status IN ('available','on_hire','reserved','maintenance','lost','retired')"
           )

    # ------------------------------------------------------------- agreements
    create table(:rental_agreements, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      # A hire always has a named customer: the shop is handing over property
      # against a promise to bring it back.
      add :customer_id, references(:customers, type: :binary_id, on_delete: :restrict),
        null: false

      add :number, :string, null: false
      add :status, :string, null: false, default: "reserved"

      add :starts_at, :utc_datetime_usec, null: false
      # What was agreed. Never edited — an extension writes a new period.
      add :due_back_at, :utc_datetime_usec, null: false
      add :returned_at, :utc_datetime_usec

      add :hire_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      # Held, not taken. Usually goes back, so booking it as revenue overstates
      # the month and leaves the shop finding cash to return it.
      add :deposit_held, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :deposit_returned, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :late_fee, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :damage_fee, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :sale_id, references(:sales, type: :binary_id, on_delete: :nilify_all)

      add :issued_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :returned_to_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      add :notes, :text
      add :cancelled_at, :utc_datetime_usec
      add :cancel_reason, :string

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:rental_agreements, [:business_id, :number])
    create index(:rental_agreements, [:branch_id, :status, :due_back_at])
    create index(:rental_agreements, [:customer_id])

    create constraint(:rental_agreements, :rental_agreements_status_check,
             check:
               "status IN ('reserved','on_hire','returned','overdue','cancelled','written_off')"
           )

    create constraint(:rental_agreements, :rental_agreements_period_check,
             check: "due_back_at > starts_at"
           )

    create constraint(:rental_agreements, :rental_agreements_amounts_check,
             check:
               "hire_total >= 0 AND deposit_held >= 0 AND late_fee >= 0 AND " <>
                 "damage_fee >= 0 AND deposit_returned >= 0 AND " <>
                 "deposit_returned <= deposit_held"
           )

    # ------------------------------------------------------------------ lines
    create table(:rental_agreement_lines, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :rental_agreement_id,
          references(:rental_agreements, type: :binary_id, on_delete: :delete_all),
          null: false

      add :rental_unit_id,
          references(:rental_units, type: :binary_id, on_delete: :restrict),
          null: false

      add :name_snapshot, :string, null: false
      add :daily_rate, :decimal, precision: 16, scale: 4, null: false
      add :deposit_amount, :decimal, precision: 16, scale: 4, null: false, default: 0

      # The period this particular unit is committed for, copied from the
      # agreement at issue. Denormalised deliberately: the overlap guard below
      # is an index expression, and Postgres forbids subqueries in those — so
      # the dates have to be on the row being indexed.
      #
      # It is also more truthful. A line returned early frees its unit before
      # the agreement ends, so the line's period is the one that governs
      # availability, not the agreement's.
      add :held_from, :utc_datetime_usec, null: false
      add :held_until, :utc_datetime_usec, null: false

      # Per line: a customer returns the ladder and keeps the mixer.
      add :returned_at, :utc_datetime_usec
      add :return_condition, :string
      add :condition_notes, :text

      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create index(:rental_agreement_lines, [:rental_agreement_id])
    create index(:rental_agreement_lines, [:rental_unit_id])

    create constraint(:rental_agreement_lines, :rental_agreement_lines_rate_check,
             check: "daily_rate >= 0 AND deposit_amount >= 0"
           )

    create constraint(:rental_agreement_lines, :rental_agreement_lines_condition_check,
             check:
               "return_condition IS NULL OR " <>
                 "return_condition IN ('good','damaged','lost','late')"
           )

    create constraint(:rental_agreement_lines, :rental_agreement_lines_period_check,
             check: "held_until > held_from"
           )

    # A unit cannot be on two live hires at once. The same reasoning as the
    # appointment guard: a shop with one marquee will otherwise promise it to
    # two weddings, and find out on the Saturday.
    #
    # A returned line is excluded, so bringing something back early frees it
    # immediately rather than leaving it blocked until the date it was due.
    execute """
            ALTER TABLE rental_agreement_lines
            ADD CONSTRAINT rental_lines_one_live_hire
            EXCLUDE USING gist (
              rental_unit_id WITH =,
              tstzrange(held_from, held_until, '[)') WITH &&
            ) WHERE (returned_at IS NULL)
            """,
            "ALTER TABLE rental_agreement_lines DROP CONSTRAINT rental_lines_one_live_hire"
  end
end
