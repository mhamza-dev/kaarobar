defmodule Kaarobar.Schemas.Sale do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "sales" do
    field :invoice_number, :string
    field :client_txn_id, :binary_id
    field :status, :string, default: "Completed"
    field :subtotal, :decimal
    field :tax_amount, :decimal
    field :discount_amount, :decimal
    field :total_amount, :decimal
    field :fbr_invoice_no, :string
    field :fbr_qr_payload, :string
    field :fbr_reported_at, :utc_datetime
    field :notes, :string
    field :source, :string, default: "pos"

    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :cashier, Kaarobar.Schemas.User
    belongs_to :customer, Kaarobar.Schemas.Customer
    belongs_to :till, Kaarobar.Schemas.Till
    belongs_to :ar_invoice, Kaarobar.Schemas.ArInvoice

    has_many :items, Kaarobar.Schemas.SaleItem
    has_many :payments, Kaarobar.Schemas.SalePayment
    has_many :returns, Kaarobar.Schemas.SaleReturn

    timestamps(type: :utc_datetime)
  end

  def changeset(sale, attrs) do
    sale
    |> cast(attrs, [
      :invoice_number,
      :client_txn_id,
      :status,
      :subtotal,
      :tax_amount,
      :discount_amount,
      :total_amount,
      :fbr_invoice_no,
      :fbr_qr_payload,
      :fbr_reported_at,
      :notes,
      :source,
      :branch_id,
      :owner_id,
      :business_id,
      :cashier_id,
      :customer_id,
      :till_id,
      :ar_invoice_id
    ])
    |> validate_required([
      :invoice_number,
      :client_txn_id,
      :subtotal,
      :total_amount,
      :branch_id,
      :owner_id,
      :business_id,
      :source
    ])
    |> validate_inclusion(:source, ~w(pos online))
    |> validate_cashier_for_source()
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:cashier_id)
    |> unique_constraint(:client_txn_id)
  end

  defp validate_cashier_for_source(changeset) do
    source = get_field(changeset, :source) || "pos"
    cashier_id = get_field(changeset, :cashier_id)

    cond do
      source == "online" ->
        changeset

      is_nil(cashier_id) or cashier_id == "" ->
        add_error(changeset, :cashier_id, "can't be blank")

      true ->
        changeset
    end
  end
end
