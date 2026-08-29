defmodule Kaarobar.Tenancy.MembershipBranch do
  @moduledoc """
  Restricts a membership to particular branches.

  No rows means no restriction — the membership covers every branch of its
  business. That default is deliberate: the overwhelmingly common case is a
  single-branch shop, and requiring an explicit row there would mean every new
  hire is invisible until someone remembers a second step.
  """

  use Kaarobar.Schema

  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Membership

  schema "membership_branches" do
    belongs_to :membership, Membership
    belongs_to :branch, Branch

    timestamps(updated_at: false)
  end

  def changeset(membership_branch, attrs) do
    membership_branch
    |> cast(attrs, [:membership_id, :branch_id])
    |> validate_required([:membership_id, :branch_id])
    |> foreign_key_constraint(:membership_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint(:branch_id, name: :membership_branches_membership_id_branch_id_index,
      message: "is already assigned to this staff member"
    )
  end
end
