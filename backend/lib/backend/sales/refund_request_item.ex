defmodule Kaarobar.Sales.RefundRequestItem do
  @moduledoc """
  One line a customer wants to bring back.

  `restock` is decided here rather than at the till, because it is the
  approver's call: a faulty item does not go back on the shelf, and whether it
  is faulty is exactly the judgement the approval exists to make.
  """

  use Kaarobar.Schema

  alias Kaarobar.Sales.RefundRequest
  alias Kaarobar.Sales.SaleItem

  schema "refund_request_items" do
    field :quantity, :decimal
    field :restock, :boolean, default: true
    field :reason, :string

    belongs_to :refund_request, RefundRequest
    belongs_to :sale_item, SaleItem

    timestamps(updated_at: false)
  end

  def changeset(item, attrs) do
    item
    |> cast(attrs, [:refund_request_id, :sale_item_id, :quantity, :restock, :reason])
    |> validate_required([:sale_item_id, :quantity])
    |> validate_number(:quantity, greater_than: 0)
    |> unique_constraint(:sale_item_id,
      name: :refund_request_items_refund_request_id_sale_item_id_index,
      message: "is already on this request"
    )
    |> foreign_key_constraint(:sale_item_id)
  end
end
