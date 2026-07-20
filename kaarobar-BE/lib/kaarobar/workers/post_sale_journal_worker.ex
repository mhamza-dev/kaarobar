defmodule Kaarobar.Workers.PostSaleJournalWorker do
  use Oban.Worker, queue: :default

  alias Kaarobar.Accounting

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"sale_id" => sale_id, "business_id" => business_id, "owner_id" => owner_id, "posted_by_id" => posted_by_id}}) do
    case Accounting.post_sale_journal(sale_id, business_id, owner_id, posted_by_id) do
      {:ok, _journal_entry} ->
        :ok

      {:error, reason} ->
        {:error, reason}
    end
  end
end
