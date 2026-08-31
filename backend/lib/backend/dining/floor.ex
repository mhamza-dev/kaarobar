defmodule Kaarobar.Dining.Floor do
  @moduledoc """
  A named area of a branch: the terrace, upstairs, the garden.

  Exists so a floor plan can be shown a screenful at a time, and so a server
  can be given a section. A branch with one room simply never creates one —
  `dining_tables.floor_id` is nullable, and an unfloored table is normal.
  """

  use Kaarobar.Schema

  alias Kaarobar.Dining.DiningTable
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "floors" do
    field :name, :string
    field :position, :integer, default: 0
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch

    has_many :dining_tables, DiningTable

    timestamps()
  end

  def changeset(floor, attrs) do
    floor
    |> cast(attrs, [:branch_id, :name, :position, :is_active])
    |> validate_required([:branch_id, :name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 60)
    |> unique_constraint(:name,
      name: :floors_branch_id_name_index,
      message: "is already used by another floor"
    )
    |> foreign_key_constraint(:branch_id)
  end

  @doc "Soft-deletes the floor. Its tables stay, unfloored."
  def soft_delete_changeset(floor), do: change(floor, deleted_at: DateTime.utc_now())
end
