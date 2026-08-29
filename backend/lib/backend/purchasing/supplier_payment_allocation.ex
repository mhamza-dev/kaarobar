defmodule Kaarobar.Purchasing.SupplierPaymentAllocation do
  @moduledoc """
  How much of one payment settles one bill.

  Recorded explicitly rather than inferred from dates. The inference — oldest
  first — is wrong as soon as a part-payment or a disputed invoice is involved,
  which is most of the time, and by then the ageing report has been wrong for
  months.
  """

  use Kaarobar.Schema

  alias Kaarobar.Purchasing.SupplierBill
  alias Kaarobar.Purchasing.SupplierPayment
  alias Kaarobar.Tenancy.Business

  schema "supplier_payment_allocations" do
    field :amount, :decimal

    belongs_to :business, Business
    belongs_to :supplier_payment, SupplierPayment
    belongs_to :supplier_bill, SupplierBill

    timestamps(updated_at: false)
  end

  def changeset(allocation, attrs) do
    allocation
    |> cast(attrs, [:business_id, :supplier_payment_id, :supplier_bill_id, :amount])
    |> validate_required([:business_id, :supplier_payment_id, :supplier_bill_id, :amount])
    |> validate_number(:amount, greater_than: 0)
    |> unique_constraint([:supplier_payment_id, :supplier_bill_id],
      message: "is already allocated to this bill"
    )
    |> foreign_key_constraint(:supplier_bill_id)
    |> foreign_key_constraint(:supplier_payment_id)
  end
end
