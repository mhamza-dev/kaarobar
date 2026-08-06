defmodule Kaarobar.Schemas.StockTransfer do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "stock_transfers" do
    field :status, :string, default: "pending"
    field :notes, :string

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :from_branch, Kaarobar.Schemas.Branch
    belongs_to :to_branch, Kaarobar.Schemas.Branch

    has_many :items, Kaarobar.Schemas.StockTransferItem

    timestamps(type: :utc_datetime)
  end

  def changeset(transfer, attrs) do
    transfer
    |> cast(attrs, [:status, :notes, :business_id, :owner_id, :from_branch_id, :to_branch_id])
    |> validate_required([:business_id, :owner_id, :from_branch_id, :to_branch_id])
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:from_branch_id)
    |> foreign_key_constraint(:to_branch_id)
  end
end
