defmodule Kaarobar.ServiceDesk.JobItem do
  @moduledoc """
  One piece of the customer's property.

  Its own row and its own tag, because a customer brings in nine shirts and a
  coat and comes back for the coat first — so status and rack location are per
  item, not per job.

  `condition_notes` is recorded at intake because the argument about the stain
  that was already there is the one this trade always has, and the shop only
  wins it if somebody wrote it down before the customer left.

  `tag_code` is unique within the business because it is scanned to find one
  garment among four hundred.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.ProductVariant
  alias Kaarobar.Money
  alias Kaarobar.ServiceDesk.Job
  alias Kaarobar.Tenancy.Business

  @statuses ~w(intake in_progress ready delivered lost damaged)

  schema "service_job_items" do
    field :description, :string
    field :quantity, :decimal, default: Decimal.new(1)
    field :unit_price, :decimal, default: Decimal.new(0)
    field :line_total, :decimal, default: Decimal.new(0)

    field :tag_code, :string
    field :condition_notes, :string
    field :condition_photo_paths, {:array, :string}, default: []

    field :colour, :string
    field :brand, :string
    field :serial_number, :string

    field :status, :string, default: "intake"
    field :rack_location, :string
    field :ready_at, :utc_datetime_usec
    field :delivered_at, :utc_datetime_usec

    field :position, :integer, default: 0
    field :notes, :string

    belongs_to :business, Business
    belongs_to :service_job, Job
    belongs_to :variant, ProductVariant

    timestamps()
  end

  @doc "The states one item moves through."
  def statuses, do: @statuses

  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :business_id,
      :service_job_id,
      :variant_id,
      :description,
      :quantity,
      :unit_price,
      :tag_code,
      :condition_notes,
      :condition_photo_paths,
      :colour,
      :brand,
      :serial_number,
      :rack_location,
      :position,
      :notes
    ])
    |> validate_required([:business_id, :description, :quantity])
    |> update_change(:description, &String.trim/1)
    |> validate_length(:description, min: 1, max: 200)
    |> validate_number(:quantity, greater_than: 0)
    |> validate_number(:unit_price, greater_than_or_equal_to: 0)
    |> normalize_tag()
    |> put_line_total()
    |> unique_constraint(:tag_code,
      name: :service_job_items_business_id_tag_code_index,
      message: "is already on another item"
    )
    |> foreign_key_constraint(:service_job_id)
  end

  @doc """
  The canonical form of a tag: upper case, separators removed.

  "t-1001", "T 1001" and "T1001" are one tag on one garment. A counter writes
  these by hand on a peel-off label and reads them back off a barcode gun, so
  the two rarely agree character for character — and a shop that cannot find a
  coat because of a hyphen has lost the coat.

  Public so `Kaarobar.ServiceDesk.find_by_tag/2` can normalise a scanned tag
  through the same function that wrote the stored one. Two normalisers is one
  normaliser and a bug.
  """
  @spec normalize_tag_code(String.t() | nil) :: String.t() | nil
  def normalize_tag_code(nil), do: nil

  def normalize_tag_code(value) when is_binary(value) do
    case value |> String.upcase() |> String.replace(~r/[^A-Z0-9]/, "") do
      "" -> nil
      code -> code
    end
  end

  @doc "This piece is finished and on the rack."
  def ready_changeset(item, rack_location) do
    change(item,
      status: "ready",
      rack_location: rack_location,
      ready_at: DateTime.utc_now()
    )
  end

  @doc "Handed back to the customer."
  def deliver_changeset(item),
    do: change(item, status: "delivered", delivered_at: DateTime.utc_now())

  @doc """
  Something went wrong with the customer's property.

  A state of its own rather than a note, because a shop that cannot count how
  often it loses or ruins things cannot fix it.
  """
  def incident_changeset(item, status, notes) when status in ["lost", "damaged"] do
    change(item, status: status, notes: notes)
  end

  @doc "True when this piece is still with the shop."
  @spec holding?(t()) :: boolean()
  def holding?(%__MODULE__{status: status}), do: status in ["intake", "in_progress", "ready"]

  @doc "The label a tag prints: the tag code, or the description if untagged."
  @spec label(t()) :: String.t()
  def label(%__MODULE__{tag_code: tag}) when is_binary(tag) and tag != "", do: tag
  def label(%__MODULE__{description: description}), do: description

  # Tags are scanned and read aloud, so casing and stray spaces have to stop
  # being a way for the same tag to exist twice.
  defp normalize_tag(changeset) do
    update_change(changeset, :tag_code, &normalize_tag_code/1)
  end

  defp put_line_total(changeset) do
    quantity = get_field(changeset, :quantity)
    price = get_field(changeset, :unit_price)

    if quantity && price do
      put_change(changeset, :line_total, quantity |> Money.mult(price) |> Money.round())
    else
      changeset
    end
  end
end
