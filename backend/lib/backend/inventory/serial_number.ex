defmodule Kaarobar.Inventory.SerialNumber do
  @moduledoc """
  One physical unit, tracked individually.

  For goods where "how many" is not enough: a phone, a machine, a piece of
  equipment under warranty. The serial is what a customer quotes two years
  later, and `sale_reference_id` is how the shop finds which sale it left on.

  Distinct from a batch: a batch is many units that share an origin and an
  expiry; a serial is exactly one unit with its own history.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Inventory.Batch
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(in_stock reserved sold returned scrapped in_transit)

  schema "serial_numbers" do
    field :serial, :string
    field :status, :string, default: "in_stock"
    field :received_at, :utc_datetime_usec
    field :sold_at, :utc_datetime_usec
    field :sale_reference_id, Kaarobar.Ecto.UUIDv7
    field :note, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :variant, ProductVariant
    belongs_to :branch, Branch
    belongs_to :batch, Batch

    timestamps()
  end

  @doc "The states one unit may be in."
  def statuses, do: @statuses

  def changeset(serial_number, attrs) do
    serial_number
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :variant_id,
      :branch_id,
      :batch_id,
      :serial,
      :status,
      :received_at,
      :sold_at,
      :sale_reference_id,
      :note
    ])
    |> validate_required([:organization_id, :business_id, :variant_id, :serial])
    |> update_change(:serial, &String.trim/1)
    |> validate_length(:serial, min: 1, max: 120)
    |> validate_inclusion(:status, @statuses)
    |> unique_constraint([:business_id, :serial],
      message: "is already recorded against another unit"
    )
    |> foreign_key_constraint(:variant_id)
  end

  @doc "Changeset for moving a unit through its lifecycle."
  def status_changeset(serial_number, status, attrs \\ %{}) when status in @statuses do
    serial_number
    |> cast(attrs, [:branch_id, :sale_reference_id, :sold_at, :note])
    |> put_change(:status, status)
  end

  @doc "True when this unit is available to sell."
  @spec available?(t()) :: boolean()
  def available?(%__MODULE__{status: "in_stock"}), do: true
  def available?(%__MODULE__{}), do: false
end
