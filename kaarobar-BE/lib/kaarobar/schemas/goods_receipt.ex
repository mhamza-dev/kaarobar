defmodule Kaarobar.Schemas.GoodsReceipt do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "goods_receipts" do
    field :status, :string, default: "pending"
    field :notes, :string

    belongs_to :purchase_order, Kaarobar.Schemas.PurchaseOrder
    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :received_by, Kaarobar.Schemas.User

    has_many :items, Kaarobar.Schemas.GoodsReceiptItem

    timestamps(type: :utc_datetime)
  end

  def changeset(gr, attrs) do
    gr
    |> cast(attrs, [:status, :notes, :purchase_order_id, :branch_id, :owner_id, :business_id, :received_by_id])
    |> validate_required([:purchase_order_id, :branch_id, :owner_id, :business_id, :received_by_id])
    |> foreign_key_constraint(:purchase_order_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:received_by_id)
  end
end
