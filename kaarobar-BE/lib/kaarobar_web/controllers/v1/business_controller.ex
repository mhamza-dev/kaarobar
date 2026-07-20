defmodule KaarobarWeb.V1.BusinessController do
  use KaarobarWeb, :controller
  alias Kaarobar.{Tenancy, Billing, Guardian}

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    data = Enum.map(Tenancy.list_businesses_for_owner(user.id), &serialize/1)
    json(conn, %{data: data})
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)

    if Billing.within_limits?(user.id, :business) do
      case Tenancy.create_business(user.id, atomize(params)) do
        {:ok, business} ->
          conn |> put_status(:created) |> json(%{data: serialize(business)})

        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(changeset.errors)})
      end
    else
      conn |> put_status(:payment_required) |> json(%{error: "plan_limit_reached"})
    end
  end

  def show(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)

    case Tenancy.get_business(id, user.id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      business -> json(conn, %{data: serialize(business)})
    end
  end

  defp serialize(b) do
    %{
      id: b.id,
      owner_id: b.owner_id,
      name: b.name,
      industry: b.industry,
      tax_jurisdiction: b.tax_jurisdiction,
      subscription_plan: b.subscription_plan,
      fbr_tier1: b.fbr_tier1,
      is_active: b.is_active
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
