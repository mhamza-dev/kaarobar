defmodule KaarobarWeb.V1.AuthController do
  use KaarobarWeb, :controller

  alias Kaarobar.{Accounts, Tenancy, Billing, Guardian}

  def register(conn, params) do
    attrs = %{
      email: params["email"],
      password: params["password"],
      name: params["name"],
      phone: params["phone"]
    }

    with {:ok, user} <- Accounts.register(attrs),
         {:ok, _sub} <- Billing.ensure_subscription(user.id),
         :ok <- maybe_create_business(user, params["business_name"]),
         {:ok, token, _claims} <- Guardian.encode_and_sign(user) do
      conn
      |> put_status(:created)
      |> json(%{
        access_token: token,
        token_type: "Bearer",
        user: %{id: user.id, email: user.email, name: user.name}
      })
    else
      {:error, %Ecto.Changeset{} = changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "validation_failed", details: translate_errors(changeset)})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: inspect(reason)})
    end
  end

  def login(conn, %{"email" => email, "password" => password}) do
    case Accounts.authenticate(email, password) do
      {:ok, user} ->
        {:ok, token, _claims} = Guardian.encode_and_sign(user)

        json(conn, %{
          access_token: token,
          token_type: "Bearer",
          user: %{id: user.id, email: user.email, name: user.name}
        })

      {:error, _} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "invalid_credentials"})
    end
  end

  def me(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    json(conn, %{user: %{id: user.id, email: user.email, name: user.name}})
  end

  defp maybe_create_business(_user, nil), do: :ok
  defp maybe_create_business(_user, ""), do: :ok

  defp maybe_create_business(user, business_name) do
    case Tenancy.create_business(user.id, %{name: business_name, tax_jurisdiction: "PK"}) do
      {:ok, business} ->
        Tenancy.create_branch(business.id, user.id, %{name: "Main Branch", timezone: "Asia/Karachi"})
        :ok

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp translate_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
