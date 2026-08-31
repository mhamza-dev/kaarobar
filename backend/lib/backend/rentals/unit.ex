defmodule Kaarobar.Rentals.Unit do
  @moduledoc """
  One particular thing that gets lent out.

  A hire shop tracks *this* drill — its asset code, its serial number, its
  dents — not a quantity of drills. Which is why a rental unit is a row and not
  a stock level: the customer brings back the one they took, and the shop needs
  to know which one that was.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(available on_hire reserved maintenance lost retired)

  schema "rental_units" do
    field :asset_code, :string
    field :serial_number, :string
    field :condition_notes, :string

    field :status, :string, default: "available"
    field :daily_rate, :decimal
    field :deposit_amount, :decimal

    field :acquired_on, :date
    field :retired_on, :date
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :variant, ProductVariant

    timestamps()
  end

  @doc "The states a unit can be in."
  def statuses, do: @statuses

  def changeset(unit, attrs) do
    unit
    |> cast(attrs, [
      :branch_id,
      :variant_id,
      :asset_code,
      :serial_number,
      :condition_notes,
      :status,
      :daily_rate,
      :deposit_amount,
      :acquired_on,
      :retired_on,
      :is_active
    ])
    |> validate_required([:branch_id, :variant_id, :asset_code])
    |> update_change(:asset_code, &(&1 |> String.trim() |> String.upcase()))
    |> validate_length(:asset_code, min: 1, max: 40)
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:daily_rate, greater_than_or_equal_to: 0)
    |> validate_number(:deposit_amount, greater_than_or_equal_to: 0)
    |> unique_constraint(:asset_code,
      name: :rental_units_business_id_asset_code_index,
      message: "is already used by another unit"
    )
    |> foreign_key_constraint(:variant_id)
  end

  @doc "Soft-deletes the unit, keeping the hires it went out on."
  def soft_delete_changeset(unit), do: change(unit, deleted_at: DateTime.utc_now())

  @doc "Moves the unit between available, on hire, in for repair and so on."
  def status_changeset(unit, status) do
    unit
    |> change(status: status)
    |> validate_inclusion(:status, @statuses)
  end

  @doc """
  True when this unit could be hired at all.

  Says nothing about a particular date — that is a question about overlapping
  agreements, and `Kaarobar.Rentals.available_on/3` answers it.
  """
  @spec hireable?(t()) :: boolean()
  def hireable?(%__MODULE__{deleted_at: nil, is_active: true, status: status}),
    do: status in ["available", "reserved", "on_hire"]

  def hireable?(%__MODULE__{}), do: false
end
