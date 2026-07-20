defmodule Kaarobar.Schemas.Membership do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "memberships" do
    field :roles, {:array, :string}, default: []
    field :status, :string, default: "active"

    belongs_to :user, Kaarobar.Schemas.User
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :branch, Kaarobar.Schemas.Branch

    timestamps(type: :utc_datetime)
  end

  def changeset(membership, attrs) do
    membership
    |> cast(attrs, [:roles, :status, :user_id, :owner_id, :business_id, :branch_id])
    |> validate_required([:user_id, :owner_id, :business_id])
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint([:user_id, :business_id, :branch_id])
  end
end
