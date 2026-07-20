defmodule Kaarobar.Schemas.SaleReturn do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "sale_returns" do
    field :status, :string, default: "PendingApproval"
    field :refund_amount, :decimal
    field :reason, :string

    belongs_to :sale, Kaarobar.Schemas.Sale
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :requested_by, Kaarobar.Schemas.User
    belongs_to :approved_by, Kaarobar.Schemas.User

    has_many :items, Kaarobar.Schemas.SaleReturnItem

    timestamps(type: :utc_datetime)
  end

  def changeset(sale_return, attrs) do
    sale_return
    |> cast(attrs, [:status, :refund_amount, :reason, :sale_id, :owner_id, :business_id, :branch_id, :requested_by_id, :approved_by_id])
    |> validate_required([:refund_amount, :sale_id, :owner_id, :business_id, :branch_id, :requested_by_id])
    |> validate_inclusion(:status, ["PendingApproval", "Approved", "Rejected"])
    |> foreign_key_constraint(:sale_id)
  end
end
