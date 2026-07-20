defmodule KaarobarWeb.V1.FbrController do
  use KaarobarWeb, :controller
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.Sale

  def status(conn, %{"sale_id" => sale_id}) do
    case Repo.get(Sale, sale_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      sale ->
        json(conn, %{
          data: %{
            sale_id: sale.id,
            fbr_invoice_no: sale.fbr_invoice_no,
            reported: not is_nil(sale.fbr_invoice_no)
          }
        })
    end
  end
end
