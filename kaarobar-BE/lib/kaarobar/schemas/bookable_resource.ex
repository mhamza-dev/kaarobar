defmodule Kaarobar.Schemas.BookableResource do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @kinds ~w(room chair equipment)

  schema "bookable_resources" do
    field :name, :string
    field :kind, :string
    field :capacity, :integer, default: 1
    field :is_active, :boolean, default: true
    field :notes, :string

    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :branch, Kaarobar.Schemas.Branch

    timestamps(type: :utc_datetime)
  end

  def kinds, do: @kinds

  def changeset(resource, attrs) do
    resource
    |> cast(attrs, [
      :name,
      :kind,
      :capacity,
      :is_active,
      :notes,
      :owner_id,
      :business_id,
      :branch_id
    ])
    |> validate_required([:name, :kind, :owner_id, :business_id, :branch_id])
    |> validate_inclusion(:kind, @kinds)
    |> validate_number(:capacity, greater_than: 0)
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:branch_id)
  end
end
