defmodule Kaarobar.Repo.Migrations.CreateDocumentSequences do
  use Ecto.Migration

  @moduledoc """
  Human-readable, gapless numbering for the documents a shop refers to out loud.

  "PO-0042" is what someone says on the phone to a supplier. A UUID is not.

  ## Why gapless, and why it costs a lock

  In most jurisdictions a tax document series may not have holes: a missing
  invoice number is what an auditor asks about first. A sequence taken from a
  Postgres `SEQUENCE` is fast and explicitly *not* gapless — a rolled-back
  transaction consumes a number and leaves a hole.

  So allocation is `UPDATE … SET next_number = next_number + 1 RETURNING`,
  inside the caller's transaction. The row lock held until commit serialises
  concurrent allocations for that one series, and a rollback returns the number
  to the pool. Two tills issuing invoices at the same instant queue for
  microseconds; the alternative is explaining a gap to a tax inspector.

  ## Periods

  `period` lets a series reset — yearly, monthly, or never. A shop that wants
  `INV-2026-0001` starting again each January sets a yearly period; one that
  wants a number that only ever grows leaves it null.
  """

  def change do
    create table(:document_sequences, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      # Null for a series shared across the whole business. Set when each
      # branch numbers its own — which fiscal rules often require.
      add :branch_id, references(:branches, type: :binary_id, on_delete: :delete_all)

      add :document_type, :string, null: false
      add :prefix, :string, null: false, default: ""
      # "2026", "2026-08", or empty for a series that never resets.
      add :period, :string, null: false, default: ""

      add :next_number, :bigint, null: false, default: 1
      add :padding, :integer, null: false, default: 4

      timestamps(type: :utc_datetime_usec)
    end

    # The lock target. Postgres treats NULLs as distinct, so a business-wide
    # series needs its own partial index to stay unique.
    create unique_index(:document_sequences, [:business_id, :document_type, :period],
             where: "branch_id IS NULL",
             name: :document_sequences_business_unique_index
           )

    create unique_index(
             :document_sequences,
             [:business_id, :branch_id, :document_type, :period],
             where: "branch_id IS NOT NULL",
             name: :document_sequences_branch_unique_index
           )

    create constraint(:document_sequences, :document_sequences_next_number_check,
             check: "next_number > 0"
           )

    create constraint(:document_sequences, :document_sequences_padding_check,
             check: "padding >= 0 AND padding <= 12"
           )
  end
end
