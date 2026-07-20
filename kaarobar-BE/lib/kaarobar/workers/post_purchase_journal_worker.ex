defmodule Kaarobar.Workers.PostPurchaseJournalWorker do
  use Oban.Worker, queue: :accounting

  @impl Oban.Worker
  def perform(%Oban.Job{
        args: %{
          "gr_id" => gr_id,
          "business_id" => business_id,
          "owner_id" => owner_id,
          "posted_by_id" => posted_by_id
        }
      }) do
    case Kaarobar.Accounting.post_purchase_journal(gr_id, business_id, owner_id, posted_by_id) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end
end
