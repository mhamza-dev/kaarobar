defmodule Kaarobar.Regulated.RegisterEntry do
  @moduledoc """
  One line of the register a pesticide dealer or pharmacy is required to keep.

  ## A legal record, not a report

  An inspector asks who bought a restricted product, when, how much, and under
  whose licence. Answering by filtering the sales list trusts that nobody ever
  deleted a line. This table is written at the point of sale and is append-only
  — enforced by a database trigger on both UPDATE and DELETE, because a
  register the shop could have edited last night is worth nothing.

  ## Everything is snapshotted

  The product name, the class, the active ingredient, the batch number and the
  shop's own licence. A register entry has to keep meaning what it meant after
  the product is renamed, the formulation changes, or the licence is renewed.

  ## The buyer must be named

  A restricted sale to an unidentified walk-in is exactly what the register
  exists to prevent, so `buyer_name` is required by the database and not merely
  by the form.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Catalog.Product
  alias Kaarobar.Customers.Customer
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Sales.SaleItem
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "regulated_sales" do
    field :product_name_snapshot, :string
    field :regulatory_class, :string
    field :active_ingredient, :string
    field :batch_number_snapshot, :string
    field :quantity, :decimal
    field :unit_snapshot, :string

    field :buyer_name, :string
    field :buyer_id_type, :string
    field :buyer_id_number, :string
    field :buyer_licence_number, :string
    field :buyer_address, :string

    field :sold_by_label, :string
    field :business_licence_snapshot, :string

    field :prescriber_name, :string
    field :prescription_reference, :string

    field :purpose, :string
    field :notes, :string
    field :occurred_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :sale, Sale
    belongs_to :sale_item, SaleItem
    belongs_to :product, Product
    belongs_to :batch, Batch
    belongs_to :customer, Customer
    belongs_to :sold_by, User

    timestamps(updated_at: false)
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :sale_id,
      :sale_item_id,
      :product_id,
      :batch_id,
      :product_name_snapshot,
      :regulatory_class,
      :active_ingredient,
      :batch_number_snapshot,
      :quantity,
      :unit_snapshot,
      :customer_id,
      :buyer_name,
      :buyer_id_type,
      :buyer_id_number,
      :buyer_licence_number,
      :buyer_address,
      :sold_by_id,
      :sold_by_label,
      :business_licence_snapshot,
      :prescriber_name,
      :prescription_reference,
      :purpose,
      :notes,
      :occurred_at
    ])
    |> validate_required([
      :organization_id,
      :business_id,
      :branch_id,
      :sale_id,
      :sale_item_id,
      :product_id,
      :product_name_snapshot,
      :quantity,
      :buyer_name,
      :occurred_at
    ])
    |> validate_number(:quantity, greater_than: 0)
    |> validate_length(:buyer_name, min: 1, max: 160)
    |> unique_constraint(:sale_item_id,
      name: :regulated_sales_sale_item_id_index,
      message: "is already in the register"
    )
    |> foreign_key_constraint(:sale_item_id)
  end

  @doc """
  How the entry reads in the register a person is shown.

  One line per row, in the order the columns appear in the paper book the law
  expects, so the two can be checked against each other.
  """
  @spec to_line(t()) :: String.t()
  def to_line(%__MODULE__{} = entry) do
    [
      Date.to_iso8601(DateTime.to_date(entry.occurred_at)),
      entry.product_name_snapshot,
      entry.batch_number_snapshot || "-",
      Decimal.to_string(entry.quantity, :normal),
      entry.buyer_name,
      entry.buyer_licence_number || entry.buyer_id_number || "-",
      entry.sold_by_label || "-"
    ]
    |> Enum.join(" | ")
  end
end
