defmodule Kaarobar.Schemas.BusinessRoleSetting do
  use Ecto.Schema
  import Ecto.Changeset

  alias Kaarobar.Roles

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "business_role_settings" do
    field :role, :string
    field :bundle, :string
    field :allowed, :boolean, default: true

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(setting, attrs) do
    setting
    |> cast(attrs, [:business_id, :owner_id, :role, :bundle, :allowed])
    |> validate_required([:business_id, :owner_id, :role, :bundle, :allowed])
    |> update_change(:role, &Roles.normalize_role/1)
    |> validate_change(:role, fn :role, role ->
      if Roles.valid?(role), do: [], else: [role: "invalid role"]
    end)
    |> validate_change(:bundle, fn :bundle, bundle ->
      if bundle in Enum.map(Roles.bundles(), &Atom.to_string/1), do: [], else: [bundle: "invalid bundle"]
    end)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
    |> unique_constraint([:business_id, :role, :bundle])
  end
end
