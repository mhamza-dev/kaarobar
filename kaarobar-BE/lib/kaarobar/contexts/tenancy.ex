defmodule Kaarobar.Tenancy do
  @moduledoc """
  Owner → Business → Branch tenancy, memberships, and RBAC helpers (TEN-FR Must).
  """

  import Ecto.Query

  alias Kaarobar.{Audit, Roles, Repo}
  alias Kaarobar.Schemas.{Business, Branch, Membership, User}
  alias Kaarobar.Accounting

  ## —— Businesses (TEN-FR-001 / 009) ————————————————————————————————

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
    |> Ecto.Multi.run(:seed_categories, fn _repo, %{business: business} ->
      Kaarobar.Catalog.seed_default_categories(business.id, owner_id, business.industry)
      {:ok, :seeded}
    end)
    |> Ecto.Multi.insert(:membership, fn %{business: business} ->
      %Membership{}
      |> Membership.changeset(%{
        user_id: owner_id,
        owner_id: owner_id,
        business_id: business.id,
        roles: ["owner"],
        status: "active"
      })
    end)
    |> Ecto.Multi.run(:audit, fn _repo, %{business: business} ->
      Audit.log(%{
        owner_id: owner_id,
        user_id: owner_id,
        action: "business.create",
        entity_type: "business",
        entity_id: business.id,
        metadata: %{name: business.name}
      })
    end)
    |> Ecto.Multi.run(:mfa_flag, fn _repo, _ ->
      maybe_require_mfa(owner_id, ["owner"])
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{business: business}} -> {:ok, business}
      {:error, _op, changeset, _changes} -> {:error, changeset}
    end
  end

  def update_business(business_id, actor, attrs) do
    with {:ok, business} <- fetch_owned_business(business_id, actor.id),
         {:ok, updated} <-
           business |> Business.changeset(attrs) |> Repo.update(),
         {:ok, _} <-
           Audit.log(%{
             owner_id: business.owner_id,
             user_id: actor.id,
             action: "business.update",
             entity_type: "business",
             entity_id: business.id,
             metadata: Map.take(attrs, [:name, :industry, :tax_jurisdiction, :fbr_tier1])
           }) do
      {:ok, updated}
    end
  end

  def deactivate_business(business_id, actor) do
    with {:ok, business} <- fetch_owned_business(business_id, actor.id),
         {:ok, updated} <-
           business |> Business.changeset(%{is_active: false}) |> Repo.update(),
         {:ok, _} <-
           Audit.log(%{
             owner_id: business.owner_id,
             user_id: actor.id,
             action: "business.deactivate",
             entity_type: "business",
             entity_id: business.id,
             metadata: %{}
           }) do
      {:ok, updated}
    end
  end

  def list_businesses_for_user(user_id, opts \\ []) do
    active_only? = Keyword.get(opts, :active_only, true)

    owned_ids =
      Business
      |> where([b], b.owner_id == ^user_id)
      |> select([b], b.id)
      |> Repo.all()

    member_ids =
      Membership
      |> where([m], m.user_id == ^user_id and m.status == "active")
      |> select([m], m.business_id)
      |> Repo.all()

    ids = Enum.uniq(owned_ids ++ member_ids)

    query = from(b in Business, where: b.id in ^ids, order_by: [asc: b.name])

    query =
      if active_only? do
        where(query, [b], b.is_active == true)
      else
        query
      end

    Repo.all(query)
  end

  def list_businesses_for_owner(owner_id) do
    list_businesses_for_user(owner_id, active_only: false)
    |> Enum.filter(&(&1.owner_id == owner_id))
  end

  def get_business(business_id, owner_id) do
    Business
    |> where([b], b.id == ^business_id and b.owner_id == ^owner_id)
    |> Repo.one()
  end

  def get_business_by_id(business_id), do: Repo.get(Business, business_id)

  ## —— Branches (TEN-FR-002 / 009) ————————————————————————————————

  def create_branch(business_id, actor, attrs) do
    with {:ok, business} <- fetch_manageable_business(business_id, actor),
         true <- business.is_active || {:error, :business_inactive},
         {:ok, branch} <-
           %Branch{}
           |> Branch.changeset(
             Map.merge(attrs, %{business_id: business.id, owner_id: business.owner_id})
           )
           |> Repo.insert(),
         {:ok, _} <-
           Audit.log(%{
             owner_id: business.owner_id,
             user_id: actor.id,
             action: "branch.create",
             entity_type: "branch",
             entity_id: branch.id,
             metadata: %{name: branch.name, business_id: business.id}
           }) do
      {:ok, branch}
    else
      false -> {:error, :business_inactive}
      other -> other
    end
  end

  def update_branch(branch_id, actor, attrs) do
    with {:ok, branch} <- fetch_manageable_branch(branch_id, actor),
         {:ok, updated} <- branch |> Branch.changeset(attrs) |> Repo.update(),
         {:ok, _} <-
           Audit.log(%{
             owner_id: branch.owner_id,
             user_id: actor.id,
             action: "branch.update",
             entity_type: "branch",
             entity_id: branch.id,
             metadata: Map.take(attrs, [:name, :timezone, :refund_auto_approve_limit, :discount_auto_approve_limit])
           }) do
      {:ok, updated}
    end
  end

  def deactivate_branch(branch_id, actor) do
    with {:ok, branch} <- fetch_manageable_branch(branch_id, actor),
         {:ok, updated} <-
           branch |> Branch.changeset(%{is_active: false}) |> Repo.update(),
         {:ok, _} <-
           Audit.log(%{
             owner_id: branch.owner_id,
             user_id: actor.id,
             action: "branch.deactivate",
             entity_type: "branch",
             entity_id: branch.id,
             metadata: %{}
           }) do
      {:ok, updated}
    end
  end

  def list_branches_for_business(business_id, user, opts \\ []) do
    active_only? = Keyword.get(opts, :active_only, true)

    if user_can_access_business?(user, business_id) do
      query =
        Branch
        |> where([b], b.business_id == ^business_id)
        |> order_by([b], asc: b.name)

      query =
        if active_only? do
          where(query, [b], b.is_active == true)
        else
          query
        end

      # Branch-scoped memberships only see their branches (+ business-wide)
      case accessible_branch_ids(user.id, business_id) do
        :all ->
          Repo.all(query)

        ids when is_list(ids) ->
          query |> where([b], b.id in ^ids) |> Repo.all()
      end
    else
      []
    end
  end

  def get_branch(branch_id, owner_id) do
    Branch
    |> where([b], b.id == ^branch_id and b.owner_id == ^owner_id)
    |> Repo.one()
  end

  def get_branch_by_id(branch_id), do: Repo.get(Branch, branch_id)

  ## —— Memberships / RBAC (TEN-FR-003 / 004) ————————————————————————

  def create_membership(actor, attrs) do
    business_id = attrs[:business_id] || attrs["business_id"]
    roles = attrs[:roles] || attrs["roles"] || []

    with {:ok, business} <- fetch_owned_business(business_id, actor.id),
         true <- Kaarobar.Billing.within_limits?(business.owner_id, :user) || {:error, :plan_limit_reached},
         :ok <- Roles.validate_roles(List.wrap(roles)),
         {:ok, membership} <-
           %Membership{}
           |> Membership.changeset(
             Map.merge(normalize_attrs(attrs), %{
               owner_id: business.owner_id,
               status: attrs[:status] || attrs["status"] || "active"
             })
           )
           |> Repo.insert(),
         {:ok, _} <-
           Audit.log(%{
             owner_id: business.owner_id,
             user_id: actor.id,
             action: "membership.create",
             entity_type: "membership",
             entity_id: membership.id,
             metadata: %{
               target_user_id: membership.user_id,
               roles: membership.roles,
               branch_id: membership.branch_id
             }
           }),
         {:ok, _} <- maybe_require_mfa(membership.user_id, membership.roles) do
      {:ok, membership}
    end
  end

  def update_membership(membership_id, actor, attrs) do
    with %Membership{} = membership <- Repo.get(Membership, membership_id),
         {:ok, _} <- fetch_owned_business(membership.business_id, actor.id),
         roles = attrs[:roles] || attrs["roles"],
         :ok <- if(roles, do: Roles.validate_roles(List.wrap(roles)), else: :ok),
         {:ok, updated} <-
           membership |> Membership.changeset(normalize_attrs(attrs)) |> Repo.update(),
         {:ok, _} <-
           Audit.log(%{
             owner_id: membership.owner_id,
             user_id: actor.id,
             action: "membership.update",
             entity_type: "membership",
             entity_id: membership.id,
             metadata: normalize_attrs(attrs)
           }),
         {:ok, _} <- maybe_require_mfa(updated.user_id, updated.roles) do
      {:ok, updated}
    else
      nil -> {:error, :not_found}
      other -> other
    end
  end

  def deactivate_membership(membership_id, actor) do
    update_membership(membership_id, actor, %{status: "inactive"})
  end

  def list_memberships_for_business(business_id, actor) do
    if user_is_owner?(actor, business_id) or user_can_access_business?(actor, business_id) do
      Membership
      |> where([m], m.business_id == ^business_id)
      |> preload([:user, :branch])
      |> order_by([m], asc: m.inserted_at)
      |> Repo.all()
    else
      []
    end
  end

  def list_memberships_for_user(user_id) do
    Membership
    |> where([m], m.user_id == ^user_id)
    |> preload([:business, :branch])
    |> Repo.all()
  end

  def get_membership(user_id, business_id, branch_id \\ nil) do
    query =
      from(m in Membership,
        where: m.user_id == ^user_id and m.business_id == ^business_id and m.status == "active"
      )

    query =
      if branch_id do
        where(query, [m], m.branch_id == ^branch_id or is_nil(m.branch_id))
      else
        query
      end

    Repo.all(query)
  end

  def has_role?(membership, role) when is_map(membership) do
    role in (membership.roles || [])
  end

  def user_can_access_business?(user, business_id) do
    cond do
      is_nil(user) or is_nil(business_id) ->
        false

      match?(%Business{is_active: true}, get_business(business_id, user.id)) ->
        true

      true ->
        case get_business_by_id(business_id) do
          %Business{owner_id: owner_id, is_active: true} when owner_id == user.id ->
            true

          %Business{is_active: true} ->
            Membership
            |> where(
              [m],
              m.user_id == ^user.id and m.business_id == ^business_id and m.status == "active"
            )
            |> Repo.exists?()

          _ ->
            false
        end
    end
  end

  def user_can_access_branch?(user, business_id, branch_id)
      when is_binary(business_id) and is_binary(branch_id) do
    with true <- user_can_access_business?(user, business_id),
         %Branch{business_id: ^business_id, is_active: true} <- get_branch_by_id(branch_id) do
      case accessible_branch_ids(user.id, business_id) do
        :all -> true
        ids -> branch_id in ids
      end
    else
      _ -> false
    end
  end

  def user_can_access_branch?(_, _, _), do: false

  def user_has_any_role?(user, business_id, branch_id, required_roles)
      when is_list(required_roles) do
    cond do
      is_nil(user) or is_nil(business_id) ->
        false

      user_is_owner?(user, business_id) ->
        true

      true ->
        memberships = get_membership(user.id, business_id, branch_id)

        Enum.any?(memberships, fn m ->
          Enum.any?(required_roles, &(&1 in (m.roles || [])))
        end)
    end
  end

  def user_is_owner?(user, business_id) do
    case get_business_by_id(business_id) do
      %Business{owner_id: owner_id} -> owner_id == user.id
      _ -> false
    end
  end

  def owner_id_for_business(business_id) do
    case get_business_by_id(business_id) do
      nil -> nil
      business -> business.owner_id
    end
  end

  def business_active?(business_id) do
    match?(%Business{is_active: true}, get_business_by_id(business_id))
  end

  def branch_active?(branch_id) do
    match?(%Branch{is_active: true}, get_branch_by_id(branch_id))
  end

  ## —— Private helpers ————————————————————————————————————————————

  defp fetch_owned_business(business_id, owner_id) do
    case get_business(business_id, owner_id) do
      nil -> {:error, :not_found}
      business -> {:ok, business}
    end
  end

  defp fetch_manageable_business(business_id, actor) do
    cond do
      user_is_owner?(actor, business_id) ->
        {:ok, get_business_by_id(business_id)}

      user_has_any_role?(actor, business_id, nil, ["owner", "branch_manager"]) ->
        {:ok, get_business_by_id(business_id)}

      true ->
        {:error, :forbidden}
    end
  end

  defp fetch_manageable_branch(branch_id, actor) do
    case get_branch_by_id(branch_id) do
      nil ->
        {:error, :not_found}

      branch ->
        if user_is_owner?(actor, branch.business_id) or
             user_has_any_role?(actor, branch.business_id, branch.id, ["owner", "branch_manager"]) do
          {:ok, branch}
        else
          {:error, :forbidden}
        end
    end
  end

  defp accessible_branch_ids(user_id, business_id) do
    case get_business(business_id, user_id) do
      %Business{} ->
        :all

      _ ->
        memberships =
          Membership
          |> where(
            [m],
            m.user_id == ^user_id and m.business_id == ^business_id and m.status == "active"
          )
          |> Repo.all()

        if Enum.any?(memberships, &is_nil(&1.branch_id)) do
          :all
        else
          Enum.map(memberships, & &1.branch_id) |> Enum.reject(&is_nil/1)
        end
    end
  end

  defp maybe_require_mfa(user_id, roles) do
    if Roles.requires_mfa_by_default?(roles) do
      case Repo.get(User, user_id) do
        nil ->
          {:ok, :skipped}

        %User{mfa_required: true} ->
          {:ok, :already}

        user ->
          user
          |> Ecto.Changeset.change(%{mfa_required: true})
          |> Repo.update()
      end
    else
      {:ok, :not_required}
    end
  end

  defp normalize_attrs(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_binary(k) ->
        key =
          try do
            String.to_existing_atom(k)
          rescue
            ArgumentError -> String.to_atom(k)
          end

        {key, v}

      {k, v} ->
        {k, v}
    end)
  end
end
