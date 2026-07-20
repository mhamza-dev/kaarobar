defmodule Kaarobar.Accounts do
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.User

  def register(attrs) do
    %User{}
    |> User.registration_changeset(attrs)
    |> Repo.insert()
  end

  def authenticate(email, password) do
    user = Repo.get_by(User, email: email)

    cond do
      user && User.verify_password(user, password) ->
        {:ok, user}

      user ->
        {:error, :invalid_credentials}

      true ->
        Argon2.no_user_verify()
        {:error, :invalid_credentials}
    end
  end

  def get_user(id) do
    Repo.get(User, id)
  end

  def get_user!(id) do
    Repo.get!(User, id)
  end

  def get_user_by_email(email) do
    Repo.get_by(User, email: email)
  end

  def list_users do
    Repo.all(User)
  end

  def update_user(%User{} = user, attrs) do
    user
    |> User.changeset(attrs)
    |> Repo.update()
  end
end
