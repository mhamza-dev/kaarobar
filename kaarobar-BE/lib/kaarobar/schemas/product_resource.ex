defmodule Kaarobar.Schemas.ProductResource do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @kinds ~w(room chair equipment)

  schema "product_resources" do
    field :resource_kind, :string

    belongs_to :product, Kaarobar.Schemas.Product
    belongs_to :bookable_resource, Kaarobar.Schemas.BookableResource

    timestamps(type: :utc_datetime)
  end

  def changeset(row, attrs) do
    row
    |> cast(attrs, [:product_id, :bookable_resource_id, :resource_kind])
    |> validate_required([:product_id])
    |> validate_resource_requirement()
    |> foreign_key_constraint(:product_id)
    |> foreign_key_constraint(:bookable_resource_id)
  end

  defp validate_resource_requirement(changeset) do
    resource_id = get_field(changeset, :bookable_resource_id)
    kind = get_field(changeset, :resource_kind)

    cond do
      is_binary(resource_id) ->
        changeset

      is_binary(kind) and kind in @kinds ->
        changeset

      true ->
        add_error(changeset, :resource_kind, "or bookable_resource_id is required")
    end
  end
end
