defmodule Kaarobar.Customers.PaymentAllocation do
  @moduledoc """
  How much of one payment settled one invoice.

  Recorded rather than inferred. Applying payments oldest-first at report time
  gives the same balance and a different — wrong — answer to "did they pay for
  the delivery on the 3rd?", which is the question a customer actually asks.

  The mirror of `Kaarobar.Purchasing.SupplierPaymentAllocation` on the buy side.
  """

  use Kaarobar.Schema

  alias Kaarobar.Customers.CustomerPayment
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "customer_payment_allocations" do
    field :amount, :decimal
    field :note, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :customer_payment, CustomerPayment
    belongs_to :sale, Sale

    timestamps(updated_at: false)
  end

  def changeset(allocation, attrs) do
    allocation
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :customer_payment_id,
      :sale_id,
      :amount,
      :note
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :customer_payment_id,
      :sale_id,
      :amount
    ])
    |> validate_number(:amount, greater_than: 0)
    |> unique_constraint(:sale_id,
      name: :customer_payment_allocations_payment_sale_index,
      message: "is already settled by this payment"
    )
    |> foreign_key_constraint(:sale_id)
    |> foreign_key_constraint(:customer_payment_id)
  end
end
