defmodule KaarobarWeb.V1.MembershipController do
  use KaarobarWeb, :controller

  alias Kaarobar.{Accounts, Tenancy}

  def index(conn, %{"business_id" => business_id}) do
    user = Guardian.Plug.current_resource(conn)

    unless Tenancy.user_is_owner?(user, business_id) do
      conn |> put_status(:forbidden) |> json(%{error: "forbidden_role"})
    else
      data =
        business_id
        |> Tenancy.list_memberships_for_business(user)
        |> Enum.map(&serialize/1)

      json(conn, %{data: data})
    end
  end

  def create(conn, %{"business_id" => business_id} = params) do
    user = Guardian.Plug.current_resource(conn)

    unless Tenancy.user_is_owner?(user, business_id) do
      conn |> put_status(:forbidden) |> json(%{error: "forbidden_role"})
    else
      with {:ok, target} <- resolve_user(params),
           attrs <- %{
             user_id: target.id,
             business_id: business_id,
             branch_id: params["branch_id"],
             roles: params["roles"] || [],
             status: params["status"] || "active"
           },
           {:ok, membership} <- Tenancy.create_membership(user, attrs) do
        conn |> put_status(:created) |> json(%{data: serialize(membership)})
      else
        {:error, :plan_limit_reached} ->
          conn |> put_status(:payment_required) |> json(%{error: "plan_limit_reached", limit: "users"})

        {:error, :not_found} ->
          conn |> put_status(:not_found) |> json(%{error: "user_not_found"})

        {:error, {:invalid_roles, invalid}} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "invalid_roles", details: invalid})

        {:error, %Ecto.Changeset{} = cs} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})

        {:error, reason} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
      end
    end
  end

  def update(conn, %{"id" => id} = params) do
    user = Guardian.Plug.current_resource(conn)

    attrs =
      %{}
      |> maybe_put(:roles, params["roles"])
      |> maybe_put(:status, params["status"])
      |> maybe_put(:branch_id, params["branch_id"])

    case Tenancy.update_membership(id, user, attrs) do
      {:ok, membership} ->
        json(conn, %{data: serialize(membership)})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:error, :forbidden} ->
        conn |> put_status(:forbidden) |> json(%{error: "forbidden"})

      {:error, {:invalid_roles, invalid}} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "invalid_roles", details: invalid})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def deactivate(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)

    case Tenancy.deactivate_membership(id, user) do
      {:ok, membership} ->
        json(conn, %{data: serialize(membership)})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp resolve_user(%{"user_id" => user_id}) when is_binary(user_id) do
    case Accounts.get_user(user_id) do
      nil -> {:error, :not_found}
      user -> {:ok, user}
    end
  end

  defp resolve_user(%{"email" => email}) when is_binary(email) do
    case Accounts.get_user_by_email(email) do
      nil -> {:error, :not_found}
      user -> {:ok, user}
    end
  end

  defp resolve_user(_), do: {:error, :not_found}

  defp serialize(m) do
    m = Kaarobar.Repo.preload(m, [:user, :branch])

    %{
      id: m.id,
      user_id: m.user_id,
      business_id: m.business_id,
      branch_id: m.branch_id,
      roles: m.roles,
      status: m.status,
      user_email: m.user && m.user.email,
      user_name: m.user && m.user.name,
      branch_name: m.branch && m.branch.name
    }
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
