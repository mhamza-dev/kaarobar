defmodule Kaarobar.Notifications do
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.Notification

  def enqueue(attrs) do
    with {:ok, notification} <-
           %Notification{}
           |> Notification.changeset(Map.merge(attrs, %{status: "pending"}))
           |> Repo.insert() do
      %{notification_id: notification.id}
      |> Kaarobar.Workers.NotificationWorker.new()
      |> Oban.insert()

      {:ok, notification}
    end
  end

  def mark_sent(id) do
    case Repo.get(Notification, id) do
      nil ->
        {:error, :not_found}

      n ->
        n
        |> Notification.changeset(%{
          status: "sent",
          sent_at: DateTime.utc_now() |> DateTime.truncate(:second)
        })
        |> Repo.update()
    end
  end

  def mark_failed(id) do
    case Repo.get(Notification, id) do
      nil ->
        {:error, :not_found}

      n ->
        n
        |> Notification.changeset(%{status: "failed"})
        |> Repo.update()
    end
  end

  def enqueue_email(user_id, owner_id, type, payload) do
    enqueue(%{
      user_id: user_id,
      owner_id: owner_id,
      channel: "email",
      type: type,
      payload: payload
    })
  end
end
