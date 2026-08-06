defmodule Kaarobar.Schemas.ArPayment do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "ar_payments" do
    field :amount, :decimal
    field :method, :string, default: "cash"
    field :paid_at, :utc_datetime
    field :reference, :string

    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :ar_invoice, Kaarobar.Schemas.ArInvoice
    belongs_to :journal_entry, Kaarobar.Schemas.JournalEntry

    timestamps(type: :utc_datetime)
  end

  def changeset(payment, attrs) do
    payment
    |> cast(attrs, [
      :amount,
      :method,
      :paid_at,
      :reference,
      :owner_id,
      :business_id,
      :ar_invoice_id,
      :journal_entry_id
    ])
    |> validate_required([:amount, :method, :paid_at, :owner_id, :business_id, :ar_invoice_id])
    |> validate_inclusion(:method, ["cash", "card", "wallet", "bank"])
  end
end
