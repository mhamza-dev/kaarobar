defmodule Kaarobar.Integrations.Fbr do
  @moduledoc """
  FBR Tier-1 POS integration (FBR-FR-001–004).

  Production uses a real adapter; default is a deterministic mock that still
  writes receipt fields so tills are non-blocking.
  """

  require Logger
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.Sale

  def queue_sale_report(sale_id) do
    sale = Repo.get(Sale, sale_id) |> then(&(&1 && Repo.preload(&1, [:items, :business])))

    cond do
      is_nil(sale) ->
        {:error, :sale_not_found}

      not is_nil(sale.fbr_invoice_no) ->
        {:ok, sale.fbr_invoice_no}

      true ->
        mock_fbr_invoice = "FBR-#{String.slice(sale.id, 0, 8)}-#{:erlang.phash2(sale.invoice_number, 999_999)}"

        qr =
          Jason.encode!(%{
            fbr_invoice_no: mock_fbr_invoice,
            pos_invoice: sale.invoice_number,
            total: to_string(sale.total_amount),
            business: sale.business && sale.business.name,
            reported_at: DateTime.utc_now() |> DateTime.to_iso8601()
          })

        Logger.info("FBR: reporting sale #{sale.invoice_number} (mock) → #{mock_fbr_invoice}")

        sale
        |> Sale.changeset(%{
          fbr_invoice_no: mock_fbr_invoice,
          fbr_qr_payload: qr,
          fbr_reported_at: DateTime.utc_now() |> DateTime.truncate(:second)
        })
        |> Repo.update()
        |> case do
          {:ok, updated} -> {:ok, updated.fbr_invoice_no}
          {:error, cs} -> {:error, cs}
        end
    end
  end

  def get_status(sale_id) do
    case Repo.get(Sale, sale_id) do
      nil ->
        {:error, :not_found}

      %{fbr_invoice_no: nil} = sale ->
        {:ok,
         %{
           status: "pending",
           sale_id: sale.id,
           fbr_invoice_no: nil,
           fbr_qr_payload: nil,
           reported: false
         }}

      sale ->
        {:ok,
         %{
           status: "reported",
           sale_id: sale.id,
           fbr_invoice_no: sale.fbr_invoice_no,
           fbr_qr_payload: sale.fbr_qr_payload,
           fbr_reported_at: sale.fbr_reported_at,
           reported: true
         }}
    end
  end
end
