defmodule Kaarobar.Catalog.ProductBarcode do
  @moduledoc """
  An additional barcode for a variant.

  The variant's own `barcode` column is the primary one and serves the scan
  path. This table holds the rest, and shops accumulate them: the same tin
  arrives from two suppliers with two codes, a case has a code distinct from
  the unit inside it, and an old label is still on stock at the back.

  ## Embedded-value barcodes

  A shop scale prints a label encoding the weight or the price of the item it
  just weighed. The barcode identifies the product; some of its digits are the
  measurement. `embedded_value` says which, so the POS knows to read a quantity
  out of the code rather than asking the cashier to key it.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Tenancy.Business

  @kinds ~w(ean13 ean8 upca upce code128 code39 qr internal)
  @embedded_values ~w(weight price quantity)

  schema "product_barcodes" do
    field :barcode, :string
    field :kind, :string, default: "ean13"
    field :embedded_value, :string

    belongs_to :business, Business
    belongs_to :variant, ProductVariant

    timestamps(updated_at: false)
  end

  @doc "The barcode symbologies understood."
  def kinds, do: @kinds

  @doc "The measurements a barcode may carry in its digits."
  def embedded_values, do: @embedded_values

  def changeset(barcode, attrs) do
    barcode
    |> cast(attrs, [:business_id, :variant_id, :barcode, :kind, :embedded_value])
    |> validate_required([:business_id, :variant_id, :barcode, :kind])
    |> update_change(:barcode, &String.trim/1)
    |> validate_length(:barcode, min: 1, max: 64)
    |> validate_inclusion(:kind, @kinds)
    |> validate_inclusion(:embedded_value, @embedded_values)
    |> foreign_key_constraint(:variant_id)
    |> unique_constraint(:barcode, name: :product_barcodes_business_id_barcode_index,
      message: "is already used by another product"
    )
  end
end
