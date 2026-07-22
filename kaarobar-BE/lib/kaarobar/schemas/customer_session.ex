defmodule Kaarobar.Schemas.CustomerSession do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "customer_sessions" do
    field :token_hash, :string
    field :expires_at, :utc_datetime
    field :revoked_at, :utc_datetime
    field :user_agent, :string

    belongs_to :customer_account, Kaarobar.Schemas.CustomerAccount

    timestamps(type: :utc_datetime)
  end

  def changeset(session, attrs) do
    session
    |> cast(attrs, [:customer_account_id, :token_hash, :expires_at, :revoked_at, :user_agent])
    |> validate_required([:customer_account_id, :token_hash, :expires_at])
    |> foreign_key_constraint(:customer_account_id)
    |> unique_constraint(:token_hash)
  end
end
