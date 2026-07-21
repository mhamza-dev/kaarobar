defmodule Kaarobar.Schemas.SalePayment do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "sale_payments" do
    field :method, :string
    field :amount, :decimal
    field :reference, :string

    belongs_to :sale, Kaarobar.Schemas.Sale

    timestamps(type: :utc_datetime)
  end

  def changeset(payment, attrs) do
    payment
    |> cast(attrs, [:method, :amount, :reference, :sale_id])
    |> validate_required([:method, :amount, :sale_id])
    |> validate_inclusion(:method, ["cash", "card", "wallet", "khata"])
    |> foreign_key_constraint(:sale_id)
  end
end
