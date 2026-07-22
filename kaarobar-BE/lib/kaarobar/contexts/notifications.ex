defmodule Kaarobar.Notifications do
  @moduledoc """
  In-app inbox + email + out-app (push) notifications with per-user channel prefs.
  """

  import Ecto.Query
  alias Kaarobar.{Mailer, Repo}
  alias Kaarobar.Schemas.{DeviceToken, Notification, NotificationPreference, User}

  @default_prefs %{
    email: true,
    in_app: true,
    push: true,
    muted_types: []
  }

  ## —— Fan-out notify ————————————————————————————————————————————

  @doc """
  Create channel-specific notification rows according to the user's preferences.
  Inbox source of truth is `channel: "in_app"`.
  """
  def notify(user_id, owner_id, type, payload \\ %{}, opts \\ []) do
    prefs = get_or_create_preferences(user_id)
    muted = prefs.muted_types || []

    if type in muted do
      {:ok, :muted}
    else
      title = Keyword.get(opts, :title) || human_title(type)

      body =
        Keyword.get(opts, :body) ||
          Map.get(payload, :message) ||
          Map.get(payload, "message")

      base = %{
        user_id: user_id,
        owner_id: owner_id,
        type: type,
        title: title,
        body: body,
        payload: payload || %{}
      }

      created = []

      created =
        if prefs.in_app do
          case enqueue(Map.put(base, :channel, "in_app")) do
            {:ok, n} -> [n | created]
            _ -> created
          end
        else
          created
        end

      created =
        if prefs.email do
          case enqueue(Map.put(base, :channel, "email")) do
            {:ok, n} -> [n | created]
            _ -> created
          end
        else
          created
        end

      created =
        if prefs.push and has_active_device_tokens?(user_id) do
          case enqueue(Map.put(base, :channel, "push")) do
            {:ok, n} -> [n | created]
            _ -> created
          end
        else
          created
        end

      {:ok, Enum.reverse(created)}
    end
  end

  @doc """
  Notify all active memberships on a business that have any of the given roles.
  Always includes `owner_id` when `"owner"` is among the target roles.
  """
  def notify_roles(business_id, owner_id, roles, type, payload \\ %{}, opts \\ [])
      when is_list(roles) do
    import Ecto.Query

    role_set = MapSet.new(Enum.map(roles, &to_string/1))

    user_ids =
      from(m in Kaarobar.Schemas.Membership,
        where: m.business_id == ^business_id and m.status == "active"
      )
      |> Repo.all()
      |> Enum.filter(fn m ->
        Enum.any?(m.roles || [], &MapSet.member?(role_set, &1))
      end)
      |> Enum.map(& &1.user_id)

    user_ids =
      if MapSet.member?(role_set, "owner") do
        Enum.uniq([owner_id | user_ids])
      else
        Enum.uniq(user_ids)
      end

    Enum.each(user_ids, fn uid ->
      notify(uid, owner_id, type, payload, opts)
    end)

    {:ok, length(user_ids)}
  end

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
    notify(user_id, owner_id, type, payload, opts)
  end

  ## —— Inbox ————————————————————————————————————————————————————

  def list_for_user(user_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    channel = Keyword.get(opts, :channel, "in_app")

    from(n in Notification,
      where: n.user_id == ^user_id and n.channel == ^channel,
      order_by: [desc: n.inserted_at],
      limit: ^limit
    )
    |> Repo.all()
  end

  def unread_count(user_id) do
    from(n in Notification,
      where: n.user_id == ^user_id and n.channel == "in_app" and is_nil(n.read_at),
      select: count(n.id)
    )
    |> Repo.one()
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

  def mark_all_read(user_id) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    {count, _} =
      from(n in Notification,
        where: n.user_id == ^user_id and n.channel == "in_app" and is_nil(n.read_at)
      )
      |> Repo.update_all(set: [read_at: now, updated_at: now])

    {:ok, count}
  end

  ## —— Preferences ——————————————————————————————————————————————

  def get_or_create_preferences(user_id) do
    case Repo.get_by(NotificationPreference, user_id: user_id) do
      %NotificationPreference{} = pref ->
        pref

      nil ->
        {:ok, pref} =
          %NotificationPreference{}
          |> NotificationPreference.changeset(Map.put(@default_prefs, :user_id, user_id))
          |> Repo.insert()

        pref
    end
  end

  def update_preferences(user_id, attrs) do
    pref = get_or_create_preferences(user_id)

    pref
    |> NotificationPreference.changeset(normalize(attrs))
    |> Repo.update()
  end

  def serialize_preferences(%NotificationPreference{} = pref) do
    %{
      email: pref.email,
      in_app: pref.in_app,
      push: pref.push,
      muted_types: pref.muted_types || []
    }
  end

  ## —— Device tokens ————————————————————————————————————————————

  def upsert_device_token(user_id, platform, token) do
    case Repo.get_by(DeviceToken, user_id: user_id, token: token) do
      nil ->
        %DeviceToken{}
        |> DeviceToken.changeset(%{
          user_id: user_id,
          platform: platform,
          token: token,
          enabled: true
        })
        |> Repo.insert()

      existing ->
        existing
        |> DeviceToken.changeset(%{platform: platform, enabled: true})
        |> Repo.update()
    end
  end

  def revoke_device_token(user_id, token_or_id) do
    query =
      from(d in DeviceToken,
        where: d.user_id == ^user_id and (d.id == ^token_or_id or d.token == ^token_or_id)
      )

    case Repo.one(query) do
      nil ->
        {:error, :not_found}

      device ->
        Repo.delete(device)
    end
  end

  def list_device_tokens(user_id) do
    from(d in DeviceToken, where: d.user_id == ^user_id and d.enabled == true)
    |> Repo.all()
  end

  def has_active_device_tokens?(user_id) do
    from(d in DeviceToken,
      where: d.user_id == ^user_id and d.enabled == true,
      select: count(d.id)
    )
    |> Repo.one()
    |> Kernel.>(0)
  end

  ## —— Delivery ————————————————————————————————————————————————

  def deliver(%Notification{} = notification) do
    case notification.channel do
      "email" -> deliver_email(notification)
      "push" -> deliver_push(notification)
      "in_app" -> {:ok, :in_app}
      _ -> {:error, :unsupported_channel}
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

  defp deliver_push(notification) do
    tokens = list_device_tokens(notification.user_id)

    if tokens == [] do
      {:ok, :no_devices}
    else
      results =
        Enum.map(tokens, fn device ->
          push_expo(device.token, notification)
        end)

      if Enum.any?(results, &match?({:ok, _}, &1)) do
        {:ok, :sent}
      else
        {:error, :push_failed}
      end
    end
  end

  defp push_expo(token, notification) do
    access_token = System.get_env("EXPO_ACCESS_TOKEN")

    headers = [
      {"content-type", "application/json"},
      {"accept", "application/json"},
      {"accept-encoding", "gzip, deflate"}
    ]

    headers =
      if is_binary(access_token) and access_token != "" do
        [{"authorization", "Bearer #{access_token}"} | headers]
      else
        headers
      end

    body =
      Jason.encode!(%{
        to: token,
        title: notification.title || human_title(notification.type),
        body: notification.body || "You have a new Kaarobar notification",
        data: %{
          type: notification.type,
          notification_id: notification.id,
          payload: notification.payload || %{}
        },
        sound: "default"
      })

    request =
      Finch.build(
        :post,
        "https://exp.host/--/api/v2/push/send",
        headers,
        body
      )

    case Finch.request(request, Kaarobar.Finch) do
      {:ok, %Finch.Response{status: status}} when status in 200..299 ->
        {:ok, :sent}

      {:ok, %Finch.Response{status: status, body: resp}} ->
        {:error, {status, resp}}

      {:error, reason} ->
        {:error, reason}
    end
  rescue
    error -> {:error, error}
  end

  defp email_body(n) do
    base = n.body || "You have a new Kaarobar notification (#{n.type})."
    payload = inspect(n.payload || %{})
    "#{base}\n\nDetails: #{payload}\n"
  end

  def human_title("crm.campaign"), do: "Marketing campaign"
  def human_title("leave_request"), do: "Leave request submitted"
  def human_title("leave.approved"), do: "Leave approved"
  def human_title("leave.rejected"), do: "Leave rejected"
  def human_title("payroll.approved"), do: "Payroll approved"
  def human_title("payroll.pending"), do: "Payroll awaiting approval"
  def human_title("billing.limit"), do: "Plan limit reached"
  def human_title("return.pending"), do: "Return awaiting approval"
  def human_title("return.approved"), do: "Return approved"
  def human_title("return.rejected"), do: "Return rejected"
  def human_title("inventory.low_stock"), do: "Low stock alert"
  def human_title("transfer.pending"), do: "Stock transfer pending"
  def human_title("transfer.confirmed"), do: "Stock transfer confirmed"
  def human_title("discount.approval_needed"), do: "Discount needs approval"
  def human_title(other) when is_binary(other), do: "Kaarobar · #{other}"
  def human_title(_), do: "Kaarobar notification"

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
