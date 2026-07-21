defmodule Kaarobar.Schemas.Membership do
  use Ecto.Schema
  import Ecto.Changeset

  alias Kaarobar.Roles

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
    |> update_change(:roles, fn roles -> Enum.map(roles || [], &Roles.normalize_role/1) end)
    |> validate_required([:user_id, :owner_id, :business_id, :roles])
    |> validate_inclusion(:status, ~w(active inactive invited))
    |> validate_roles()
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint([:user_id, :business_id, :branch_id])
    |> unique_constraint([:user_id, :business_id],
      name: :memberships_user_business_null_branch_uidx
    )
  end

  defp validate_roles(changeset) do
    case get_field(changeset, :roles) do
      roles when is_list(roles) and roles != [] ->
        case Roles.validate_roles(roles) do
          :ok ->
            changeset

          {:error, {:invalid_roles, invalid}} ->
            add_error(changeset, :roles, "invalid roles: #{Enum.join(invalid, ", ")}")
        end

      _ ->
        add_error(changeset, :roles, "must include at least one role")
    end
  end
end
