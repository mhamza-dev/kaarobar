defmodule Kaarobar.Schemas.Notification do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "notifications" do
    field :channel, :string
    field :type, :string
    field :payload, :map
    field :status, :string, default: "pending"
    field :sent_at, :utc_datetime
    field :read_at, :utc_datetime
    field :title, :string
    field :body, :string

    belongs_to :user, Kaarobar.Schemas.User
    belongs_to :owner, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(notification, attrs) do
    notification
    |> cast(attrs, [:channel, :type, :payload, :status, :sent_at, :read_at, :title, :body, :user_id, :owner_id])
    |> validate_required([:channel, :type, :user_id, :owner_id])
    |> validate_inclusion(:channel, ["email", "sms", "whatsapp", "push"])
    |> foreign_key_constraint(:user_id)
  end
end
