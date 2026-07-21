defmodule Kaarobar.Schemas.DeviceToken do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @platforms ~w(ios android web desktop)

  schema "device_tokens" do
    field :platform, :string
    field :token, :string
    field :enabled, :boolean, default: true

    belongs_to :user, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(token, attrs) do
    token
    |> cast(attrs, [:platform, :token, :enabled, :user_id])
    |> validate_required([:platform, :token, :user_id])
    |> validate_inclusion(:platform, @platforms)
    |> unique_constraint([:user_id, :token])
    |> foreign_key_constraint(:user_id)
  end
end
