defmodule Kaarobar.Dining.DiningTable do
  @moduledoc """
  A table on the floor.

  Furniture, not trade: what is happening at it right now is a
  `Kaarobar.Dining.TableSession`. Keeping the two apart is what lets a table
  have a history — turnover, covers served, who was on it — rather than one
  bill that vanishes when it is cleared.

  `position_x`/`position_y` are nullable on purpose. A shop lists its tables on
  day one and draws a floor plan much later, if ever, and a table with no
  coordinates is perfectly usable from a list.
  """

  use Kaarobar.Schema

  alias Kaarobar.Dining.Floor
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @shapes ~w(square round rectangle booth bar)

  schema "dining_tables" do
    field :name, :string
    field :seats, :integer, default: 4

    field :position_x, :integer
    field :position_y, :integer
    field :shape, :string, default: "square"

    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :floor, Floor

    timestamps()
  end

  @doc "The shapes a floor plan can draw."
  def shapes, do: @shapes

  def changeset(dining_table, attrs) do
    dining_table
    |> cast(attrs, [
      :branch_id,
      :floor_id,
      :name,
      :seats,
      :position_x,
      :position_y,
      :shape,
      :is_active
    ])
    |> validate_required([:branch_id, :name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 40)
    |> validate_number(:seats, greater_than: 0, less_than_or_equal_to: 100)
    |> validate_inclusion(:shape, @shapes)
    |> unique_constraint(:name,
      name: :dining_tables_branch_id_name_index,
      message: "is already used by another table"
    )
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:floor_id)
  end

  @doc "Soft-deletes the table, keeping the sittings that happened on it."
  def soft_delete_changeset(dining_table),
    do: change(dining_table, deleted_at: DateTime.utc_now())

  @doc "True when a party may be seated here."
  @spec seatable?(t()) :: boolean()
  def seatable?(%__MODULE__{deleted_at: nil, is_active: true}), do: true
  def seatable?(%__MODULE__{}), do: false

  @doc "True when the table has been placed on a floor plan."
  @spec placed?(t()) :: boolean()
  def placed?(%__MODULE__{position_x: x, position_y: y}), do: not is_nil(x) and not is_nil(y)
end
