defmodule KaarobarWeb.V1.AuditController do
  use KaarobarWeb, :controller

  alias Kaarobar.{Audit, Tenancy}

  def index(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]

    owner_id =
      cond do
        is_binary(business_id) -> Tenancy.owner_id_for_business(business_id)
        true -> user.id
      end

    if owner_id == user.id or
         (is_binary(business_id) and
            Tenancy.user_has_any_role?(user, business_id, nil, ["owner", "accountant"])) do
      limit =
        case Integer.parse(params["limit"] || "100") do
          {n, _} -> min(n, 500)
          :error -> 100
        end

      data =
        owner_id
        |> Audit.list_for_owner(limit: limit)
        |> Enum.map(fn entry ->
          %{
            id: entry.id,
            action: entry.action,
            entity_type: entry.entity_type,
            entity_id: entry.entity_id,
            user_id: entry.user_id,
            metadata: entry.metadata,
            inserted_at: entry.inserted_at
          }
        end)

      json(conn, %{data: data})
    else
      conn |> put_status(:forbidden) |> json(%{error: "forbidden_role"})
    end
  end
end
