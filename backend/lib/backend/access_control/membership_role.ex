defmodule Kaarobar.AccessControl.MembershipRole do
  @moduledoc """
  Assigns a role to a member of staff.

  A person may hold more than one. Their permissions are the union, and their
  rank is the strongest they hold. That matters for real shops: the owner's
  brother is the manager on weekdays and works the till at weekends, and
  modelling that as two roles is more honest than inventing a
  "manager_who_also_sells" role.
  """

  use Kaarobar.Schema

  alias Kaarobar.AccessControl.Role
  alias Kaarobar.Accounts.User
  alias Kaarobar.Tenancy.Membership

  schema "membership_roles" do
    belongs_to :membership, Membership
    belongs_to :role, Role
    # Who granted it. The first question asked when someone turns out to have
    # had access they should not have had.
    belongs_to :assigned_by, User

    timestamps(updated_at: false)
  end

  def changeset(membership_role, attrs) do
    membership_role
    |> cast(attrs, [:membership_id, :role_id, :assigned_by_id])
    |> validate_required([:membership_id, :role_id])
    |> foreign_key_constraint(:membership_id)
    |> foreign_key_constraint(:role_id)
    |> unique_constraint(:role_id, name: :membership_roles_membership_id_role_id_index,
      message: "is already assigned to this staff member"
    )
  end
end
