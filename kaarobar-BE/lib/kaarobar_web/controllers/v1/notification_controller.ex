defmodule KaarobarWeb.V1.NotificationController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Notifications

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    data = Notifications.list_for_user(user.id) |> Enum.map(&serialize/1)
    unread = Notifications.unread_count(user.id)

    json(conn, %{data: data, meta: %{unread: unread}})
  end

  def unread_count(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    json(conn, %{data: %{unread: Notifications.unread_count(user.id)}})
  end

  def mark_read(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)

    case Notifications.mark_read(id, user.id) do
      {:ok, n} -> json(conn, %{data: serialize(n)})
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
    end
  end

  def mark_all_read(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    {:ok, count} = Notifications.mark_all_read(user.id)
    json(conn, %{data: %{marked: count, unread: 0}})
  end

  def get_preferences(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    pref = Notifications.get_or_create_preferences(user.id)
    json(conn, %{data: Notifications.serialize_preferences(pref)})
  end

  def update_preferences(conn, params) do
    user = Guardian.Plug.current_resource(conn)

    attrs =
      %{}
      |> maybe_put(params, "email")
      |> maybe_put(params, "in_app")
      |> maybe_put(params, "push")
      |> maybe_put(params, "muted_types")

    case Notifications.update_preferences(user.id, attrs) do
      {:ok, pref} ->
        json(conn, %{data: Notifications.serialize_preferences(pref)})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "validation_failed", details: inspect(changeset.errors)})
    end
  end

  def register_device(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    platform = params["platform"]
    token = params["token"]

    case Notifications.upsert_device_token(user.id, platform, token) do
      {:ok, device} ->
        conn
        |> put_status(:created)
        |> json(%{
          data: %{
            id: device.id,
            platform: device.platform,
            enabled: device.enabled
          }
        })

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "validation_failed", details: inspect(changeset.errors)})
    end
  end

  def revoke_device(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)

    case Notifications.revoke_device_token(user.id, id) do
      {:ok, _} -> json(conn, %{data: %{ok: true}})
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
    end
  end

  defp serialize(n) do
    %{
      id: n.id,
      channel: n.channel,
      type: n.type,
      title: n.title,
      body: n.body,
      status: n.status,
      payload: n.payload,
      sent_at: n.sent_at,
      read_at: n.read_at,
      inserted_at: n.inserted_at
    }
  end

  defp maybe_put(map, params, key) do
    case Map.fetch(params, key) do
      {:ok, value} -> Map.put(map, key, value)
      :error -> map
    end
  end
end
