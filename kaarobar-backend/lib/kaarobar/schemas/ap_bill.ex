defmodule Kaarobar.Schemas.ApBill do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "ap_bills" do
    field :bill_number, :string
    field :bill_date, :date
    field :due_date, :date
    field :total_amount, :decimal
    field :balance_due, :decimal
    field :status, :string, default: "open"
    field :notes, :string
    field :source_type, :string
    field :source_id, :binary_id

    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :supplier, Kaarobar.Schemas.Supplier
    belongs_to :journal_entry, Kaarobar.Schemas.JournalEntry

    has_many :payments, Kaarobar.Schemas.ApPayment

    timestamps(type: :utc_datetime)
  end

  def changeset(bill, attrs) do
    bill
    |> cast(attrs, [
      :bill_number,
      :bill_date,
      :due_date,
      :total_amount,
      :balance_due,
      :status,
      :notes,
      :source_type,
      :source_id,
      :owner_id,
      :business_id,
      :branch_id,
      :supplier_id,
      :journal_entry_id
    ])
    |> validate_required([
      :bill_number,
      :bill_date,
      :total_amount,
      :balance_due,
      :owner_id,
      :business_id,
      :supplier_id
    ])
    |> validate_inclusion(:status, ["open", "partial", "paid", "void"])
    |> unique_constraint([:business_id, :bill_number])
  end
end
