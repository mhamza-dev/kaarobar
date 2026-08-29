defmodule Kaarobar.AccessControl.Role do
  @moduledoc """
  A named bundle of permissions.

  System roles have no `organization_id`: one row each, shared by every tenant,
  and immutable. Custom roles belong to an organization and may be edited
  freely.

  Keeping system roles as shared rows rather than copies per tenant means a
  correction to the cashier role reaches every shop at once, and there is no
  drift between what the code believes a cashier is and what some organization
  edited it into three years ago.

  `rank` exists to stop privilege escalation. Without it, `staff:assign_roles`
  is effectively `organization:*`, because a manager could assign themselves
  the administrator role.
  """

  use Kaarobar.Schema

  alias Kaarobar.AccessControl.Permission
  alias Kaarobar.AccessControl.RolePermission
  alias Kaarobar.Tenancy.Organization

  @custom_role_rank 100

  schema "roles" do
    field :key, :string
    field :name, :string
    field :description, :string

    field :rank, :integer, default: @custom_role_rank
    field :is_system, :boolean, default: false

    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization

    has_many :role_permissions, RolePermission
    has_many :permissions, through: [:role_permissions, :permission]

    timestamps()
  end

  @doc "The rank given to a custom role unless one is derived from its sources."
  def custom_role_rank, do: @custom_role_rank

  @doc """
  Changeset for a system role. Used only by the seed.
  """
  def system_changeset(role, attrs) do
    role
    |> cast(attrs, [:key, :name, :description, :rank])
    |> put_change(:is_system, true)
    |> put_change(:organization_id, nil)
    |> validate_common()
  end

  @doc """
  Changeset for an organization's own role.

  `organization_id` is set by the context from the request scope.
  """
  def create_changeset(role, attrs) do
    role
    |> cast(attrs, [:key, :name, :description, :rank])
    |> put_change(:is_system, false)
    |> maybe_generate_key()
    |> validate_common()
    |> foreign_key_constraint(:organization_id)
  end

  @doc """
  Changeset for editing a custom role.

  The key is immutable once created — it may already be referenced in scripts,
  integrations and saved reports.
  """
  def update_changeset(role, attrs) do
    role
    |> cast(attrs, [:name, :description, :rank])
    |> validate_common()
  end

  @doc "Soft-deletes a custom role."
  def soft_delete_changeset(role) do
    change(role, deleted_at: DateTime.utc_now())
  end

  @doc "True when this role is a shared system template and must not be edited."
  def system?(%__MODULE__{is_system: true}), do: true
  def system?(%__MODULE__{}), do: false

  @doc """
  The permission keys this role grants.

  Reads whichever association happens to be loaded, and returns an empty list
  when neither is — a caller that forgot to preload gets nothing rather than a
  crash, and nothing is the safe direction for a permission check.
  """
  def permission_keys(%__MODULE__{} = role) do
    cond do
      is_list(role.permissions) -> Enum.map(role.permissions, &key_of/1)
      is_list(role.role_permissions) -> Enum.map(role.role_permissions, & &1.permission_key)
      true -> []
    end
  end

  defp key_of(%Permission{key: key}), do: key
  defp key_of(key) when is_binary(key), do: key

  defp validate_common(changeset) do
    changeset
    |> validate_required([:key, :name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 80)
    |> validate_length(:description, max: 500)
    |> validate_format(:key, ~r/^[a-z][a-z0-9_]*$/,
      message: "may only contain lowercase letters, numbers and underscores"
    )
    |> validate_length(:key, min: 2, max: 40)
    |> validate_number(:rank, greater_than_or_equal_to: 0, less_than_or_equal_to: 1000)
    |> unique_constraint(:key,
      name: :roles_system_key_index,
      message: "is already the name of a built-in role"
    )
    |> unique_constraint(:key,
      name: :roles_organization_key_index,
      message: "is already taken"
    )
  end

  defp maybe_generate_key(changeset) do
    case get_field(changeset, :key) do
      nil ->
        key =
          changeset
          |> get_field(:name)
          |> derive_key()

        put_change(changeset, :key, key)

      _key ->
        changeset
    end
  end

  defp derive_key(nil), do: nil

  defp derive_key(name) do
    derived =
      name
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9]+/u, "_")
      |> String.trim("_")
      |> String.slice(0, 40)

    if derived == "", do: Kaarobar.Slug.random("role") |> String.replace("-", "_"), else: derived
  end
end
