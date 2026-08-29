defmodule Kaarobar.Catalog.ModifierGroup do
  @moduledoc """
  A reusable set of choices made at the counter: spice level, milk, add-ons.

  Groups attach to many products, so "Spice level" is defined once and every
  curry on the menu gets it. `selection` and the min/max pair express the rule
  the till has to enforce — pick exactly one, pick up to three, pick none —
  which is otherwise reimplemented differently in each client.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.Modifier
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @selections ~w(single multiple)

  schema "modifier_groups" do
    field :name, :string
    field :description, :string
    field :selection, :string, default: "single"
    field :min_select, :integer, default: 0
    field :max_select, :integer
    field :position, :integer, default: 0
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    has_many :modifiers, Modifier, preload_order: [asc: :position]

    timestamps()
  end

  @doc "How many choices a group permits."
  def selections, do: @selections

  def changeset(group, attrs) do
    group
    |> cast(attrs, [
      :name,
      :description,
      :selection,
      :min_select,
      :max_select,
      :position,
      :is_active
    ])
    |> validate_required([:name, :selection])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 100)
    |> validate_length(:description, max: 300)
    |> validate_inclusion(:selection, @selections)
    |> validate_number(:min_select, greater_than_or_equal_to: 0)
    |> apply_single_select_ceiling()
    |> validate_selection_bounds()
    |> unique_constraint([:business_id, :name],
      name: :modifier_groups_business_id_name_index,
      message: "is already defined"
    )
  end

  @doc "Soft-deletes the group."
  def soft_delete_changeset(group), do: change(group, deleted_at: DateTime.utc_now())

  @doc "True when the customer must choose something from this group."
  def required?(%__MODULE__{min_select: min}), do: min > 0

  # A single-select group asking for two answers is a contradiction the
  # database rejects, so it is corrected here rather than surfaced as an error
  # about a field the client never showed.
  defp apply_single_select_ceiling(changeset) do
    if get_field(changeset, :selection) == "single" do
      put_change(changeset, :max_select, 1)
    else
      changeset
    end
  end

  defp validate_selection_bounds(changeset) do
    min = get_field(changeset, :min_select) || 0
    max = get_field(changeset, :max_select)

    if is_integer(max) and max < min do
      add_error(changeset, :max_select, "must be at least the minimum")
    else
      changeset
    end
  end
end
