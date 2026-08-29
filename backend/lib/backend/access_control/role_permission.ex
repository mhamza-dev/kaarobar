defmodule Kaarobar.AccessControl.RolePermission do
  @moduledoc """
  One permission granted by one role.
  """

  use Kaarobar.Schema

  alias Kaarobar.AccessControl.Permission
  alias Kaarobar.AccessControl.Role

  schema "role_permissions" do
    belongs_to :role, Role
    belongs_to :permission, Permission,
      foreign_key: :permission_key,
      references: :key,
      type: :string

    timestamps(updated_at: false)
  end

  def changeset(role_permission, attrs) do
    role_permission
    |> cast(attrs, [:role_id, :permission_key])
    |> validate_required([:role_id, :permission_key])
    |> foreign_key_constraint(:role_id)
    |> foreign_key_constraint(:permission_key, message: "is not a known permission")
    |> unique_constraint([:role_id, :permission_key])
  end
end
