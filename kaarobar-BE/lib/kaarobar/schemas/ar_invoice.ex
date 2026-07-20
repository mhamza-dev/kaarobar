defmodule Kaarobar.Schemas.ArInvoice do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "ar_invoices" do
    field :invoice_number, :string
    field :invoice_date, :date
    field :due_date, :date
    field :subtotal, :decimal
    field :tax_amount, :decimal
    field :total_amount, :decimal
    field :balance_due, :decimal
    field :status, :string, default: "open"
    field :notes, :string

    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :customer, Kaarobar.Schemas.Customer
    belongs_to :journal_entry, Kaarobar.Schemas.JournalEntry

    has_many :payments, Kaarobar.Schemas.ArPayment

    timestamps(type: :utc_datetime)
  end

  def changeset(invoice, attrs) do
    invoice
    |> cast(attrs, [
      :invoice_number,
      :invoice_date,
      :due_date,
      :subtotal,
      :tax_amount,
      :total_amount,
      :balance_due,
      :status,
      :notes,
      :owner_id,
      :business_id,
      :branch_id,
      :customer_id,
      :journal_entry_id
    ])
    |> validate_required([
      :invoice_number,
      :invoice_date,
      :subtotal,
      :tax_amount,
      :total_amount,
      :balance_due,
      :owner_id,
      :business_id,
      :customer_id
    ])
    |> validate_inclusion(:status, ["open", "partial", "paid", "void"])
    |> unique_constraint([:business_id, :invoice_number])
  end
end
