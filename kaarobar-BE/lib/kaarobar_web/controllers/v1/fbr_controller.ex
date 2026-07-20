defmodule KaarobarWeb.V1.FbrController do
  use KaarobarWeb, :controller

  alias Kaarobar.Integrations.Fbr
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.Sale

  def status(conn, %{"sale_id" => sale_id}) do
    owner_id = conn.assigns[:owner_id]
    business_id = conn.assigns[:business_id]

    sale =
      cond do
        is_binary(business_id) ->
          Repo.get_by(Sale, id: sale_id, business_id: business_id, owner_id: owner_id)

        true ->
          Repo.get_by(Sale, id: sale_id, owner_id: owner_id)
      end

    case sale do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      _sale ->
        case Fbr.get_status(sale_id) do
          {:ok, data} -> json(conn, %{data: data})
          {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
        end
    end
  end
end
