defmodule KaarobarWeb.V1.BranchController do
  use KaarobarWeb, :controller
  alias Kaarobar.{Tenancy, Billing, Guardian}

  def index(conn, %{"business_id" => business_id}) do
    user = Guardian.Plug.current_resource(conn)

    data =
      business_id
      |> Tenancy.list_branches_for_business(user.id)
      |> Enum.map(&serialize/1)

    json(conn, %{data: data})
  end

  def create(conn, %{"business_id" => business_id} = params) do
    user = Guardian.Plug.current_resource(conn)

    if Billing.within_limits?(user.id, :branch) do
      case Tenancy.create_branch(business_id, user.id, atomize(params)) do
        {:ok, branch} -> conn |> put_status(:created) |> json(%{data: serialize(branch)})
        {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
      end
    else
      conn |> put_status(:payment_required) |> json(%{error: "plan_limit_reached"})
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
