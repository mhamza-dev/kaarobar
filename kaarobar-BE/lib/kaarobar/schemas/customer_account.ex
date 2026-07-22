defmodule Kaarobar.Schemas.CustomerAccount do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "customer_accounts" do
    field :email, :string
    field :password_hash, :string
    field :password, :string, virtual: true
    field :email_verified, :boolean, default: false
    field :email_verify_token_hash, :string
    field :password_reset_token_hash, :string
    field :password_reset_sent_at, :utc_datetime
    field :mfa_enabled, :boolean, default: false
    field :totp_secret_enc, :string
    field :last_login_at, :utc_datetime
    field :status, :string, default: "active"

    belongs_to :customer, Kaarobar.Schemas.Customer
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    has_many :sessions, Kaarobar.Schemas.CustomerSession

    timestamps(type: :utc_datetime)
  end

  def registration_changeset(account, attrs) do
    account
    |> cast(attrs, [
      :email,
      :password,
      :customer_id,
      :owner_id,
      :business_id,
      :email_verified,
      :email_verify_token_hash,
      :status
    ])
    |> validate_required([:email, :password, :customer_id, :owner_id, :business_id])
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+$/, message: "must have the @ sign and no spaces")
    |> validate_length(:password, min: 8, max: 72)
    |> update_change(:email, &String.downcase/1)
    |> unique_constraint([:business_id, :email])
    |> unique_constraint(:customer_id)
    |> hash_password()
  end

  def password_changeset(account, attrs) do
    account
    |> cast(attrs, [:password, :password_reset_token_hash, :password_reset_sent_at])
    |> validate_required([:password])
    |> validate_length(:password, min: 8, max: 72)
    |> hash_password()
  end

  def changeset(account, attrs) do
    account
    |> cast(attrs, [
      :email_verified,
      :email_verify_token_hash,
      :password_reset_token_hash,
      :password_reset_sent_at,
      :mfa_enabled,
      :totp_secret_enc,
      :last_login_at,
      :status
    ])
  end

  def verify_password(%__MODULE__{password_hash: hash}, password)
      when is_binary(hash) and is_binary(password) do
    Argon2.verify_pass(password, hash)
  end

  def verify_password(_, _), do: Argon2.no_user_verify()

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
end
