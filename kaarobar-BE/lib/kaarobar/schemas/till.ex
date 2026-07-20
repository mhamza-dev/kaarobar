defmodule Kaarobar.Schemas.Till do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "tills" do
    field :opened_at, :utc_datetime
    field :closed_at, :utc_datetime
    field :opening_cash, :decimal
    field :closing_cash, :decimal
    field :expected_cash, :decimal
    field :status, :string, default: "open"

    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :cashier, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(till, attrs) do
    till
    |> cast(attrs, [:opened_at, :closed_at, :opening_cash, :closing_cash, :expected_cash, :status, :branch_id, :owner_id, :business_id, :cashier_id])
    |> validate_required([:opened_at, :branch_id, :owner_id, :business_id, :cashier_id])
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:cashier_id)
  end
end
