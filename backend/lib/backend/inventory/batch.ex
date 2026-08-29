defmodule Kaarobar.Inventory.Batch do
  @moduledoc """
  A received lot, with the dates that make it legally distinct from the next one.

  In the regulated verticals this is not bookkeeping. A recall is announced by
  lot number, and a shop that cannot say which lots it received and how much of
  each it still holds cannot comply with one. Selling past `expires_on` is an
  offence in most jurisdictions, so the ledger refuses it rather than warning.

  `remaining_quantity` is maintained alongside the stock moves that draw the
  batch down, in the same transaction, for the same reason `stock_items.on_hand`
  is: a lot balance that disagrees with the moves against it is worse than no
  lot balance at all.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Money
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(active depleted expired quarantined recalled)

  schema "batches" do
    field :batch_number, :string
    field :manufactured_on, :date
    field :expires_on, :date
    field :supplier_id, Kaarobar.Ecto.UUIDv7

    field :received_quantity, :decimal, default: Decimal.new(0)
    field :remaining_quantity, :decimal, default: Decimal.new(0)
    field :unit_cost, :decimal

    field :status, :string, default: "active"
    field :note, :string

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :variant, ProductVariant

    timestamps()
  end

  @doc "The states a batch may be in."
  def statuses, do: @statuses

  def changeset(batch, attrs) do
    batch
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :variant_id,
      :batch_number,
      :manufactured_on,
      :expires_on,
      :supplier_id,
      :received_quantity,
      :remaining_quantity,
      :unit_cost,
      :status,
      :note
    ])
    |> validate_required([:organization_id, :business_id, :variant_id, :batch_number])
    |> update_change(:batch_number, &String.trim/1)
    |> validate_length(:batch_number, min: 1, max: 64)
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:received_quantity, greater_than_or_equal_to: 0)
    |> validate_number(:remaining_quantity, greater_than_or_equal_to: 0)
    |> validate_number(:unit_cost, greater_than_or_equal_to: 0)
    |> validate_dates()
    |> unique_constraint(:batch_number, name: :batches_business_id_variant_id_batch_number_index,
      message: "already exists for this product"
    )
    |> foreign_key_constraint(:variant_id)
  end

  @doc "Changeset for quarantining or recalling a batch."
  def status_changeset(batch, status) when status in @statuses do
    change(batch, status: status)
  end

  @doc "True when stock may be drawn from this batch right now."
  @spec sellable?(t(), Date.t()) :: boolean()
  def sellable?(%__MODULE__{status: status}, _today) when status != "active", do: false

  def sellable?(%__MODULE__{} = batch, today) do
    Money.positive?(batch.remaining_quantity) and not expired?(batch, today)
  end

  @doc "True when the batch is past its expiry."
  @spec expired?(t(), Date.t()) :: boolean()
  def expired?(%__MODULE__{expires_on: nil}, _today), do: false
  def expired?(%__MODULE__{expires_on: expires_on}, today), do: Date.compare(today, expires_on) == :gt

  @doc """
  Days until expiry — negative once past it.

  Drives the near-expiry alert, which is the difference between marking stock
  down while it can still be sold and writing it off after it cannot.
  """
  @spec days_until_expiry(t(), Date.t()) :: integer() | nil
  def days_until_expiry(%__MODULE__{expires_on: nil}, _today), do: nil
  def days_until_expiry(%__MODULE__{expires_on: expires_on}, today), do: Date.diff(expires_on, today)

  defp validate_dates(changeset) do
    manufactured = get_field(changeset, :manufactured_on)
    expires = get_field(changeset, :expires_on)

    if manufactured && expires && Date.compare(expires, manufactured) == :lt do
      add_error(changeset, :expires_on, "must be on or after the manufacture date")
    else
      changeset
    end
  end
end
