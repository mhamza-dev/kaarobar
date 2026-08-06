defmodule Kaarobar.Schemas.JournalLine do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "journal_lines" do
    field :debit, :decimal
    field :credit, :decimal
    field :memo, :string

    belongs_to :journal_entry, Kaarobar.Schemas.JournalEntry
    belongs_to :account, Kaarobar.Schemas.ChartOfAccount

    timestamps(type: :utc_datetime)
  end

  def changeset(line, attrs) do
    line
    |> cast(attrs, [:debit, :credit, :memo, :journal_entry_id, :account_id])
    |> validate_required([:journal_entry_id, :account_id])
    |> foreign_key_constraint(:journal_entry_id)
    |> foreign_key_constraint(:account_id)
  end
end
