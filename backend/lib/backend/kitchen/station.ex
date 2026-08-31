defmodule Kaarobar.Kitchen.Station do
  @moduledoc """
  A place in the kitchen that cooks a subset of the menu: grill, fryer, bar,
  cold larder.

  Routing exists so the grill never has to read past the drinks to find its own
  work, and so each station can be bumped independently — which is what lets
  the pass see the grill is done and the fryer is not.

  `display_group` lets several stations share one screen. A small kitchen has
  one screen and three notional stations; a large one gives each its own, and
  the routing does not have to change when they grow.
  """

  use Kaarobar.Schema

  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "kitchen_stations" do
    field :name, :string
    field :code, :string
    field :position, :integer, default: 0
    field :prep_minutes, :integer
    field :display_group, :string

    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch

    timestamps()
  end

  def changeset(station, attrs) do
    station
    |> cast(attrs, [
      :branch_id,
      :name,
      :code,
      :position,
      :prep_minutes,
      :display_group,
      :is_active
    ])
    |> validate_required([:branch_id, :name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 60)
    |> validate_number(:prep_minutes, greater_than: 0, less_than_or_equal_to: 480)
    |> unique_constraint(:name,
      name: :kitchen_stations_branch_id_name_index,
      message: "is already used by another station"
    )
    |> foreign_key_constraint(:branch_id)
  end

  @doc "Soft-deletes the station. Its past tickets stay readable."
  def soft_delete_changeset(station), do: change(station, deleted_at: DateTime.utc_now())

  @doc "The screen this station's tickets appear on."
  @spec screen(t()) :: String.t()
  def screen(%__MODULE__{display_group: group}) when is_binary(group) and group != "", do: group
  def screen(%__MODULE__{name: name}), do: name
end
