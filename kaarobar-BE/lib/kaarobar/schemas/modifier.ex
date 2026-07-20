defmodule Kaarobar.Schemas.Modifier do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "modifiers" do
    field :name, :string
    field :price_delta, :decimal, default: Decimal.new(0)
    field :is_active, :boolean, default: true
    field :sort_order, :integer, default: 0

    belongs_to :modifier_group, Kaarobar.Schemas.ModifierGroup

    timestamps(type: :utc_datetime)
  end

  def changeset(modifier, attrs) do
    modifier
    |> cast(attrs, [:name, :price_delta, :is_active, :sort_order, :modifier_group_id])
    |> validate_required([:name, :modifier_group_id])
    |> foreign_key_constraint(:modifier_group_id)
  end
end
