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
    belongs_to :customer_account, Kaarobar.Schemas.CustomerAccount

    timestamps(type: :utc_datetime)
  end

  def changeset(notification, attrs) do
    notification
    |> cast(attrs, [
      :channel,
      :type,
      :payload,
      :status,
      :sent_at,
      :read_at,
      :title,
      :body,
      :user_id,
      :owner_id,
      :customer_account_id
    ])
    |> validate_required([:channel, :type, :owner_id])
    |> validate_inclusion(:channel, ["email", "sms", "whatsapp", "push", "in_app"])
    |> validate_recipient()
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:customer_account_id)
    |> foreign_key_constraint(:owner_id)
  end

  defp validate_recipient(changeset) do
    user_id = get_field(changeset, :user_id)
    account_id = get_field(changeset, :customer_account_id)

    cond do
      is_binary(user_id) and (is_nil(account_id) or account_id == "") ->
        changeset

      is_binary(account_id) and (is_nil(user_id) or user_id == "") ->
        changeset

      true ->
        add_error(
          changeset,
          :user_id,
          "exactly one of user_id or customer_account_id is required"
        )
    end
  end
end
