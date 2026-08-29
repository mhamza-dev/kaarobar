defmodule Kaarobar.AccessControl.PermissionGrant do
  @moduledoc """
  A per-person exception to their roles.

  Real shops need these constantly. "She's a cashier, but she can approve
  refunds when I'm not in" should not require inventing a role for one person.
  Neither should "he's a manager, but not on the cash drawer" require weakening
  the manager role for everyone else.

  `effect` is `allow` or `deny`, and **deny wins**. Taking one dangerous
  permission away from one person must never depend on getting a role edit
  right, and must never be silently undone by adding a role later.

  `expires_at` covers the case this exists for most often: cover during someone
  else's leave. Temporary access that has to be remembered and revoked by hand
  is permanent access.
  """

  use Kaarobar.Schema

  alias Kaarobar.AccessControl.Permission
  alias Kaarobar.Accounts.User
  alias Kaarobar.Tenancy.Membership

  @effects ~w(allow deny)

  schema "permission_grants" do
    field :effect, :string
    field :reason, :string
    field :expires_at, :utc_datetime_usec

    belongs_to :membership, Membership
    belongs_to :permission, Permission,
      foreign_key: :permission_key,
      references: :key,
      type: :string
    belongs_to :granted_by, User

    timestamps()
  end

  @doc "The effects a grant may have."
  def effects, do: @effects

  def changeset(grant, attrs) do
    grant
    |> cast(attrs, [
      :membership_id,
      :permission_key,
      :effect,
      :reason,
      :expires_at,
      :granted_by_id
    ])
    |> validate_required([:membership_id, :permission_key, :effect])
    |> validate_inclusion(:effect, @effects)
    |> validate_length(:reason, max: 500)
    |> validate_expiry_in_future()
    |> foreign_key_constraint(:membership_id)
    |> foreign_key_constraint(:permission_key, message: "is not a known permission")
    |> unique_constraint(:permission_key, name: :permission_grants_membership_id_permission_key_index,
      message: "already has an override for this permission"
    )
  end

  @doc "True when the grant is still in force."
  def in_force?(%__MODULE__{expires_at: nil}), do: true

  def in_force?(%__MODULE__{expires_at: expires_at}) do
    DateTime.compare(expires_at, DateTime.utc_now()) == :gt
  end

  defp validate_expiry_in_future(changeset) do
    case get_change(changeset, :expires_at) do
      nil ->
        changeset

      expires_at ->
        if DateTime.compare(expires_at, DateTime.utc_now()) == :gt do
          changeset
        else
          add_error(changeset, :expires_at, "must be in the future")
        end
    end
  end
end
