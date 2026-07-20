defmodule Kaarobar.Schemas.User do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "users" do
    field :email, :string
    field :password_hash, :string
    field :password, :string, virtual: true
    field :name, :string
    field :phone, :string
    field :status, :string, default: "active"
    field :is_platform_admin, :boolean, default: false
    field :totp_secret, :string
    field :totp_enabled_at, :utc_datetime
    field :mfa_required, :boolean, default: false
    field :confirmed_at, :utc_datetime

    has_many :businesses, Kaarobar.Schemas.Business, foreign_key: :owner_id
    has_many :memberships, Kaarobar.Schemas.Membership
    has_one :subscription, Kaarobar.Schemas.Subscription, foreign_key: :owner_id

    timestamps(type: :utc_datetime)
  end

  def changeset(user, attrs) do
    user
    |> cast(attrs, [
      :email,
      :password,
      :name,
      :phone,
      :status,
      :is_platform_admin,
      :totp_secret,
      :totp_enabled_at,
      :mfa_required,
      :confirmed_at
    ])
    |> validate_required([:email, :name])
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+$/, message: "must have the @ sign and no spaces")
    |> validate_length(:email, max: 160)
    |> validate_length(:password, min: 8, max: 72)
    |> unique_constraint(:email)
    |> hash_password()
  end

  def registration_changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :password, :name, :phone])
    |> validate_required([:email, :password, :name])
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+$/, message: "must have the @ sign and no spaces")
    |> validate_length(:email, max: 160)
    |> validate_length(:password, min: 8, max: 72)
    |> unique_constraint(:email)
    |> put_change(:mfa_required, true)
    |> hash_password()
  end

  defp hash_password(changeset) do
    case get_change(changeset, :password) do
      nil ->
        changeset

      password ->
        changeset
        |> put_change(:password_hash, Argon2.hash_pwd_salt(password))
        |> delete_change(:password)
    end
  end

  def verify_password(user, password) do
    Argon2.verify_pass(password, user.password_hash)
  end

  def mfa_enabled?(%__MODULE__{totp_enabled_at: %DateTime{}}), do: true
  def mfa_enabled?(_), do: false
end
