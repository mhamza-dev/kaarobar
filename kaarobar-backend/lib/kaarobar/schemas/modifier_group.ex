defmodule Kaarobar.Schemas.ModifierGroup do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "modifier_groups" do
    field :name, :string
    field :min_select, :integer, default: 0
    field :max_select, :integer, default: 1
    field :required, :boolean, default: false
    field :is_active, :boolean, default: true

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    has_many :modifiers, Kaarobar.Schemas.Modifier

    timestamps(type: :utc_datetime)
  end

  def changeset(group, attrs) do
    group
    |> cast(attrs, [
      :name,
      :min_select,
      :max_select,
      :required,
      :is_active,
      :business_id,
      :owner_id
    ])
    |> validate_required([:name, :business_id, :owner_id])
    |> validate_number(:min_select, greater_than_or_equal_to: 0)
    |> validate_number(:max_select, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:business_id)
  end
end
