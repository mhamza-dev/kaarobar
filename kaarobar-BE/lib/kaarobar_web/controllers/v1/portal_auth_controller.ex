defmodule KaarobarWeb.V1.PortalAuthController do
  use KaarobarWeb, :controller

  alias Kaarobar.CustomerPortal

  def register(conn, params) do
    business_id = params["business_id"] || header(conn, "x-business-id")

    case CustomerPortal.register(business_id, params) do
      {:ok, account} ->
        {:ok, _session, token} = CustomerPortal.create_session(account, user_agent(conn))

        conn
        |> put_status(:created)
        |> json(%{
          data: %{
            access_token: token,
            account: serialize_account(account)
          }
        })

      {:error, :self_register_disabled} ->
        conn |> put_status(:forbidden) |> json(%{error: "self_register_disabled"})

      {:error, :business_not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "business_not_found"})

      {:error, %Ecto.Changeset{} = cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def login(conn, params) do
    business_id = params["business_id"] || header(conn, "x-business-id")
    email = params["email"]
    password = params["password"]

    case CustomerPortal.authenticate(business_id, email, password) do
      {:ok, account} ->
        {:ok, _session, token} = CustomerPortal.create_session(account, user_agent(conn))

        json(conn, %{
          data: %{
            access_token: token,
            account: serialize_account(account)
          }
        })

      {:error, :inactive} ->
        conn |> put_status(:forbidden) |> json(%{error: "inactive"})

      {:error, _} ->
        conn |> put_status(:unauthorized) |> json(%{error: "invalid_credentials"})
    end
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
    business_id = params["business_id"] || header(conn, "x-business-id")
    _ = CustomerPortal.request_password_reset(business_id, params["email"])
    json(conn, %{data: %{ok: true}})
  end

  def reset_password(conn, params) do
    case CustomerPortal.reset_password(params["token"], params["password"]) do
      {:ok, _} -> json(conn, %{data: %{ok: true}})
      {:error, :invalid_token} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid_token"})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs)})
    end
  end

  defp serialize_account(account) do
    account = Kaarobar.Repo.preload(account, :customer)

    %{
      id: account.id,
      email: account.email,
      email_verified: account.email_verified,
      business_id: account.business_id,
      customer_id: account.customer_id,
      customer_name: account.customer && account.customer.name
    }
  end

  defp bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> String.trim(token)
      _ -> nil
    end
  end

  defp header(conn, name) do
    case get_req_header(conn, name) |> List.first() do
      nil -> nil
      value -> value
    end
  end

  defp user_agent(conn) do
    get_req_header(conn, "user-agent") |> List.first()
  end
end
