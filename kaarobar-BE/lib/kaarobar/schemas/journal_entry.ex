defmodule Kaarobar.Schemas.JournalEntry do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "journal_entries" do
    field :date, :date
    field :source_type, :string
    field :source_id, :binary_id
    field :description, :string
    field :is_locked, :boolean, default: false

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :posted_by, Kaarobar.Schemas.User
    belongs_to :reversed_entry, Kaarobar.Schemas.JournalEntry

    has_many :lines, Kaarobar.Schemas.JournalLine

    timestamps(type: :utc_datetime)
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [:date, :source_type, :source_id, :description, :is_locked, :business_id, :owner_id, :branch_id, :posted_by_id, :reversed_entry_id])
    |> validate_required([:date, :business_id, :owner_id, :posted_by_id])
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:posted_by_id)
  end
end
