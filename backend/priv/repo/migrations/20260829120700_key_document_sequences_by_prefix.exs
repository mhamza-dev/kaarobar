defmodule Kaarobar.Repo.Migrations.KeyDocumentSequencesByPrefix do
  use Ecto.Migration

  @moduledoc """
  Makes the prefix part of what identifies a series.

  Until now a series was keyed by business, branch, document type and period.
  That was enough while every document of a type shared one prefix. It stops
  being enough the moment a till issues into its own invoice series: two
  registers, `C1` and `C2`, would find the same counter row and draw from it
  alternately — producing `C1-0001`, `C2-0002`, `C1-0003`. Both series would
  have holes, which is precisely what a gapless sequence exists to prevent, and
  precisely what an auditor asks about.

  With the prefix in the key, each series gets its own counter and its own
  unbroken run of numbers.
  """

  def change do
    drop unique_index(:document_sequences, [:business_id, :document_type, :period],
           where: "branch_id IS NULL",
           name: :document_sequences_business_unique_index
         )

    drop unique_index(
           :document_sequences,
           [:business_id, :branch_id, :document_type, :period],
           where: "branch_id IS NOT NULL",
           name: :document_sequences_branch_unique_index
         )

    create unique_index(
             :document_sequences,
             [:business_id, :document_type, :prefix, :period],
             where: "branch_id IS NULL",
             name: :document_sequences_business_unique_index
           )

    create unique_index(
             :document_sequences,
             [:business_id, :branch_id, :document_type, :prefix, :period],
             where: "branch_id IS NOT NULL",
             name: :document_sequences_branch_unique_index
           )
  end
end
