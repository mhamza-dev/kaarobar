defmodule KaarobarWeb.V1.SupplierController do
  use KaarobarWeb, :controller

  import Ecto.Query

  alias Kaarobar.Repo
  alias Kaarobar.Schemas.Supplier

  def index(conn, _params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_required"})
    else
      data =
        Supplier
        |> where([s], s.business_id == ^business_id and s.owner_id == ^owner_id)
        |> order_by([s], asc: s.name)
        |> Repo.all()
        |> Enum.map(&serialize/1)

      json(conn, %{data: data})
    end
  end

  def create(conn, params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "business_required"})
    else
      attrs = %{
        name: params["name"],
        contact: params["contact"] || %{},
        payment_terms: params["payment_terms"],
        business_id: business_id,
        owner_id: owner_id
      }

      case %Supplier{} |> Supplier.changeset(attrs) |> Repo.insert() do
        {:ok, supplier} ->
          conn |> put_status(:created) |> json(%{data: serialize(supplier)})

        {:error, cs} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
      end
    end
  end

  defp serialize(s) do
    %{
      id: s.id,
      name: s.name,
      contact: s.contact,
      payment_terms: s.payment_terms,
      business_id: s.business_id
    }
  end
end
