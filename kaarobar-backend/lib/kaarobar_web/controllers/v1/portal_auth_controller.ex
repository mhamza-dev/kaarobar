defmodule KaarobarWeb.V1.PortalAuthController do
  @moduledoc """
  Deprecated portal auth endpoints. Prefer POST /auth/login|register with actor=consumer.
  These handlers proxy to the unified auth flows for backward compatibility.
  """
  use KaarobarWeb, :controller

  alias Kaarobar.CustomerPortal

  def register(conn, params) do
    # Proxy to unified buyer register
    KaarobarWeb.V1.AuthController.register(conn, Map.put(params, "actor", "consumer"))
  end

  def login(conn, params) do
    KaarobarWeb.V1.AuthController.login(conn, Map.put(params, "actor", "consumer"))
  end

  def logout(conn, _params) do
    token = bearer_token(conn)
    _ = if token, do: CustomerPortal.revoke_session(token)
    json(conn, %{data: %{ok: true}})
  end

  def verify_email(conn, %{"token" => token}) do
    case CustomerPortal.verify_email(token) do
      {:ok, _} -> json(conn, %{data: %{ok: true}})
      {:error, _} -> conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid_token"})
    end
  end

  def request_reset(conn, params) do
    _ = CustomerPortal.request_password_reset(params["email"])
    json(conn, %{data: %{ok: true}})
  end

  def reset_password(conn, params) do
    case CustomerPortal.reset_password(params["token"], params["password"]) do
      {:ok, _} ->
        json(conn, %{data: %{ok: true}})

      {:error, :invalid_token} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid_token"})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs)})
    end
  end

  defp bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> String.trim(token)
      _ -> nil
    end
  end
end
