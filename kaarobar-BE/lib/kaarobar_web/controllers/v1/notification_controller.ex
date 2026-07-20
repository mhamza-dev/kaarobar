defmodule KaarobarWeb.V1.NotificationController do
  use KaarobarWeb, :controller

  alias Kaarobar.Guardian
  alias Kaarobar.Notifications

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)

    data =
      Notifications.list_for_user(user.id)
      |> Enum.map(&serialize/1)

    json(conn, %{data: data})
  end

  def mark_read(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)

    case Notifications.mark_read(id, user.id) do
      {:ok, n} -> json(conn, %{data: serialize(n)})
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
end
