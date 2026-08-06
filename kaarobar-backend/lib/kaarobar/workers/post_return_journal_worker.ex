defmodule Kaarobar.Workers.PostReturnJournalWorker do
  use Oban.Worker, queue: :accounting

  @impl Oban.Worker
  def perform(%Oban.Job{
        args: %{
          "return_id" => return_id,
          "business_id" => business_id,
          "owner_id" => owner_id,
          "posted_by_id" => posted_by_id
        }
      }) do
    case Kaarobar.Accounting.post_return_journal(return_id, business_id, owner_id, posted_by_id) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end
end
