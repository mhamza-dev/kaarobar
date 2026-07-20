defmodule Kaarobar.Workers.FbrReportWorker do
  use Oban.Worker, queue: :default

  alias Kaarobar.Integrations.Fbr

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"sale_id" => sale_id}}) do
    case Fbr.queue_sale_report(sale_id) do
      {:ok, _fbr_invoice} ->
        :ok

      {:error, reason} ->
        {:error, reason}
    end
  end
end
