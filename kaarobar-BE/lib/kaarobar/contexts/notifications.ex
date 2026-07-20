defmodule Kaarobar.Notifications do
  @moduledoc """
  In-app + email notifications (NOT-FR).
  """

  import Ecto.Query
  alias Kaarobar.{Mailer, Repo}
  alias Kaarobar.Schemas.{Notification, User}

  def enqueue(attrs) do
    with {:ok, notification} <-
           %Notification{}
           |> Notification.changeset(Map.merge(normalize(attrs), %{status: "pending"}))
           |> Repo.insert() do
      %{notification_id: notification.id}
      |> Kaarobar.Workers.NotificationWorker.new()
      |> Oban.insert()

      {:ok, notification}
    end
  end

  def enqueue_email(user_id, owner_id, type, payload, opts \\ []) do
    enqueue(%{
      user_id: user_id,
      owner_id: owner_id,
      channel: "email",
      type: type,
      title: Keyword.get(opts, :title) || human_title(type),
      body: Keyword.get(opts, :body) || Map.get(payload, :message) || Map.get(payload, "message"),
      payload: payload
    })
  end

  def list_for_user(user_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)

    from(n in Notification,
      where: n.user_id == ^user_id,
      order_by: [desc: n.inserted_at],
      limit: ^limit
    )
    |> Repo.all()
  end

  def mark_read(id, user_id) do
    case Repo.get_by(Notification, id: id, user_id: user_id) do
      nil ->
        {:error, :not_found}

      n ->
        n
        |> Notification.changeset(%{read_at: DateTime.utc_now() |> DateTime.truncate(:second)})
        |> Repo.update()
    end
  end

  def deliver(%Notification{} = notification) do
    case notification.channel do
      "email" -> deliver_email(notification)
      _ -> {:ok, :skipped_channel}
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

  defp deliver_email(notification) do
    user = Repo.get(User, notification.user_id)

    if is_nil(user) or is_nil(user.email) do
      {:error, :no_recipient}
    else
      email =
        Swoosh.Email.new()
        |> Swoosh.Email.to({user.name || user.email, user.email})
        |> Swoosh.Email.from({"Kaarobar", "noreply@kaarobar.local"})
        |> Swoosh.Email.subject(notification.title || human_title(notification.type))
        |> Swoosh.Email.text_body(email_body(notification))

      case Mailer.deliver(email) do
        {:ok, _} -> {:ok, :sent}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp email_body(n) do
    base = n.body || "You have a new Kaarobar notification (#{n.type})."
    payload = inspect(n.payload || %{})
    "#{base}\n\nDetails: #{payload}\n"
  end

  defp human_title("leave_request"), do: "Leave request submitted"
  defp human_title("leave.approved"), do: "Leave approved"
  defp human_title("leave.rejected"), do: "Leave rejected"
  defp human_title("payroll.approved"), do: "Payroll approved"
  defp human_title("payroll.pending"), do: "Payroll awaiting approval"
  defp human_title("billing.limit"), do: "Plan limit reached"
  defp human_title(other), do: "Kaarobar · #{other}"

  defp normalize(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_binary(k) ->
        key =
          try do
            String.to_existing_atom(k)
          rescue
            ArgumentError -> String.to_atom(k)
          end

        {key, v}

      {k, v} ->
        {k, v}
    end)
  end
end
