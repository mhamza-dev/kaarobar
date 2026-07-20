defmodule Kaarobar.Integrations.Fbr do
  require Logger
  alias Kaarobar.Repo

  def queue_sale_report(sale_id) do
    sale = Repo.get(Kaarobar.Schemas.Sale, sale_id)

    if sale do
      Logger.info("FBR: Reporting sale #{sale.invoice_number} to FBR (mock)")

      mock_fbr_invoice = "FBR-#{:rand.uniform(999999)}"

      sale
      |> Kaarobar.Schemas.Sale.changeset(%{fbr_invoice_no: mock_fbr_invoice})
      |> Repo.update()

      {:ok, mock_fbr_invoice}
    else
      {:error, :sale_not_found}
    end
  end

  def get_status(sale_id) do
    sale = Repo.get(Kaarobar.Schemas.Sale, sale_id)

    if sale && sale.fbr_invoice_no do
      {:ok, %{status: "reported", fbr_invoice_no: sale.fbr_invoice_no}}
    else
      {:ok, %{status: "not_reported"}}
    end
  end
end
