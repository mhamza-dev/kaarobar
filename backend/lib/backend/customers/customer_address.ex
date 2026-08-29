defmodule Kaarobar.Customers.CustomerAddress do
  @moduledoc """
  Somewhere to deliver to, or bill to.

  Kept apart from the customer row because a customer routinely has more than
  one — a home and a shop, a house and a field gate — and because the address a
  rider needs is not always the one on the invoice.

  `delivery_notes` exists because directions are not an address. "Blue gate
  past the mosque, ring twice" is what actually gets an order delivered, and it
  has nowhere else to live.
  """

  use Kaarobar.Schema

  alias Kaarobar.Customers.Customer
  alias Kaarobar.Tenancy.Business

  @kinds ~w(billing shipping both)

  schema "customer_addresses" do
    field :label, :string
    field :kind, :string, default: "both"

    field :line1, :string
    field :line2, :string
    field :city, :string
    field :state, :string
    field :postal_code, :string
    field :country_code, :string

    field :latitude, :decimal
    field :longitude, :decimal
    field :delivery_notes, :string

    field :is_default, :boolean, default: false

    belongs_to :business, Business
    belongs_to :customer, Customer

    timestamps()
  end

  @doc "What an address may be used for."
  def kinds, do: @kinds

  def changeset(address, attrs) do
    address
    |> cast(attrs, [
      :business_id,
      :customer_id,
      :label,
      :kind,
      :line1,
      :line2,
      :city,
      :state,
      :postal_code,
      :country_code,
      :latitude,
      :longitude,
      :delivery_notes,
      :is_default
    ])
    |> validate_required([:business_id, :customer_id, :line1])
    |> validate_inclusion(:kind, @kinds)
    |> validate_length(:line1, min: 1, max: 200)
    |> validate_length(:country_code, is: 2)
    |> validate_number(:latitude, greater_than_or_equal_to: -90, less_than_or_equal_to: 90)
    |> validate_number(:longitude, greater_than_or_equal_to: -180, less_than_or_equal_to: 180)
    |> unique_constraint(:is_default,
      name: :customer_addresses_single_default_index,
      message: "another address is already the default"
    )
    |> foreign_key_constraint(:customer_id)
  end

  @doc "True when this address may receive a delivery."
  @spec deliverable?(t()) :: boolean()
  def deliverable?(%__MODULE__{kind: kind}), do: kind in ["shipping", "both"]

  @doc "The address on one line, for a receipt or a rider's screen."
  @spec one_line(t()) :: String.t()
  def one_line(%__MODULE__{} = address) do
    [address.line1, address.line2, address.city, address.state, address.postal_code]
    |> Enum.reject(&(is_nil(&1) or String.trim(&1) == ""))
    |> Enum.join(", ")
  end
end
