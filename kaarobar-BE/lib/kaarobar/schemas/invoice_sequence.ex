defmodule Kaarobar.Schemas.InvoiceSequence do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "invoice_sequences" do
    field :next_number, :integer, default: 1

    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :branch, Kaarobar.Schemas.Branch

    timestamps(type: :utc_datetime)
  end

  def changeset(seq, attrs) do
    seq
    |> cast(attrs, [:next_number, :owner_id, :business_id, :branch_id])
    |> validate_required([:next_number, :owner_id, :business_id, :branch_id])
    |> unique_constraint(:branch_id)
  end
end
