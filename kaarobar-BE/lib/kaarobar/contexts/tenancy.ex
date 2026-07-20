defmodule Kaarobar.Tenancy do
  import Ecto.Query
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{Business, Branch, Membership}
  alias Kaarobar.Accounting

  def create_business(owner_id, attrs) do
    Ecto.Multi.new()
    |> Ecto.Multi.insert(:business, fn _ ->
      %Business{}
      |> Business.changeset(Map.put(attrs, :owner_id, owner_id))
    end)
    |> Ecto.Multi.run(:seed_coa, fn _repo, %{business: business} ->
      Accounting.seed_pakistan_coa(business.id, owner_id)
      {:ok, :seeded}
    end)
    |> Ecto.Multi.insert(:membership, fn %{business: business} ->
      %Membership{}
      |> Membership.changeset(%{
        user_id: owner_id,
        owner_id: owner_id,
        business_id: business.id,
        roles: ["owner", "admin"],
        status: "active"
      })
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{business: business}} -> {:ok, business}
      {:error, _op, changeset, _changes} -> {:error, changeset}
    end
  end

  def create_branch(business_id, owner_id, attrs) do
    %Branch{}
    |> Branch.changeset(Map.merge(attrs, %{business_id: business_id, owner_id: owner_id}))
    |> Repo.insert()
  end

  def list_businesses_for_owner(owner_id) do
    Business
    |> where([b], b.owner_id == ^owner_id)
    |> Repo.all()
  end

  def list_branches_for_business(business_id, owner_id) do
    Branch
    |> where([b], b.business_id == ^business_id and b.owner_id == ^owner_id)
    |> Repo.all()
  end

  def get_business(business_id, owner_id) do
    Business
    |> where([b], b.id == ^business_id and b.owner_id == ^owner_id)
    |> Repo.one()
  end

  def get_branch(branch_id, owner_id) do
    Branch
    |> where([b], b.id == ^branch_id and b.owner_id == ^owner_id)
    |> Repo.one()
  end

  def create_membership(attrs) do
    %Membership{}
    |> Membership.changeset(attrs)
    |> Repo.insert()
  end

  def get_membership(user_id, business_id, branch_id \\ nil) do
    query = from m in Membership,
      where: m.user_id == ^user_id and m.business_id == ^business_id

    query = if branch_id do
      where(query, [m], m.branch_id == ^branch_id or is_nil(m.branch_id))
    else
      query
    end

    Repo.one(query)
  end

  def list_memberships_for_user(user_id) do
    Membership
    |> where([m], m.user_id == ^user_id)
    |> preload([:business, :branch])
    |> Repo.all()
  end

  def has_role?(membership, role) do
    role in (membership.roles || [])
  end

  def user_can_access_business?(user, business_id) do
    cond do
      is_nil(user) or is_nil(business_id) ->
        false

      get_business(business_id, user.id) ->
        true

      true ->
        Membership
        |> where([m], m.user_id == ^user.id and m.business_id == ^business_id and m.status == "active")
        |> Repo.exists?()
    end
  end

  def owner_id_for_business(business_id) do
    case Repo.get(Business, business_id) do
      nil -> nil
      business -> business.owner_id
    end
  end

  def deactivate_business(business_id, owner_id) do
    case get_business(business_id, owner_id) do
      nil -> {:error, :not_found}
      business ->
        business
        |> Business.changeset(%{is_active: false})
        |> Repo.update()
    end
  end
end
