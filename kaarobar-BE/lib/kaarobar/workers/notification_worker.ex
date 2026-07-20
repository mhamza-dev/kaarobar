defmodule Kaarobar.Workers.NotificationWorker do
  use Oban.Worker, queue: :notifications, max_attempts: 5

  require Logger

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"notification_id" => id}}) do
    case Kaarobar.Repo.get(Kaarobar.Schemas.Notification, id) do
      nil ->
        {:error, :notification_not_found}

      notification ->
        case Kaarobar.Notifications.deliver(notification) do
          {:ok, _} ->
            Kaarobar.Notifications.mark_sent(id)
            :ok

          {:error, reason} ->
            Logger.warning("Notification #{id} failed: #{inspect(reason)}")
            Kaarobar.Notifications.mark_failed(id)
            {:error, reason}
        end
    end
  end
end
