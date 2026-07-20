defmodule Kaarobar.Schemas.Supplier do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "suppliers" do
    field :name, :string
    field :contact, :map
    field :payment_terms, :string

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(supplier, attrs) do
    supplier
    |> cast(attrs, [:name, :contact, :payment_terms, :business_id, :owner_id])
    |> validate_required([:name, :business_id, :owner_id])
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
  end
end
