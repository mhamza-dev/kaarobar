defmodule Kaarobar.Notifications.Push.Expo do
  @moduledoc """
  Sends push notifications through Expo's push service.

  `mobile/staff` is built with Expo, so its push tokens are Expo push tokens
  and this is the one HTTP call needed to reach them — no Firebase or APNs
  credentials of this application's own, Expo holds those on its clients'
  behalf. See https://docs.expo.dev/push-notifications/sending-notifications/.

  `EXPO_ACCESS_TOKEN` is optional: Expo's push endpoint accepts unauthenticated
  requests at a lower rate limit, which is enough for a codebase with no
  traffic yet, and this adapter costs nothing extra either way.
  """

  @behaviour Kaarobar.Notifications.Push

  @endpoint "https://exp.host/--/api/v2/push/send"

  require Logger

  @impl true
  def send(token, title, body, data) do
    message = %{to: token, title: title, body: body, data: data, sound: "default"}

    case req_module().post(@endpoint, json: message, headers: headers()) do
      {:ok, %{status: 200, body: %{"data" => %{"status" => "ok"}} = decoded}} ->
        {:ok, decoded}

      {:ok, %{status: 200, body: %{"data" => %{"status" => "error"} = data}}} ->
        {:error, Map.get(data, "message", "expo rejected the push")}

      {:ok, %{status: status, body: body}} ->
        Logger.warning("expo push failed: #{status} #{inspect(body)}")
        {:error, {:http_error, status}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp headers do
    case System.get_env("EXPO_ACCESS_TOKEN") do
      nil -> [{"accept", "application/json"}]
      token -> [{"accept", "application/json"}, {"authorization", "Bearer #{token}"}]
    end
  end

  defp req_module do
    Application.get_env(:backend, __MODULE__, [])[:req_module] || Req
  end
end
