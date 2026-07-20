defmodule KaarobarWeb.V1.BranchController do
  use KaarobarWeb, :controller

  alias Kaarobar.{Tenancy, Billing}

  def index(conn, %{"business_id" => business_id} = params) do
    user = Guardian.Plug.current_resource(conn)
    active_only = params["include_inactive"] != "true"

    data =
      business_id
      |> Tenancy.list_branches_for_business(user, active_only: active_only)
      |> Enum.map(&serialize/1)

    json(conn, %{data: data})
  end

  def create(conn, %{"business_id" => business_id} = params) do
    user = Guardian.Plug.current_resource(conn)

    cond do
      not Tenancy.user_is_owner?(user, business_id) and
          not Tenancy.user_has_any_role?(user, business_id, nil, ["owner", "branch_manager"]) ->
        conn |> put_status(:forbidden) |> json(%{error: "forbidden_role"})

      not Billing.within_limits?(Tenancy.owner_id_for_business(business_id) || user.id, :branch) ->
        conn |> put_status(:payment_required) |> json(%{error: "plan_limit_reached"})

      true ->
        case Tenancy.create_branch(business_id, user, atomize(params)) do
          {:ok, branch} ->
            conn |> put_status(:created) |> json(%{data: serialize(branch)})

          {:error, :forbidden} ->
            conn |> put_status(:forbidden) |> json(%{error: "forbidden"})

          {:error, :business_inactive} ->
            conn |> put_status(:forbidden) |> json(%{error: "business_inactive"})

          {:error, cs} ->
            conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
        end
    end
  end

  def show(conn, %{"business_id" => business_id, "id" => id}) do
    user = Guardian.Plug.current_resource(conn)

    case Tenancy.get_branch_by_id(id) do
      %{business_id: ^business_id} = branch ->
        if Tenancy.user_can_access_branch?(user, business_id, id) do
          json(conn, %{data: serialize(branch)})
        else
          conn |> put_status(:forbidden) |> json(%{error: "forbidden_branch"})
        end

      _ ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})
    end
  end

  def update(conn, %{"id" => id} = params) do
    user = Guardian.Plug.current_resource(conn)

    case Tenancy.update_branch(id, user, atomize(params)) do
      {:ok, branch} ->
        json(conn, %{data: serialize(branch)})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:error, :forbidden} ->
        conn |> put_status(:forbidden) |> json(%{error: "forbidden"})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def deactivate(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)

    case Tenancy.deactivate_branch(id, user) do
      {:ok, branch} ->
        json(conn, %{data: serialize(branch)})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:error, :forbidden} ->
        conn |> put_status(:forbidden) |> json(%{error: "forbidden"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp serialize(b) do
    %{
      id: b.id,
      business_id: b.business_id,
      owner_id: b.owner_id,
      name: b.name,
      timezone: b.timezone,
      is_active: b.is_active,
      refund_auto_approve_limit: to_string(b.refund_auto_approve_limit || 0),
      discount_auto_approve_limit: to_string(b.discount_auto_approve_limit || 0)
    }
  end

  defp atomize(map) when is_map(map) do
    Map.new(map, fn
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
