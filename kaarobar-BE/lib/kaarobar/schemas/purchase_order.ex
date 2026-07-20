defmodule Kaarobar.Schemas.PurchaseOrder do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "purchase_orders" do
    field :status, :string, default: "draft"
    field :expected_delivery_date, :date
    field :notes, :string

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :supplier, Kaarobar.Schemas.Supplier

    has_many :items, Kaarobar.Schemas.PurchaseOrderItem
    has_many :goods_receipts, Kaarobar.Schemas.GoodsReceipt

    timestamps(type: :utc_datetime)
  end

  def changeset(po, attrs) do
    po
    |> cast(attrs, [:status, :expected_delivery_date, :notes, :business_id, :branch_id, :owner_id, :supplier_id])
    |> validate_required([:business_id, :branch_id, :owner_id, :supplier_id])
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:supplier_id)
  end
end
