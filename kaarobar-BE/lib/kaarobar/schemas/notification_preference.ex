defmodule Kaarobar.Schemas.NotificationPreference do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "notification_preferences" do
    field :email, :boolean, default: true
    field :in_app, :boolean, default: true
    field :push, :boolean, default: true
    field :muted_types, {:array, :string}, default: []

    belongs_to :user, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(pref, attrs) do
    pref
    |> cast(attrs, [
      :email,
      :in_app,
      :push,
      :muted_types,
      :user_id
    ])
    |> validate_required([:user_id])
    |> unique_constraint(:user_id)
    |> foreign_key_constraint(:user_id)
  end
end
