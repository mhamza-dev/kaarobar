defmodule Kaarobar.Repo.Migrations.CreateRegisters do
  use Ecto.Migration

  @moduledoc """
  Tills, the shifts worked on them, and the cash that moves in and out.

  ## Why a shift is a first-class record

  Because the question "is the till short?" has to be answerable, and it is
  only answerable against a period with a beginning, an end, and a person's
  name on it. A shift opens with a counted float, accumulates every tender
  taken on that register, and closes with a second count. The difference
  between what the system expected and what was actually in the drawer is the
  single most useful number a shop owner gets each day.

  Expected cash is not stored as one figure but derived from its parts —
  opening float, cash sales, cash refunds, pay-ins, pay-outs, drops — because
  when it is wrong, the shopkeeper needs to see *which* part is wrong.

  ## Cash movements

  Money enters and leaves a drawer for reasons that are not sales: change
  brought in at the start of a rush, a supplier paid in cash, a drop to the
  safe when the drawer gets heavy. Each has to be recorded or the count will
  never balance, and staff will learn to ignore the variance.
  """

  def change do
    create table(:registers, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :name, :string, null: false
      add :code, :string

      # Its own invoice series, which many fiscal regimes require per terminal.
      add :invoice_prefix, :string

      add :receipt_settings, :map, null: false, default: %{}
      add :settings, :map, null: false, default: %{}

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:registers, [:branch_id])
    create index(:registers, [:business_id])

    create unique_index(:registers, [:branch_id, :name], where: "deleted_at IS NULL")

    create unique_index(:registers, [:business_id, :code],
             where: "code IS NOT NULL AND deleted_at IS NULL"
           )

    # The prefix *is* the invoice series. Two tills sharing one would issue
    # numbers into the same run from two counters, and neither series would be
    # gapless — which is the whole reason the series exists.
    create unique_index(:registers, [:business_id, :invoice_prefix],
             where: "invoice_prefix IS NOT NULL AND deleted_at IS NULL",
             name: :registers_business_id_invoice_prefix_index
           )

    # ------------------------------------------------------------------ shifts
    create table(:shifts, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false
      add :register_id, references(:registers, type: :binary_id, on_delete: :restrict), null: false

      add :number, :string, null: false
      add :status, :string, null: false, default: "open"

      add :opened_at, :utc_datetime_usec, null: false
      add :closed_at, :utc_datetime_usec

      add :opened_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :closed_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      # Counted into the drawer at the start.
      add :opening_float, :decimal, precision: 16, scale: 4, null: false, default: 0

      # Running totals, maintained as sales are rung up so a mid-shift X report
      # costs nothing.
      add :sales_count, :integer, null: false, default: 0
      add :gross_sales, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :discount_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :tax_total, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :refund_total, :decimal, precision: 16, scale: 4, null: false, default: 0

      # Per tender, so a card total can be checked against the terminal's own.
      add :tender_totals, :map, null: false, default: %{}

      add :cash_in, :decimal, precision: 16, scale: 4, null: false, default: 0
      add :cash_out, :decimal, precision: 16, scale: 4, null: false, default: 0

      # Counted out of the drawer at the end.
      add :declared_cash, :decimal, precision: 16, scale: 4
      add :declared_tenders, :map
      add :expected_cash, :decimal, precision: 16, scale: 4
      add :cash_variance, :decimal, precision: 16, scale: 4

      add :notes, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:shifts, [:business_id, :number])
    create index(:shifts, [:register_id, :status])
    create index(:shifts, [:branch_id, :opened_at])

    # One open shift per register. Two would mean sales landing in whichever
    # the code happened to pick, and neither drawer ever balancing.
    create unique_index(:shifts, [:register_id],
             where: "status = 'open'",
             name: :shifts_single_open_per_register_index
           )

    create constraint(:shifts, :shifts_status_check,
             check: "status IN ('open','closing','closed')"
           )

    create constraint(:shifts, :shifts_float_check, check: "opening_float >= 0")

    create constraint(:shifts, :shifts_closed_check,
             check: "status <> 'closed' OR closed_at IS NOT NULL"
           )

    # --------------------------------------------------------- cash movements
    create table(:cash_movements, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :shift_id, references(:shifts, type: :binary_id, on_delete: :restrict), null: false

      add :kind, :string, null: false
      # Signed: positive into the drawer, negative out of it.
      add :amount, :decimal, precision: 16, scale: 4, null: false

      add :reason, :string, null: false
      add :reference, :string
      add :note, :text

      add :actor_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :actor_label, :string
      add :occurred_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:cash_movements, [:shift_id, :occurred_at])

    create constraint(:cash_movements, :cash_movements_kind_check,
             check: "kind IN ('pay_in','pay_out','drop','float_adjustment')"
           )

    create constraint(:cash_movements, :cash_movements_amount_check, check: "amount <> 0")
  end
end
