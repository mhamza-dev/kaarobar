defmodule Kaarobar.Repo.Migrations.ReturnsTillsProcurement do
  use Ecto.Migration

  def change do
    alter table(:sale_returns) do
      add :refund_method, :string, default: "cash", null: false
      add :till_id, references(:tills, type: :binary_id, on_delete: :nilify_all)
      add :rejected_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :rejection_reason, :string
    end

    create index(:sale_returns, [:till_id])
    create index(:sale_returns, [:status, :branch_id])

    # One open till per branch
    create unique_index(:tills, [:branch_id],
      where: "status = 'open'",
      name: :tills_one_open_per_branch_index
    )

    # Idempotent auto-journals by source
    create unique_index(:journal_entries, [:source_type, :source_id],
      where: "source_id IS NOT NULL",
      name: :journal_entries_source_unique_index
    )
  end
end
